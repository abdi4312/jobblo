const mongoose = require('mongoose');

const subscriptionWebhookEventV2Schema = new mongoose.Schema(
  {
    stripeEventId: { type: String, required: true, trim: true },
    stripeMode: { type: String, enum: ['test', 'live'], required: true },
    eventType: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['received', 'processing', 'processed', 'failed', 'reconciled'],
      default: 'received',
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    receivedAt: { type: Date, default: Date.now },
    processedAt: Date,
    nextAttemptAt: Date,
    lastFailureAt: Date,
    lastErrorCode: String,
    lastErrorMessage: { type: String, maxlength: 500 },
    reconciledAt: Date,
    reconciliationOperationId: String,
  },
  { timestamps: true, collection: 'subscription_webhook_events_v2' }
);

subscriptionWebhookEventV2Schema.index(
  { stripeMode: 1, stripeEventId: 1 },
  { unique: true }
);
subscriptionWebhookEventV2Schema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model(
  'SubscriptionWebhookEventV2',
  subscriptionWebhookEventV2Schema
);
