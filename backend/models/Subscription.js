const mongoose = require('mongoose');

const planHistorySchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan',
    },
    plan: {
      type: String,
      enum: ['Standard', 'Plus', 'Pro', 'Start', 'Premium', 'Fleksibel', 'Jobblo Pluss'],
      required: true,
    },
    planType: {
      type: String,
      enum: ['business', 'private'],
      required: true,
    },
    startDate: Date,
    endDate: Date,
    stripeSubscriptionId: String,
    status: {
      type: String,
      enum: ['active', 'cancelled', 'expired'],
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    discountAmount: Number,
    discountCoupon: String,
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
    },
  },
  { _id: false }
);

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      // The index is declared at the bottom of this file so the `unique` constraint
      // and the reasoning for it stay together. Declaring `index: true` here as well
      // would define the same { userId: 1 } key twice with different options.
    },

    // 🔹 CURRENT PLAN
    currentPlan: {
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubscriptionPlan',
      },
      plan: {
        type: String,
        enum: ['Standard', 'Plus', 'Pro', 'Start', 'Premium', 'Fleksibel', 'Jobblo Pluss'],
        required: true,
      },
      planType: {
        type: String,
        enum: ['business', 'private'],
        required: true,
      },
      stripeSubscriptionId: String,
      startDate: Date,
      endDate: Date,
      renewalDate: Date,
      autoRenew: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['active', 'inactive', 'cancelled', 'expired'],
        default: 'active',
      },
      discountAmount: Number,
      discountCoupon: String,
      coupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Coupon',
      },
    },

    // 🔹 PLAN HISTORY
    planHistory: [planHistorySchema],
  },
  { timestamps: true }
);

/**
 * One subscription document per user.
 *
 * That is what the whole codebase already assumes: middleware/checkSubscription,
 * controllers/stripeController (getMySubscription / cancel / resume) and
 * utils/subscription.upsertSubscription all resolve the user's plan with a bare
 * `findOne({ userId })` and act on whatever comes back first. There is no code
 * anywhere that iterates a user's subscriptions, no "active" flag to disambiguate
 * them, and no UI that shows more than one. A second row is not a supported state --
 * it is corruption that happens to be readable.
 *
 * The Vipps callback produced exactly that corruption by calling
 * `Subscription.create(...)` on every sign-in. The application-level fix is
 * `utils/subscription.ensureDefaultSubscription`, an atomic upsert whose entire
 * payload is inside `$setOnInsert`; this index makes the same invariant true at the
 * storage layer, so a path that forgets to use the helper fails loudly instead of
 * quietly duplicating.
 *
 * IMPORTANT before deploying against an existing database:
 *
 *   1. Run `npm run dedupe:subscriptions` and read the report. Then
 *      `npm run dedupe:subscriptions -- --apply`. Groups it marks MANUAL_REVIEW must
 *      be resolved by hand -- the build fails while any duplicate remains.
 *
 *   2. Drop the OLD non-unique index first. Earlier revisions declared this field
 *      `index: true`, so deployed databases already carry a non-unique `userId_1`.
 *      MongoDB refuses to create an index with the same key and different options
 *      (IndexOptionsConflict) -- it does NOT silently upgrade it:
 *
 *          db.subscriptions.dropIndex('userId_1')
 *
 *   3. Verify with `db.subscriptions.getIndexes()` afterwards. Mongoose logs and
 *      continues when an index build fails, so a failed build leaves the app running
 *      with NO unique constraint while appearing perfectly healthy. Do not assume
 *      this took effect because the service started.
 *
 *   4. Azure Cosmos DB for MongoDB -- which this project's production connection
 *      string points at -- cannot add a unique index to a collection that already
 *      contains data. On Cosmos, step 2 and 3 will not succeed at all and this
 *      declaration is inert. That is a documented limitation, not a failure to fix:
 *      `ensureDefaultSubscription` is the guarantee there, and it is an atomic
 *      single-document upsert, which Cosmos does support. The same caveat is
 *      recorded for Payment.orderId in models/Payment.js.
 */
subscriptionSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
