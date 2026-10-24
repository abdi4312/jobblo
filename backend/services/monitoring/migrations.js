const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

/**
 * Database migration center. Jobblo has no migration framework: changes ship as one-off
 * scripts in backend/scripts. Instead of a "ran / not ran" ledger (which lies the moment
 * someone restores a backup), each known script has a detector that asks the DATABASE
 * whether its work is still outstanding. Read-only — scripts are run by a human from a
 * shell, following their own --dry-run / runbook. Nothing here executes them.
 */

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const DAY = 86_400_000;
const db = () => mongoose.connection.db;

async function dupGroups(collection, groupBy, match = {}) {
  const [r] = await db()
    .collection(collection)
    .aggregate([{ $match: match }, { $group: { _id: groupBy, n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $group: { _id: null, groups: { $sum: 1 }, extra: { $sum: { $subtract: ['$n', 1] } } } }])
    .toArray();
  return r || { groups: 0, extra: 0 };
}
async function indexes(collection) {
  try {
    return await db().collection(collection).indexes();
  } catch {
    return [];
  }
}

const MIGRATIONS = [
  {
    script: 'migrate-admin-role.js',
    title: 'Retire the "admin" role',
    kind: 'data',
    reversible: true,
    run: 'node scripts/migrate-admin-role.js --dry-run, then --apply',
    async detect() {
      const n = await db().collection('users').countDocuments({ role: 'admin' });
      return { pending: n > 0, detail: n ? `${n} user(s) still have role "admin" (not in the schema enum)` : 'No users with role "admin".' };
    },
  },
  {
    script: 'fix-phone-index.js',
    title: 'Drop the unique phone index',
    kind: 'index',
    reversible: true,
    run: 'node scripts/fix-phone-index.js --apply',
    async detect() {
      const idx = (await indexes('users')).find((i) => i.key?.phone === 1 && i.unique);
      return { pending: Boolean(idx), detail: idx ? `Unique index ${idx.name} still exists — second user with an empty phone fails with E11000.` : 'No unique phone index.' };
    },
  },
  {
    script: 'migrate-subscription-usage-period-index.js',
    title: 'Usage period unique per user, not per subscription',
    kind: 'index',
    reversible: true,
    run: 'node scripts/migrate-subscription-usage-period-index.js',
    async detect() {
      const idx = await indexes('subscription_usage_periods');
      const oldUnique = idx.find((i) => i.unique && i.key?.subscriptionId === 1 && i.key?.billingPeriodStart === 1);
      const newUnique = idx.find((i) => i.unique && i.key?.userId === 1 && i.key?.billingPeriodStart === 1);
      if (!idx.length) return { pending: false, detail: 'Collection not created yet.' };
      return { pending: Boolean(oldUnique || !newUnique), detail: oldUnique ? 'Old unique (subscriptionId, billingPeriodStart) index still present.' : !newUnique ? 'Unique (userId, billingPeriodStart) index missing.' : 'Indexes match the target.' };
    },
  },
  {
    script: 'dedupe-payment-records.js',
    title: 'Remove duplicate Payments and pending applications',
    kind: 'data',
    reversible: false,
    destructive: true,
    run: 'node scripts/dedupe-payment-records.js (report), then --apply — only with a verified backup',
    async detect() {
      const [p, j] = await Promise.all([dupGroups('payments', '$orderId'), dupGroups('jobrequests', { s: '$serviceId', c: '$customerId' }, { status: 'pending' })]);
      return {
        pending: p.groups + j.groups > 0,
        detail: `${p.groups} order(s) with duplicate Payments (${p.extra} extra rows), ${j.groups} duplicate pending application group(s). Blocks the unique indexes.`,
      };
    },
  },
  {
    script: 'archive-orphan-duplicate-payments.js',
    title: 'Archive orphan duplicate Payments',
    kind: 'data',
    reversible: true,
    destructive: true,
    run: 'Follow docs/runbooks/duplicate-payments-archive.md (backup, manual review, Stripe verification, maintenance window).',
    async detect() {
      const rows = await db()
        .collection('payments')
        .aggregate([
          { $group: { _id: '$orderId', n: { $sum: 1 }, refs: { $sum: { $cond: [{ $or: [{ $gt: ['$stripePaymentIntentId', null] }, { $gt: ['$stripeSessionId', null] }] }, 1, 0] } } } },
          { $match: { n: { $gt: 1 }, refs: 0 } },
          { $lookup: { from: 'orders', localField: '_id', foreignField: '_id', as: 'o' } },
          { $match: { o: { $size: 0 } } },
          { $count: 'n' },
        ])
        .toArray();
      const n = rows[0]?.n || 0;
      return { pending: n > 0, detail: n ? `${n} duplicate group(s) with no order and no Stripe reference — candidates for the runbook, not for a shortcut.` : 'No orphan duplicate groups.' };
    },
  },
  {
    script: 'merge-duplicate-chats.js',
    title: 'Merge duplicated chat conversations',
    kind: 'data',
    reversible: false,
    destructive: true,
    run: 'node scripts/merge-duplicate-chats.js (report), then --apply',
    async detect() {
      const coll = mongoose.model('Chat').collection.collectionName;
      const r = await dupGroups(coll, { s: '$serviceId', a: { $min: ['$clientId', '$providerId'] }, b: { $max: ['$clientId', '$providerId'] } }, { serviceId: { $ne: null } });
      return { pending: r.groups > 0, detail: r.groups ? `${r.groups} person-pair/job combination(s) have more than one conversation.` : 'No duplicated conversations.' };
    },
  },
  {
    script: 'backfillOgImages.js',
    title: 'Backfill share-card (OG) images',
    kind: 'data',
    reversible: true,
    run: 'node scripts/backfillOgImages.js --dry, then without --dry',
    async detect() {
      const rows = await db()
        .collection('services')
        .find({ 'images.0': /blob\.core\.windows\.net/ })
        .project({ images: { $slice: 1 }, imageMetadata: 1 })
        .toArray();
      const n = rows.filter((s) => !(s.imageMetadata || []).some((m) => m && m.url === s.images[0] && m.ogUrl)).length;
      return { pending: n > 0, detail: n ? `${n} Azure listing(s) without an OG image — their share cards show a small thumbnail.` : 'Every Azure listing has an OG image.' };
    },
  },
];

const MIGRATION_LIKE = /^(migrate|fix|dedupe|merge|backfill|archive)[-_a-z0-9]*\.js$/i;

/** Pure: required and enum rules mongoose will enforce on save. Unit-tested. */
function schemaRules(schema) {
  const rules = [];
  schema.eachPath((p, type) => {
    if (p === '_id' || p === '__v' || p.includes('.$')) return;
    const enumValues = type.instance === 'String' ? type.enumValues || [] : [];
    if (enumValues.length) rules.push({ path: p, rule: 'enum', values: enumValues });
    if (type.options?.required === true && type.options.default === undefined && !type.options.validate) rules.push({ path: p, rule: 'required' });
  });
  return rules;
}

/** Documents the current models would reject on save — written by older code or outside mongoose. */
async function schemaCompatibility() {
  const out = [];
  for (const name of mongoose.modelNames()) {
    const Model = mongoose.model(name);
    const rules = schemaRules(Model.schema);
    if (!rules.length) continue;
    const results = await Promise.all(
      rules.map(async (r) => {
        const filter = r.rule === 'enum' ? { [r.path]: { $exists: true, $nin: [...r.values, null] } } : { [r.path]: null };
        try {
          const count = await Model.collection.countDocuments(filter, { maxTimeMS: 3000 });
          if (!count) return null;
          const sample = await Model.collection.findOne(filter, { projection: { [r.path]: 1 } });
          const value = r.path.split('.').reduce((v, k) => v?.[k], sample);
          return { model: name, collection: Model.collection.collectionName, path: r.path, rule: r.rule, count, sampleId: String(sample?._id || ''), value: r.rule === 'enum' ? String(value) : null, allowed: r.rule === 'enum' ? r.values : undefined };
        } catch {
          return null;
        }
      })
    );
    out.push(...results.filter(Boolean));
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Mobile app versions still in use that predate a breaking API contract change. */
async function incompatibleClients() {
  const since = new Date(Date.now() - 7 * DAY);
  const [versions, breaking] = await Promise.all([
    require('../../models/MobileEvent').aggregate([
      { $match: { type: 'session', appVersion: { $ne: null } } },
      { $group: { _id: { v: '$appVersion', p: '$platform' }, firstSeen: { $min: '$at' }, lastSeen: { $max: '$at' }, recent: { $sum: { $cond: [{ $gte: ['$at', since] }, 1, 0] } } } },
      { $match: { lastSeen: { $gte: since } } },
      { $sort: { firstSeen: -1 } },
    ]),
    require('../../models/ContractEvent').find({ breaking: true }).sort({ at: -1 }).limit(200).select('at method route path kind version acknowledgedAt').lean(),
  ]);
  return versions.map((v) => {
    const after = breaking.filter((b) => b.at > v.firstSeen);
    return {
      version: v._id.v,
      platform: v._id.p,
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
      sessions7d: v.recent,
      breakingSince: after.length,
      routes: [...new Set(after.map((b) => `${b.method} ${b.route}`))].slice(0, 8),
    };
  });
}

function check(key, label, state, detail) {
  return { key, label, state, detail };
}

async function rollbackReadiness({ pendingDestructive, indexProblems, schemaIssues }) {
  const BackupRun = require('../../models/BackupRun');
  const [backup, drill, releases] = await Promise.all([
    BackupRun.findOne({ kind: 'backup', status: 'succeeded' }).sort({ finishedAt: -1 }).select('finishedAt file sizeBytes').lean(),
    BackupRun.findOne({ kind: 'drill', status: 'succeeded' }).sort({ finishedAt: -1 }).select('finishedAt').lean(),
    require('../../models/Deployment').find().sort({ deployedAt: -1 }).limit(2).select('version commit deployedAt').lean(),
  ]);
  const age = (d) => (d ? (Date.now() - +new Date(d)) / DAY : Infinity);
  return [
    check('backup', 'Recent verified backup', !backup ? 'fail' : age(backup.finishedAt) <= 1.1 ? 'pass' : age(backup.finishedAt) <= 3 ? 'warn' : 'fail', backup ? `Last backup ${backup.finishedAt.toISOString()}${backup.file ? ` (${backup.file})` : ''}.` : 'No successful backup recorded — a bad migration cannot be undone.'),
    check('drill', 'Restore drill in the last 30 days', !drill ? 'fail' : age(drill.finishedAt) <= 30 ? 'pass' : 'warn', drill ? `Last drill passed ${drill.finishedAt.toISOString()}.` : 'No restore has ever been proven to work.'),
    check('previous', 'Previous release recorded', releases.length >= 2 ? 'pass' : 'warn', releases.length >= 2 ? `Roll back to ${releases[1].version}${releases[1].commit ? ` (${String(releases[1].commit).slice(0, 7)})` : ''}.` : 'Only one release recorded; the rollback target is not known.'),
    check('indexes', 'No unique index missing', indexProblems ? 'fail' : 'pass', indexProblems ? `${indexProblems} unique index(es) missing or not unique — duplicates can be written right now.` : 'All declared unique indexes exist.'),
    check('schema', 'Data matches the current schema', schemaIssues ? 'warn' : 'pass', schemaIssues ? `${schemaIssues} field rule(s) violated by stored documents; saving those documents fails validation.` : 'No stored document breaks a required/enum rule.'),
    check('destructive', 'No destructive migration pending', pendingDestructive.length ? 'warn' : 'pass', pendingDestructive.length ? `Pending: ${pendingDestructive.join(', ')}. Take and verify a backup before running.` : 'Nothing destructive outstanding.'),
  ];
}

let cache = { at: 0, value: null };
async function overview({ force = false } = {}) {
  // ponytail: one count per required/enum field of every model (a few hundred queries); cached 10 min.
  if (!force && cache.value && Date.now() - cache.at < 10 * 60 * 1000) return cache.value;
  const migrations = await Promise.all(
    MIGRATIONS.map(async (m) => {
      const { detect, ...meta } = m;
      try {
        return { ...meta, ...(await detect()) };
      } catch (e) {
        return { ...meta, pending: null, detail: `Detector failed: ${e.message}` };
      }
    })
  );
  const known = new Set(MIGRATIONS.map((m) => m.script));
  let unregistered = [];
  try {
    unregistered = fs.readdirSync(SCRIPTS_DIR).filter((f) => MIGRATION_LIKE.test(f) && !known.has(f));
  } catch {
    /* scripts folder not shipped in this image */
  }
  const [indexRows, schema, clients] = await Promise.all([require('../../controllers/developer/integrityController').indexCheck(), schemaCompatibility(), incompatibleClients()]);
  const indexChanges = indexRows.filter((i) => i.severity !== 'info');
  const value = {
    at: new Date(),
    migrations,
    unregistered,
    indexChanges,
    undeclaredIndexes: indexRows.filter((i) => i.severity === 'info'),
    schema,
    clients,
    rollback: await rollbackReadiness({
      pendingDestructive: migrations.filter((m) => m.pending && m.destructive).map((m) => m.script),
      indexProblems: indexChanges.filter((i) => i.unique).length,
      schemaIssues: schema.length,
    }),
  };
  cache = { at: Date.now(), value };
  return value;
}

module.exports = { MIGRATIONS, schemaRules, overview, incompatibleClients };
