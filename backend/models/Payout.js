const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
      unique: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },

    // Money
    grossAmount: { type: Number, required: true, min: 0 },
    platformFee: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0, default: 0 },
    netProviderAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'nok', uppercase: true },

    // Source references
    stripePaymentIntentId: { type: String, trim: true },
    stripeCheckoutSessionId: { type: String, trim: true },
    safePayHistoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'SafePayHistory' },
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dispute' },

    // Release flow
    status: {
      type: String,
      enum: [
        'pending',
        'released_internal',
        'processing',
        'transferred',
        'failed',
        'cancelled',
      ],
      required: true,
      default: 'pending',
      index: true,
    },
    releaseSource: {
      type: String,
      enum: ['customer_approve', 'legacy_complete', 'dispute_release', 'admin_override'],
      required: true,
    },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Stripe Connect transfer
    stripeTransferId: { type: String, trim: true, index: true, unique: true, sparse: true },
    stripeConnectAccountId: { type: String, trim: true },
    transferInitiatedAt: { type: Date },
    transferCompletedAt: { type: Date },
    transferFailedAt: { type: Date },
    failureReason: { type: String, trim: true },
    failureCode: { type: String, trim: true },

    // Idempotency + audit
    idempotencyKey: { type: String, trim: true, unique: true, index: true, sparse: true },
    lastAttemptedAt: { type: Date },
    retryCount: { type: Number, default: 0, min: 0 },

    metadata: { type: Object, default: {} },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

payoutSchema.index({ providerId: 1, status: 1 });

/**
 * Transition helper — throws on invalid transitions so callers cannot lie about state.
 */
payoutSchema.methods.transitionTo = function (nextStatus, extra = {}) {
  const VALID_NEXT = {
    pending: ['released_internal', 'cancelled'],
    released_internal: ['processing', 'failed'],
    processing: ['transferred', 'failed'],
    transferred: [],
    failed: ['processing', 'cancelled'],
    cancelled: [],
  };
  const allowed = VALID_NEXT[this.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Invalid Payout status transition: ${this.status} → ${nextStatus}. Allowed: ${allowed.join(', ') || '(none)'}`
    );
  }
  this.status = nextStatus;
  if (nextStatus === 'processing') this.lastAttemptedAt = new Date();
  if (nextStatus === 'processing') this.retryCount = (this.retryCount || 0) + 1;
  if (nextStatus === 'transferred') this.transferCompletedAt = new Date();
  if (nextStatus === 'failed') this.transferFailedAt = new Date();
  Object.assign(this, extra);
};

module.exports = mongoose.model('Payout', payoutSchema);
