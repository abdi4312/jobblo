const mongoose = require('mongoose');

/**
 * One row per (minute, service, op) of outbound calls to third parties — flushed by
 * services/monitoring/externalCalls.js. p95 is per minute; ranges combine count-weighted.
 */
const n = { type: Number, default: 0 };

const externalCallMinuteSchema = new mongoose.Schema(
  {
    minute: { type: Date, required: true },
    service: { type: String, required: true }, // stripe | openai | ...
    op: { type: String, required: true }, // "POST /v1/payment_intents"
    count: n,
    failed: n, // 5xx, timeouts, network errors ('errors' is reserved by mongoose)
    rateLimited: n, // 429 / provider throttling
    clientErrors: n, // other 4xx (our bug or bad input, not the provider's fault)
    durSum: n,
    durMax: n,
    p95: n,
    lastError: { type: String, default: null },
  },
  { versionKey: false }
);

externalCallMinuteSchema.index({ minute: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
externalCallMinuteSchema.index({ service: 1, minute: -1 });

module.exports = mongoose.model('ExternalCallMinute', externalCallMinuteSchema);
