const mongoose = require('mongoose');

const contactOperationSchema = new mongoose.Schema(
  {
    operationId: { type: String, required: true, trim: true },
    status: { type: String, enum: ['consumed', 'released'], required: true },
  },
  { _id: false }
);

const subscriptionUsagePeriodSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionV2',
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan' },
    periodType: { type: String, enum: ['paid', 'free'], required: true },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    includedContacts: { type: Number, required: true, min: 0 },
    consumedIncludedContacts: { type: Number, default: 0, min: 0 },
    purchasedExtraContacts: { type: Number, default: 0, min: 0 },
    consumedExtraContacts: { type: Number, default: 0, min: 0 },
    contactOperations: { type: [contactOperationSchema], default: [] },
  },
  { timestamps: true, collection: 'subscription_usage_periods' }
);

subscriptionUsagePeriodSchema.path('billingPeriodEnd').validate(function (periodEnd) {
  const update = typeof this.getUpdate === 'function' ? this.getUpdate() : null;
  const periodStart = this.billingPeriodStart ||
    update?.$set?.billingPeriodStart ||
    update?.$setOnInsert?.billingPeriodStart ||
    update?.billingPeriodStart;
  return periodStart instanceof Date && periodEnd instanceof Date && periodEnd > periodStart;
}, 'Billing period end must be after its start.');

subscriptionUsagePeriodSchema.index({ userId: 1, billingPeriodStart: 1 }, { unique: true });
subscriptionUsagePeriodSchema.index({ subscriptionId: 1, billingPeriodStart: 1 });
subscriptionUsagePeriodSchema.index({ userId: 1, billingPeriodEnd: 1 });

module.exports = mongoose.model('SubscriptionUsagePeriod', subscriptionUsagePeriodSchema);
