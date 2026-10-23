const mongoose = require('mongoose');

/**
 * One paid extra contact for one job, bought after the period's included contacts ran
 * out (services/subscriptions/v2ExtraContacts.js).
 *
 * pending  -> Checkout created, not paid yet (expires with the session)
 * paid     -> Stripe confirmed the payment; the next application to `serviceId` uses it
 * consumed -> used by that application (jobRequestId)
 * expired  -> the Checkout session expired unpaid
 */
const extraContactPurchaseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    billingPeriodStart: { type: Date, required: true },
    stripeMode: { type: String, enum: ['test', 'live'], required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'nok' },
    status: { type: String, enum: ['pending', 'paid', 'consumed', 'expired'], default: 'pending', required: true },
    checkoutSessionId: { type: String },
    paymentIntentId: { type: String },
    expiresAt: { type: Date, required: true },
    paidAt: Date,
    consumedAt: Date,
    jobRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRequest' },
  },
  { timestamps: true, collection: 'extra_contact_purchases' }
);

extraContactPurchaseSchema.index({ userId: 1, billingPeriodStart: 1, status: 1 });
extraContactPurchaseSchema.index({ userId: 1, serviceId: 1, status: 1 });
extraContactPurchaseSchema.index({ checkoutSessionId: 1 }, { unique: true, sparse: true });
// At most one open Checkout per user: the monthly maxContact count cannot be overshot by
// opening several sessions at once.
extraContactPurchaseSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' }, name: 'one_pending_per_user' }
);

module.exports = mongoose.model('ExtraContactPurchase', extraContactPurchaseSchema);
