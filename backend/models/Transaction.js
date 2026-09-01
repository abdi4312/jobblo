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
     * When an `extra_contact` purchase was spent.
     *
     * There was no such field, so checkSubscription treated the mere existence of a
     * succeeded transaction as a standing permission: one purchase unlocked that
     * service for that user permanently and without limit. One purchase is one use.
     *
     * Null means unspent. The middleware claims it with a single atomic
     * findOneAndUpdate on `consumedAt: null`, so two concurrent applications cannot
     * both spend it.
     */
    consumedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Supports the atomic claim in checkSubscription.
TransactionSchema.index({ userId: 1, serviceId: 1, type: 1, status: 1, consumedAt: 1 });

module.exports = mongoose.model('Transaction', TransactionSchema);
