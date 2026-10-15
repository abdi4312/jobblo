const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema(
  {
    eventId: String,
    eventType: String,
    eventCreatedAt: Date,
    status: String,
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const stripeBankPayoutRecordSchema = new mongoose.Schema(
  {
    stripeObjectId: { type: String, required: true, trim: true },
    stripeAccountId: { type: String, required: true, trim: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    livemode: { type: Boolean, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, uppercase: true },
    status: {
      type: String,
      enum: ['pending', 'in_transit', 'paid', 'failed', 'canceled'],
      required: true,
    },
    arrivalDate: Date,
    payoutType: { type: String, enum: ['automatic', 'manual'] },
    destinationLast4: { type: String, maxlength: 4 },
    destinationBankName: String,
    failureCode: String,
    failureMessage: String,
    stripeCreatedAt: Date,
    lastVerifiedAt: Date,
    lastEventCreatedAt: Date,
    lastSyncError: String,
    source: { type: String, enum: ['webhook', 'reconciliation'], required: true },
    audit: { type: [auditSchema], default: [] },
  },
  { timestamps: true }
);

stripeBankPayoutRecordSchema.index(
  { stripeObjectId: 1, stripeAccountId: 1, livemode: 1 },
  { unique: true }
);
stripeBankPayoutRecordSchema.index({ providerId: 1, stripeCreatedAt: -1 });
stripeBankPayoutRecordSchema.index({ stripeAccountId: 1, status: 1, livemode: 1 });

module.exports = mongoose.model('StripeBankPayoutRecord', stripeBankPayoutRecordSchema);
