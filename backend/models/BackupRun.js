const mongoose = require('mongoose');

/**
 * One row per backup or restore drill — written by services/backup (cron script or
 * dashboard). Kept for a year so backup history survives longer than the dumps.
 */
const backupRunSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['backup', 'drill'], required: true, index: true },
    status: { type: String, enum: ['running', 'succeeded', 'failed'], default: 'running', index: true },
    trigger: { type: String, enum: ['cron', 'dashboard'], default: 'cron' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    host: { type: String, default: null },
    database: { type: String, default: null },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
    error: { type: String, default: null },

    // backup
    file: { type: String, default: null }, // basename inside BACKUP_DIR
    sizeBytes: { type: Number, default: null },
    sha256: { type: String, default: null },
    collections: { type: [{ _id: false, name: String, count: Number }], default: undefined }, // source counts when the dump started
    offsite: {
      status: { type: String, enum: ['not_configured', 'succeeded', 'failed'], default: 'not_configured' },
      at: Date,
      error: String,
    },
    deletedAt: { type: Date, default: null }, // dump file pruned by retention

    // drill
    backupId: { type: mongoose.Schema.Types.ObjectId, ref: 'BackupRun', default: null },
    restoredDb: { type: String, default: null },
    mismatches: { type: [{ _id: false, name: String, expected: Number, actual: Number }], default: undefined },
  },
  { versionKey: false }
);

backupRunSchema.index({ kind: 1, startedAt: -1 });
backupRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('BackupRun', backupRunSchema);
