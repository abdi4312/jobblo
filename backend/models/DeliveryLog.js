const mongoose = require('mongoose');

/** One row per outgoing email or push send. Recipients are masked. Kept 30 days. */
const deliveryLogSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    channel: { type: String, enum: ['email', 'push'], required: true },
    template: { type: String, default: null }, // email subject / push title
    status: { type: String, enum: ['sent', 'partial', 'failed', 'skipped'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    to: { type: String, default: null },
    latencyMs: { type: Number, default: null },
    accepted: { type: Number, default: null },
    rejected: { type: Number, default: null },
    error: { type: String, default: null },
    errorCode: { type: String, default: null },
  },
  { versionKey: false }
);

deliveryLogSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
deliveryLogSchema.index({ channel: 1, status: 1, at: -1 });

module.exports = mongoose.model('DeliveryLog', deliveryLogSchema);
