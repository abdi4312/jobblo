const mongoose = require('mongoose');

/** One synthetic probe execution — written by services/monitoring/synthetic.js. */
const syntheticRunSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // built-in key or custom check id
    name: { type: String, required: true },
    at: { type: Date, required: true },
    ok: { type: Boolean, required: true },
    latencyMs: { type: Number, default: null },
    status: { type: Number, default: null }, // HTTP status of the failing (or last) step
    error: { type: String, default: null },
    steps: { type: [{ _id: false, name: String, ok: Boolean, status: Number, ms: Number, error: String }], default: undefined },
    trigger: { type: String, enum: ['schedule', 'manual'], default: 'schedule' },
  },
  { versionKey: false }
);

syntheticRunSchema.index({ key: 1, at: -1 });
syntheticRunSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('SyntheticRun', syntheticRunSchema);
