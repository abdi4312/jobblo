const mongoose = require('mongoose');

const stripeBillingOperationSchema = new mongoose.Schema(
  {
    operationId: { type: String, required: true, unique: true, trim: true },
    fingerprint: { type: String, required: true, trim: true },
    activeSubscriptionKey: { type: String, trim: true },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    operationType: {
      type: String,
      enum: ['cancel', 'resume', 'upgrade', 'downgrade'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'reconciliation_required'],
      required: true,
      default: 'pending',
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subscriptionId: { type: String, required: true, trim: true },
    targetPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    stripeMode: { type: String, enum: ['test', 'live'], required: true },
    stripeObjectId: String,
    failureCode: String,
  },
  { timestamps: true }
);

stripeBillingOperationSchema.index(
  { fingerprint: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'reconciliation_required'] } },
  }
);
stripeBillingOperationSchema.index({ activeSubscriptionKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('StripeBillingOperation', stripeBillingOperationSchema);
