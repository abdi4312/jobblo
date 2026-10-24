const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const BackupRun = require('../../models/BackupRun');
const backup = require('../../services/backup');
const atlas = require('../../services/backup/atlas');

const HOUR = 60 * 60 * 1000;

/** Backup & disaster recovery status: freshness vs. RPO, last verified restore, storage, Atlas. */
const getBackups = asyncHandler(async (req, res) => {
  const c = backup.config();
  const [runs, lastSuccess, lastDrill, retained, tools, disk, cloud] = await Promise.all([
    BackupRun.find().sort({ startedAt: -1 }).limit(60).populate('by', 'name').lean(),
    BackupRun.findOne({ kind: 'backup', status: 'succeeded' }).sort({ startedAt: -1 }).lean(),
    BackupRun.findOne({ kind: 'drill', status: { $ne: 'running' } }).sort({ startedAt: -1 }).lean(),
    BackupRun.aggregate([{ $match: { kind: 'backup', status: 'succeeded', deletedAt: null } }, { $group: { _id: null, n: { $sum: 1 }, bytes: { $sum: '$sizeBytes' } } }]),
    backup.toolsVersion(),
    c.dir ? backup.diskFree(c.dir) : null,
    atlas.listSnapshots(),
  ]);
  const newestCloud = cloud.snapshots.find((s) => s.status === 'completed');
  const lastAt = [lastSuccess?.startedAt, newestCloud?.createdAt].filter(Boolean).map((d) => new Date(d)).sort((a, b) => b - a)[0] || null;
  const ageHours = lastAt ? (Date.now() - lastAt) / HOUR : null;

  return sendSuccess(res, {
    config: {
      configured: Boolean(c.dir),
      dir: c.dir,
      database: mongoose.connection.db?.databaseName || null,
      retentionDays: c.retentionDays,
      maxAgeHours: c.maxAgeHours,
      scheduleHours: c.scheduleHours,
      offsite: Boolean(c.offsiteCmd),
      tools,
    },
    rpo: { lastBackupAt: lastAt, ageHours, ok: ageHours !== null && ageHours <= c.maxAgeHours },
    lastDrill: lastDrill || null,
    storage: { retained: retained[0]?.n || 0, bytes: retained[0]?.bytes || 0, disk },
    runs,
    atlas: cloud,
  });
});

const fail = (res, e) => sendError(res, e.message, e.status || 500);
const audit = (req, description, metadata) =>
  logActivity({ adminId: req.user._id, action: 'other', description, metadata: { area: 'developer.backup', ...metadata }, ip: req.ip, userAgent: req.get('user-agent') || 'unknown' });

const runBackup = asyncHandler(async (req, res) => {
  try {
    const { run } = await backup.startBackup({ trigger: 'dashboard', by: req.user._id });
    await audit(req, 'Developer started a database backup', { runId: String(run._id) });
    return sendSuccess(res, { run }, 'Backup started.', null, 202);
  } catch (e) {
    return fail(res, e);
  }
});

const runDrill = asyncHandler(async (req, res) => {
  const backupId = req.body?.backupId;
  if (backupId && !mongoose.isValidObjectId(backupId)) return sendError(res, 'Invalid backupId.', 400);
  try {
    const { run } = await backup.startDrill({ backupId: backupId || null, trigger: 'dashboard', by: req.user._id });
    await audit(req, 'Developer started a restore drill', { runId: String(run._id), backupId: String(run.backupId) });
    return sendSuccess(res, { run }, 'Restore drill started.', null, 202);
  } catch (e) {
    return fail(res, e);
  }
});

module.exports = { getBackups, runBackup, runDrill };
