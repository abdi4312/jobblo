const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', index: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'disputed', 'released', 'refunded'],
      default: 'pending',
    },
    stripePaymentIntentId: { type: String },
    stripeSessionId: { type: String },
    stripeEventId: { type: String },
    amount: { type: Number, required: true, min: 0 },
    paymentProviderId: { type: String },
    transactionId: { type: String },
  },
  { timestamps: true }
);

/**
 * One Payment per order — the guarantee confirmPaidSession always claimed to have.
 *
 * The code commented that "the unique index on orderId is the real idempotency
 * guard" and swallowed error 11000 on that basis, but the field was declared
 * `index: true` with no `unique`, so the duplicate-key catch could never fire. The
 * browser redirect racing the webhook could write two Payment documents and send two
 * sets of notifications.
 *
 * confirmPaidSession no longer depends on this index being present — it uses a
 * single upsert and keys its side effects off upsertedCount — but the constraint
 * makes the invariant true at the storage layer as well.
 *
 * IMPORTANT before deploying to an existing database:
 *   1. Run `node scripts/dedupe-payment-records.js` and let it remove duplicates.
 *   2. Verify with db.payments.getIndexes() afterwards. Mongoose logs and continues
 *      when an index build fails, so a failed build leaves the app running with NO
 *      index while appearing healthy.
 *   3. Azure Cosmos DB for MongoDB cannot add a unique index to a non-empty
 *      collection. If production is Cosmos, skip this index; the upsert in
 *      confirmPaidSession and the StripeEvent ledger are the guarantee there.
 */
paymentSchema.index({ orderId: 1 }, { unique: true });

// Reconciliation lookups by Stripe object.
paymentSchema.index({ stripePaymentIntentId: 1 }, { sparse: true });
paymentSchema.index({ stripeSessionId: 1 }, { sparse: true });

module.exports = mongoose.model('Payment', paymentSchema);
