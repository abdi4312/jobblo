const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    planId: {
      type: String,
      required: true,
    },
    planType: {
      type: String,
      required: true,
    },
    planName: {
      type: String,
      required: true,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    discountCoupon: {
      type: String,
      default: null,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    stripeSessionId: {
      type: String,
      required: true,
      unique: true,
    },
    livemode: { type: Boolean, default: null },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'nok',
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
    },
    type: {
      type: String,
      enum: ['extra_contact', 'subscription'],
      required: true,
    },
    refunded: {
      type: Boolean,
      default: false,
    },
    /**
     * Retained to preserve historical extra-contact transactions for migration.
     * The legacy extra-contact purchase flow is disabled.
     */
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, serviceId: 1, type: 1, status: 1, consumedAt: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
