const mongoose = require('mongoose');

const subscriptionRecoveryEmailV2Schema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionV2',
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stripeMode: { type: String, enum: ['test', 'live'], required: true },
    invoiceId: { type: String, required: true, trim: true },
    kind: {
      type: String,
      required: true,
      match: /^(payment_failed|reminder_day_[1-6]|payment_recovered|subscription_canceled)$/,
    },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'canceled'],
      default: 'pending',
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: Date,
    claimedAt: Date,
    sentAt: Date,
    lastError: { type: String, maxlength: 500 },
  },
  { timestamps: true, collection: 'subscription_recovery_emails_v2' }
);

subscriptionRecoveryEmailV2Schema.index(
  { stripeMode: 1, invoiceId: 1, kind: 1 },
  { unique: true }
);
subscriptionRecoveryEmailV2Schema.index({ status: 1, scheduledAt: 1, nextAttemptAt: 1 });

module.exports = mongoose.model(
  'SubscriptionRecoveryEmailV2',
  subscriptionRecoveryEmailV2Schema
);
