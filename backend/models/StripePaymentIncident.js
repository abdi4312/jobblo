const mongoose = require('mongoose');

const stripePaymentIncidentSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, trim: true },
    eventType: { type: String, required: true, trim: true },
    kind: {
      type: String,
      enum: ['charge_dispute', 'charge_refund', 'refund', 'duplicate_payment', 'unmatched'],
      required: true,
    },
    status: {
      type: String,
      enum: ['manual_review', 'reconciled'],
      default: 'manual_review',
      index: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    paymentIntentId: String,
    originalPaymentIntentId: String,
    duplicatePaymentIntentId: String,
    checkoutSessionId: String,
    originalCheckoutSessionId: String,
    duplicateCheckoutSessionId: String,
    stripeCustomerId: String,
    chargeId: String,
    originalChargeId: String,
    providerTransferId: String,
    transferReversedAmount: { type: Number, min: 0 },
    stripeDisputeId: { type: String, index: true },
    disputeStatus: String,
    disputeReason: String,
    evidenceDueAt: Date,
    previousOrderStatus: String,
    stripeObjectId: String,
    livemode: { type: Boolean, required: true },
    amount: Number,
    amountRefunded: Number,
    currency: String,
    reason: String,
    lastError: String,
    resolutionOperationId: { type: mongoose.Schema.Types.ObjectId, ref: 'StripeFinancialOperation' },
    adminAlertedAt: Date,
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

stripePaymentIncidentSchema.index({ orderId: 1, createdAt: -1 });
stripePaymentIncidentSchema.index({ paymentIntentId: 1, createdAt: -1 });

module.exports = mongoose.model('StripePaymentIncident', stripePaymentIncidentSchema);
