const mongoose = require('mongoose');

const subscriptionBillingOperationV2Schema = new mongoose.Schema(
  {
    operationId: { type: String, required: true, trim: true },
    idempotencyKey: { type: String, required: true, trim: true },
    stripeMode: { type: String, enum: ['test', 'live'], required: true },
    operationType: {
      type: String,
      enum: [
        'checkout',
        'cancel',
        'resume',
        'upgrade',
        'downgrade',
        'cancel_plan_change',
        'renewal_recovery',
        'refund',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'reconciliation_required'],
      default: 'pending',
      required: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionV2' },
    targetPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    stripePriceId: String,
    stripeCustomerId: String,
    stripeCheckoutSessionId: String,
    stripeSubscriptionId: String,
    stripeInvoiceId: String,
    stripeScheduleId: String,
    lifecycleLock: { type: Boolean, default: false },
    prorationDate: Date,
    attempts: { type: Number, default: 0, min: 0 },
    lastErrorCode: String,
    lastErrorType: String,
    lastErrorHttpStatus: Number,
    stripeRequestId: String,
    lastFailureStage: String,
    lastErrorMessage: { type: String, maxlength: 500 },
    attemptedAt: Date,
    completedAt: Date,
    failedAt: Date,
  },
  { timestamps: true, collection: 'subscription_billing_operations_v2' }
);

subscriptionBillingOperationV2Schema.index(
  { stripeMode: 1, operationId: 1 },
  { unique: true }
);
subscriptionBillingOperationV2Schema.index(
  { stripeMode: 1, idempotencyKey: 1 },
  { unique: true }
);
subscriptionBillingOperationV2Schema.index({ userId: 1, createdAt: -1 });
subscriptionBillingOperationV2Schema.index(
  { userId: 1, operationType: 1 },
  {
    unique: true,
    partialFilterExpression: { operationType: 'checkout', status: 'pending' },
  }
);
subscriptionBillingOperationV2Schema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { lifecycleLock: true },
  }
);

module.exports = mongoose.model(
  'SubscriptionBillingOperationV2',
  subscriptionBillingOperationV2Schema
);
