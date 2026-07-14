const mongoose = require('mongoose');

/**
 * Dispute model — tracks all SafePay contract disputes.
 * Payout is frozen while a dispute is open.
 * Resolution is controlled — no direct DB manipulation from frontend.
 */
const evidenceSchema = new mongoose.Schema(
  {
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String },
    description: { type: String, maxlength: 500 },
  },
  { timestamps: true, _id: true }
);

const disputeMessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderRole: { type: String, enum: ['customer', 'provider', 'admin', 'system'] },
    message: { type: String, required: true, maxlength: 2000 },
    attachments: [{ type: String }],
    // Internal notes are never visible to customer or provider
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: true, _id: true }
);

const timelineSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 500 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, _id: true }
);

const resolutionSchema = new mongoose.Schema(
  {
    outcome: {
      type: String,
      enum: [
        'release_to_provider',
        'full_refund_to_customer',
        'partial_refund',
        'split_payment',
        'cancel_without_payment',
        'no_action',
      ],
    },
    reason: { type: String, maxlength: 1000 },
    customerAmount: { type: Number, default: 0, min: 0 },
    providerAmount: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    stripeRefundId: { type: String },
    stripeRefundStatus: { type: String },
  },
  { _id: false }
);

const disputeSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    },
    safePayHistoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SafePayHistory',
    },
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },

    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    openedAgainst: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    reasonCategory: {
      type: String,
      required: true,
      enum: [
        'work_not_started',
        'work_not_completed',
        'poor_quality',
        'different_from_agreement',
        'customer_not_cooperating',
        'provider_not_cooperating',
        'payment_issue',
        'unauthorized_payment',
        'fraud_or_scam',
        'damaged_property',
        'missing_evidence',
        'other',
      ],
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },

    status: {
      type: String,
      enum: [
        'open',
        'under_review',
        'waiting_for_customer',
        'waiting_for_provider',
        'evidence_submitted',
        'resolved',
        'closed',
        'cancelled',
      ],
      default: 'open',
      index: true,
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },

    assignedAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    evidence: [evidenceSchema],
    messages: [disputeMessageSchema],
    timeline: [timelineSchema],

    resolution: resolutionSchema,

    // Whether payout is frozen due to this dispute
    payoutFrozen: { type: Boolean, default: true },

    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },

    // Idempotency — prevent duplicate dispute opens
    openedByRole: { type: String, enum: ['customer', 'provider'] },
  },
  { timestamps: true }
);

disputeSchema.index({ status: 1, createdAt: -1 });
disputeSchema.index({ assignedAdminId: 1, status: 1 });

module.exports = mongoose.model('Dispute', disputeSchema);
