const mongoose = require('mongoose');

const stripeWebhookHealthSchema = new mongoose.Schema(
  {
    _id: { type: String, enum: ['test', 'live'], required: true },
    mode: { type: String, enum: ['test', 'live'], required: true },
    configurationFingerprint: { type: String, required: true },
    status: {
      type: String,
      enum: ['healthy', 'delivery_problem'],
      required: true,
    },
    lastVerifiedAt: { type: Date, default: null },
    lastDeliveryAt: { type: Date, default: null },
    lastEventId: { type: String, default: null },
    lastFailureAt: { type: Date, default: null },
    lastFailureCode: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StripeWebhookHealth', stripeWebhookHealthSchema);
