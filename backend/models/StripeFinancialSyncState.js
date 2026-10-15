const mongoose = require('mongoose');

const stripeFinancialSyncStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    stripeAccountId: { type: String, required: true },
    livemode: { type: Boolean, required: true },
    objectType: { type: String, enum: ['transfers', 'bank_payouts'], required: true },
    cursor: { type: String, default: null },
    hasMore: { type: Boolean, default: true },
    status: { type: String, enum: ['idle', 'running', 'failed'], default: 'idle' },
    leaseUntil: Date,
    lastStartedAt: Date,
    lastSucceededAt: Date,
    lastError: String,
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stripeFinancialSyncStateSchema.index({ stripeAccountId: 1, livemode: 1, objectType: 1 }, { unique: true });

module.exports = mongoose.model('StripeFinancialSyncState', stripeFinancialSyncStateSchema);
