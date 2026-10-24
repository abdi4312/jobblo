const mongoose = require('mongoose');

/**
 * Metered third-party usage that has a price (today: OpenAI tokens), written by
 * services/monitoring/costs.js. Counts only — never prompts, images or answers.
 * Kept 400 days so month-over-month cost history survives.
 */
const usageRecordSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    kind: { type: String, enum: ['ai'], required: true },
    model: { type: String, default: null },
    feature: { type: String, default: null },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
  },
  { versionKey: false }
);

usageRecordSchema.index({ kind: 1, at: -1 });
usageRecordSchema.index({ at: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 });

module.exports = mongoose.model('UsageRecord', usageRecordSchema);
