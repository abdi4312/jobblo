const mongoose = require('mongoose');

/** One row per scheduler job execution — written by services/scheduler/index.js. */
const schedulerRunSchema = new mongoose.Schema(
  {
    job: { type: String, required: true, index: true },
    startedAt: { type: Date, required: true },
    durationMs: { type: Number, default: 0 },
    ok: { type: Boolean, default: true, index: true },
    error: { type: String, default: null },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    trigger: { type: String, enum: ['schedule', 'manual'], default: 'schedule' },
  },
  { versionKey: false }
);

schedulerRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
schedulerRunSchema.index({ job: 1, startedAt: -1 });

module.exports = mongoose.model('SchedulerRun', schedulerRunSchema);
