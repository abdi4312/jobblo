const mongoose = require('mongoose');

/** One fault-injection experiment (staging only) — see services/monitoring/faults.js. */
const failureExperimentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['http_latency', 'http_error', 'stripe', 'email', 'push', 'stripe_webhook', 'scheduler'], required: true },
    target: { type: String, default: null }, // route prefix for http_*, job name for scheduler
    latencyMs: { type: Number, default: null },
    errorRate: { type: Number, default: null }, // percent of matching requests
    statusCode: { type: Number, default: null },
    reason: { type: String, required: true, maxlength: 300 },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true, index: true },
    stoppedAt: { type: Date, default: null },
    stoppedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    environment: { type: String, default: null },
    host: { type: String, default: null },
  },
  { versionKey: false }
);

failureExperimentSchema.index({ startedAt: -1 });

module.exports = mongoose.model('FailureExperiment', failureExperimentSchema);
