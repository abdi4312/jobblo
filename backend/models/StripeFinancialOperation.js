const mongoose = require('mongoose');

const stripeFinancialOperationSchema = new mongoose.Schema(
  {
    operationKey: { type: String, required: true, unique: true, trim: true },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: ['refund', 'transfer_reversal'], required: true },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'reconciliation_required'],
      required: true,
      default: 'pending',
      index: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute' },
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StripePaymentIncident' },
    stripeMode: { type: String, enum: ['test', 'live'], required: true },
    paymentIntentId: String,
    chargeId: String,
    transferId: String,
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, uppercase: true },
    stripeObjectId: String,
    attemptedAt: Date,
    completedAt: Date,
    failedAt: Date,
    lastErrorCode: String,
    lastErrorMessage: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

stripeFinancialOperationSchema.index({ orderId: 1, createdAt: -1 });
stripeFinancialOperationSchema.index({ disputeId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('StripeFinancialOperation', stripeFinancialOperationSchema);
