const mongoose = require('mongoose');

const planChangeSchema = new mongoose.Schema(
  {
    targetPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    targetPlanType: { type: String, enum: ['business', 'private'], required: true },
    effectiveAt: { type: Date, required: true },
    operationId: { type: String, required: true },
    stripeScheduleId: String,
    targetStripePriceId: { type: String, required: true },
  },
  { _id: false }
);

const planHistorySchema = new mongoose.Schema(
  {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
    planName: { type: String, required: true },
    planPrice: { type: Number, required: true, min: 0 },
    planType: { type: String, enum: ['business', 'private'], required: true },
    stripeMode: { type: String, enum: ['test', 'live'], required: true },
    stripeSubscriptionId: { type: String, required: true },
    stripePriceId: String,
    periodStart: Date,
    periodEnd: Date,
    changeType: {
      type: String,
      enum: ['initial', 'upgrade', 'downgrade', 'renewal', 'cancellation', 'resumption'],
      required: true,
    },
    operationId: String,
    effectiveAt: { type: Date, required: true },
  },
  { _id: false }
);

const withdrawalEvidenceSchema = new mongoose.Schema(
  {
    informationVersion: { type: String, trim: true },
    informationPresentedAt: Date,
    earlyServiceStartRequestedAt: Date,
    proRataPaymentAcknowledgedAt: Date,
    withdrawalRequestedAt: Date,
    resolutionOperationId: String,
  },
  { _id: false }
);

const subscriptionV2Schema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
      required: true,
    },
    planType: { type: String, enum: ['business', 'private'], required: true },
    stripeCustomerId: { type: String, required: true, trim: true },
    stripeSubscriptionId: { type: String, required: true, trim: true },
    stripePriceId: { type: String, trim: true },
    stripeMode: { type: String, enum: ['test', 'live'], required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'past_due', 'canceling', 'canceled', 'expired'],
      required: true,
      default: 'pending',
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    nextRenewalAt: Date,
    autoRenew: { type: Boolean, default: true },
    cancellationEffectiveAt: Date,
    pendingPlanChange: planChangeSchema,
    planHistory: { type: [planHistorySchema], default: [] },
    firstPaymentFailureAt: Date,
    gracePeriodEndsAt: Date,
    recoveryInvoiceId: { type: String, trim: true },
    recoveryUsagePeriodStart: Date,
    recoveryLeaseUntil: Date,
    recoveryHistory: [{
      invoiceId: { type: String, required: true },
      action: {
        type: String,
        enum: [
          'started',
          'recovered',
          'canceled',
          'reconciliation_required',
          'late_payment_reconciliation_required',
        ],
        required: true,
      },
      at: { type: Date, required: true },
      operationId: String,
    }],
    paymentRecoveryStatus: {
      type: String,
      enum: ['none', 'retrying', 'recovered', 'exhausted'],
      default: 'none',
    },
    withdrawalEvidence: withdrawalEvidenceSchema,
  },
  { timestamps: true, collection: 'subscription_v2' }
);

subscriptionV2Schema.path('currentPeriodEnd').validate(function (periodEnd) {
  const update = typeof this.getUpdate === 'function' ? this.getUpdate() : null;
  const periodStart = this.currentPeriodStart ||
    update?.$set?.currentPeriodStart ||
    update?.$setOnInsert?.currentPeriodStart ||
    update?.currentPeriodStart;
  if (!update && periodStart == null && periodEnd == null) return true;
  return periodStart instanceof Date && periodEnd instanceof Date && periodEnd > periodStart;
}, 'Billing period end must be after its start, and both dates must be provided together.');

subscriptionV2Schema.index({ userId: 1 }, { unique: true });
subscriptionV2Schema.index(
  { stripeMode: 1, stripeSubscriptionId: 1 },
  { unique: true }
);
subscriptionV2Schema.index({ status: 1, currentPeriodEnd: 1 });
subscriptionV2Schema.index({ stripeMode: 1, stripeCustomerId: 1 });
subscriptionV2Schema.index({ paymentRecoveryStatus: 1, gracePeriodEndsAt: 1 });

module.exports = mongoose.model('SubscriptionV2', subscriptionV2Schema);
