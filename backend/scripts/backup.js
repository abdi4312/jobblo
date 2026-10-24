#!/usr/bin/env node
/**
 * Database backup / restore drill for host cron (see docs/runbooks/disaster-recovery.md).
 *
 *   node scripts/backup.js backup         dump the database to BACKUP_DIR (+ offsite copy)
 *   node scripts/backup.js drill [runId]  restore the latest (or given) backup into a scratch DB and verify
 *   node scripts/backup.js prune          delete dumps past BACKUP_RETENTION_DAYS
 *
 * Exits non-zero on failure so cron / systemd can alert.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const backup = require('../services/backup');

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  let ok = true;
  if (cmd === 'backup' || cmd === 'drill') {
    const { done } = cmd === 'backup' ? await backup.startBackup({ trigger: 'cron' }) : await backup.startDrill({ backupId: arg || null, trigger: 'cron' });
    const r = await done;
    ok = r.status === 'succeeded';
    console.log(JSON.stringify({ kind: r.kind, status: r.status, file: r.file, sizeBytes: r.sizeBytes, durationMs: r.durationMs, offsite: r.offsite?.status, mismatches: r.mismatches, error: r.error }));
  } else if (cmd === 'prune') {
    console.log(JSON.stringify({ pruned: await backup.prune() }));
  } else {
    console.error('usage: node scripts/backup.js backup | drill [runId] | prune');
    ok = false;
  }
  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
})().catch(async (e) => {
  console.error(backup.redact(e.message));
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
