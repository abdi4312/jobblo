const mongoose = require('mongoose');

const safePayHistorySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    serviceTitle: { type: String, required: true },
    amounts: {
      agreedPrice: { type: Number, required: true, min: 0 },
      fee: { type: Number, required: true, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      totalCustomer: { type: Number, required: true, min: 0 },
      netProvider: { type: Number, required: true, min: 0 },
    },
    status: {
      type: String,
      enum: [
        'pending',
        'payment_received',
        'waiting_connect',
        'refund_pending',
        'refund_failed',
        'automatically_cancelled',
        'in_progress',
        'completed',
        'refunded',
        'cancelled',
        'disputed',
      ],
      default: 'pending',
    },
    paymentDate: { type: Date },
    providerConnectStatus: {
      type: String,
      enum: ['pending', 'ready', 'verification_retry'],
    },
    originalPaymentAmountMinor: { type: Number, min: 0 },
    refundAmountMinor: { type: Number, min: 0, default: 0 },
    refundedAmountMinor: { type: Number, min: 0, default: 0 },
    refundStatus: {
      type: String,
      enum: ['none', 'pending', 'succeeded', 'failed', 'reconciliation_required'],
      default: 'none',
    },
    refundReason: String,
    cancellationReason: String,
    stripePaymentIntentId: String,
    stripeRefundId: String,
    paymentMethodBrand: String,
    paymentMethodLast4: { type: String, match: /^\d{4}$/ },
    stripeLivemode: Boolean,
    refundCompletedAt: Date,
    refundFailedAt: Date,
    providerConnectDeadlineDays: Number,
    providerConnectDeadlineAt: Date,
    ratings: {
      overall: { type: Number, min: 1, max: 5 },
      punctuality: { type: Number, min: 1, max: 5 },
      quality: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      tidiness: { type: Number, min: 1, max: 5 },
    },
    reviewComment: { type: String },
    transactionId: { type: String },
    paymentProvider: { type: String, default: 'stripe' },
  },
  { timestamps: true }
);

// Create compound indexes for faster queries
safePayHistorySchema.index({ customerId: 1, createdAt: -1 });
safePayHistorySchema.index({ providerId: 1, createdAt: -1 });
safePayHistorySchema.index({ orderId: 1, createdAt: -1 });

module.exports = mongoose.model('SafePayHistory', safePayHistorySchema);
