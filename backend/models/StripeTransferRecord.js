const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema(
  {
    eventId: String,
    eventType: String,
    eventCreatedAt: Date,
    normalizedStatus: String,
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const stripeTransferRecordSchema = new mongoose.Schema(
  {
    stripeObjectId: { type: String, required: true, trim: true },
    stripeAccountId: { type: String, required: true, trim: true },
    livemode: { type: Boolean, required: true },
    payoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true, min: 0 },
    amountReversed: { type: Number, min: 0, default: 0 },
    currency: { type: String, required: true, uppercase: true },
    destinationPaymentId: String,
    sourceTransactionId: String,
    balanceTransactionId: String,
    reversed: { type: Boolean, default: false },
    normalizedStatus: {
      type: String,
      enum: ['transferred', 'partially_reversed', 'fully_reversed', 'unknown'],
      required: true,
    },
    stripeCreatedAt: Date,
    lastVerifiedAt: Date,
    lastEventCreatedAt: Date,
    lastSyncError: String,
    source: { type: String, enum: ['webhook', 'reconciliation'], required: true },
    audit: { type: [auditSchema], default: [] },
  },
  { timestamps: true }
);

stripeTransferRecordSchema.index(
  { stripeObjectId: 1, stripeAccountId: 1, livemode: 1 },
  { unique: true }
);
stripeTransferRecordSchema.index({ providerId: 1, stripeCreatedAt: -1 });
stripeTransferRecordSchema.index({ orderId: 1, livemode: 1 });

module.exports = mongoose.model('StripeTransferRecord', stripeTransferRecordSchema);
