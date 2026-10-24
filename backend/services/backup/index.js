const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const BackupRun = require('../../models/BackupRun');

/**
 * Database backup & restore drills with the MongoDB Database Tools. Works the same for a
 * self-hosted MongoDB (VPS) and MongoDB Atlas, because both speak the same URI.
 * Atlas' own cloud snapshots are listed alongside when ATLAS_* is configured (atlas.js).
 *
 * Runs from scripts/backup.js (host cron), from the in-app scheduler when
 * BACKUP_SCHEDULE_HOURS is set, or from the developer dashboard.
 *
 * Never restores over the live database: a drill restores into `<db>_restore_drill`,
 * counts every collection, and drops that database again.
 */

const HOUR = 60 * 60 * 1000;
const DRILL_SUFFIX = '_restore_drill';
const KEEP_AT_LEAST = 3;

function config() {
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
  return {
    dir: process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : null,
    mongodump: process.env.MONGODUMP_BIN || 'mongodump',
    mongorestore: process.env.MONGORESTORE_BIN || 'mongorestore',
    retentionDays: num(process.env.BACKUP_RETENTION_DAYS, 14),
    maxAgeHours: num(process.env.BACKUP_MAX_AGE_HOURS, 26),
    scheduleHours: process.env.BACKUP_SCHEDULE_HOURS ? num(process.env.BACKUP_SCHEDULE_HOURS, 24) : null,
    offsiteCmd: process.env.BACKUP_OFFSITE_CMD || null,
  };
}

const redact = (s) => String(s || '').replace(/(mongodb(?:\+srv)?:\/\/)[^@\s/]+@/gi, '$1***@').slice(-1500);

/** Spawn without a shell; resolves with stderr, rejects with the tail of stderr. */
function run(bin, args, timeoutMs = 6 * HOUR) {
  return new Promise((resolve, reject) => {
    let err = '';
    const child = spawn(bin, args, { windowsHide: true });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', () => {});
    child.stderr.on('data', (d) => (err = (err + d).slice(-8000)));
    child.on('error', (e) => {
      clearTimeout(timer);
      reject(new Error(e.code === 'ENOENT' ? `${bin} not found — install MongoDB Database Tools or set its path` : e.message));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(err);
      else reject(new Error(`${path.basename(bin)} exited with ${code}: ${redact(err)}`));
    });
  });
}

/**
 * The URI goes in a 0600 config file, not argv, so it never shows up in `ps`.
 * Removed as soon as the tool exits.
 */
async function withUriConfig(dir, fn) {
  const file = path.join(dir, `.tools-${crypto.randomBytes(6).toString('hex')}.yaml`);
  await fs.promises.writeFile(file, `uri: ${JSON.stringify(process.env.MONGO_URI)}\n`, { mode: 0o600 });
  try {
    return await fn(`--config=${file}`);
  } finally {
    await fs.promises.rm(file, { force: true });
  }
}

const sha256 = (file) =>
  new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

async function collectionCounts(db) {
  const list = await db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray();
  const names = list.map((c) => c.name).filter((n) => !n.startsWith('system.')).sort();
  return Promise.all(names.map(async (name) => ({ name, count: await db.collection(name).countDocuments() })));
}

/** Pure: drill counts vs. counts recorded at backup time. Unit-tested. */
function compareCounts(expected, actual) {
  const got = new Map(actual.map((c) => [c.name, c.count]));
  // ponytail: mongodump without --oplog is not point-in-time, so writes during the dump
  // can shift a count slightly; tolerate max(5, 0.1%). Use --oplog on a replica set to be exact.
  const tolerance = (n) => Math.max(5, Math.ceil(n * 0.001));
  return expected
    .map(({ name, count }) => ({ name, expected: count, actual: got.get(name) ?? 0 }))
    .filter((m) => Math.abs(m.actual - m.expected) > tolerance(m.expected));
}

/** Split a command line on whitespace and fill {file} / {name}. No shell is involved. */
const offsiteArgs = (cmd, file) => cmd.trim().split(/\s+/).map((a) => a.replaceAll('{file}', file).replaceAll('{name}', path.basename(file)));

function requireReady() {
  const c = config();
  if (!c.dir) throw Object.assign(new Error('Backups are not configured: set BACKUP_DIR.'), { status: 400 });
  if (mongoose.connection.readyState !== 1) throw Object.assign(new Error('Database is not connected.'), { status: 503 });
  return c;
}

async function assertIdle(kind) {
  const busy = await BackupRun.findOne({ kind, status: 'running', startedAt: { $gte: new Date(Date.now() - 6 * HOUR) } }).lean();
  if (busy) throw Object.assign(new Error(`A ${kind} is already running (started ${busy.startedAt.toISOString()}).`), { status: 409 });
}

async function finish(doc, started, err) {
  doc.finishedAt = new Date();
  doc.durationMs = Date.now() - started;
  doc.status = err ? 'failed' : 'succeeded';
  doc.error = err ? redact(err.message) : null;
  await doc.save();
  return doc;
}

/** Start a backup. Returns the run document right away; `done` settles when it finishes. */
async function startBackup({ trigger = 'cron', by = null } = {}) {
  const c = requireReady();
  await assertIdle('backup');
  await fs.promises.mkdir(c.dir, { recursive: true });
  const db = mongoose.connection.db;
  const started = Date.now();
  const stamp = new Date(started).toISOString().replace(/[:.]/g, '-');
  const file = path.join(c.dir, `${db.databaseName}-${stamp}.archive.gz`);
  const doc = await BackupRun.create({ kind: 'backup', trigger, by, host: os.hostname(), database: db.databaseName, startedAt: new Date(started), file: path.basename(file) });

  const done = (async () => {
    try {
      doc.collections = await collectionCounts(db);
      await withUriConfig(c.dir, (cfg) => run(c.mongodump, [cfg, `--db=${db.databaseName}`, `--archive=${file}`, '--gzip']));
      doc.sizeBytes = (await fs.promises.stat(file)).size;
      doc.sha256 = await sha256(file);
      if (c.offsiteCmd) {
        const [bin, ...args] = offsiteArgs(c.offsiteCmd, file);
        try {
          await run(bin, args, 2 * HOUR);
          doc.offsite = { status: 'succeeded', at: new Date() };
        } catch (e) {
          doc.offsite = { status: 'failed', at: new Date(), error: redact(e.message) };
        }
      }
      await finish(doc, started);
      await prune().catch(() => {});
    } catch (e) {
      await fs.promises.rm(file, { force: true });
      await finish(doc, started, e);
    }
    return doc;
  })();
  return { run: doc, done };
}

/** Restore a backup into a scratch database, compare counts, drop it. */
async function startDrill({ backupId = null, trigger = 'cron', by = null } = {}) {
  const c = requireReady();
  await assertIdle('drill');
  const query = { kind: 'backup', status: 'succeeded', deletedAt: null, ...(backupId ? { _id: backupId } : {}) };
  const backup = await BackupRun.findOne(query).sort({ startedAt: -1 });
  if (!backup) throw Object.assign(new Error('No restorable backup found.'), { status: 404 });
  const source = backup.database;
  const target = `${source}${DRILL_SUFFIX}`;
  if (target === mongoose.connection.db.databaseName || !target.endsWith(DRILL_SUFFIX)) throw new Error('Refusing to restore into the live database.');

  const started = Date.now();
  const doc = await BackupRun.create({ kind: 'drill', trigger, by, host: os.hostname(), database: source, startedAt: new Date(started), backupId: backup._id, restoredDb: target, file: backup.file });
  const scratch = mongoose.connection.client.db(target);

  const done = (async () => {
    try {
      const file = path.join(c.dir, backup.file);
      if ((await sha256(file)) !== backup.sha256) throw new Error('Checksum mismatch: the backup file changed or is corrupt.');
      await scratch.dropDatabase();
      await withUriConfig(c.dir, (cfg) =>
        run(c.mongorestore, [cfg, `--archive=${file}`, '--gzip', `--nsInclude=${source}.*`, `--nsFrom=${source}.*`, `--nsTo=${target}.*`, '--drop', '--stopOnError'])
      );
      doc.mismatches = compareCounts(backup.collections || [], await collectionCounts(scratch));
      await finish(doc, started, doc.mismatches.length ? new Error(`${doc.mismatches.length} collection(s) restored with a different document count`) : null);
    } catch (e) {
      await finish(doc, started, e);
    } finally {
      await scratch.dropDatabase().catch(() => {});
    }
    return doc;
  })();
  return { run: doc, done };
}

/** Delete dump files past retention, always keeping the newest KEEP_AT_LEAST. */
async function prune() {
  const c = config();
  if (!c.dir) return 0;
  const keep = await BackupRun.find({ kind: 'backup', status: 'succeeded', deletedAt: null }).sort({ startedAt: -1 }).limit(KEEP_AT_LEAST).select('_id').lean();
  const old = await BackupRun.find({
    kind: 'backup',
    deletedAt: null,
    file: { $ne: null },
    startedAt: { $lt: new Date(Date.now() - c.retentionDays * 24 * HOUR) },
    _id: { $nin: keep.map((k) => k._id) },
  });
  for (const b of old) {
    await fs.promises.rm(path.join(c.dir, path.basename(b.file)), { force: true });
    b.deletedAt = new Date();
    await b.save();
  }
  return old.length;
}

let toolsCache = null;
async function toolsVersion() {
  if (toolsCache && Date.now() - toolsCache.at < 10 * 60 * 1000) return toolsCache.value;
  const c = config();
  const version = (bin) =>
    new Promise((resolve) => {
      let out = '';
      const p = spawn(bin, ['--version'], { windowsHide: true });
      p.stdout.on('data', (d) => (out += d));
      p.on('error', () => resolve(null));
      p.on('close', (code) => resolve(code === 0 ? (out.match(/version:\s*(\S+)/) || [])[1] || 'installed' : null));
    });
  const [mongodump, mongorestore] = await Promise.all([version(c.mongodump), version(c.mongorestore)]);
  toolsCache = { at: Date.now(), value: { mongodump, mongorestore } };
  return toolsCache.value;
}

async function diskFree(dir) {
  try {
    const s = await fs.promises.statfs(dir);
    return { freeBytes: s.bavail * s.bsize, totalBytes: s.blocks * s.bsize };
  } catch {
    return null;
  }
}

module.exports = { config, startBackup, startDrill, prune, toolsVersion, diskFree, compareCounts, offsiteArgs, redact, DRILL_SUFFIX };
