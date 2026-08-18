const Subscription = require('../models/Subscription');

/**
 * Give an account its signup subscription, but only if it does not already have one.
 *
 * Every default-provisioning path in the product funnels through here: e-mail
 * registration (authController.register), Google (config/passport.js) and Vipps
 * (controllers/vippsController.js). They each used a bare `Subscription.create(...)`,
 * and the Vipps one sat outside its `if (!user)` branch so it ran on EVERY sign-in --
 * ten logins, ten rows. Readers resolve the subscription with `findOne({ userId })`,
 * so which row won was natural document order and an upgraded customer could be served
 * a stale free row, losing the plan they pay for and their contact quota.
 *
 * The write is a single atomic `findOneAndUpdate` with `upsert` where EVERYTHING
 * writable sits inside `$setOnInsert`. Mongo applies `$setOnInsert` only when it
 * actually inserts, so:
 *
 *   - a repeat call cannot create a second row (upsert matches the existing one), and
 *   - a repeat call cannot modify the existing row either -- no plan reset, no lost
 *     Stripe id, no truncated planHistory.
 *
 * That second property is what makes this safe to call on every login rather than only
 * at signup, and it is why there is no `$set` here. `$set` would be the original bug in
 * a different costume: it would reset a paid subscriber to the free default.
 *
 * Two concurrent calls for the same user resolve to one document: whichever loses the
 * upsert race either matches the winner's row or fails the duplicate-key check, which
 * is retried once below.
 *
 * Plan defaults follow the account's role so a Vipps, Google and e-mail signup all
 * start on the same footing.
 */
exports.ensureDefaultSubscription = async (user) => {
  const userId = user?._id || user?.id || user;
  if (!userId) throw new Error('ensureDefaultSubscription requires a user');

  const isCompany = user?.role === 'company' || user?.planType === 'business';

  const insert = {
    userId,
    currentPlan: {
      plan: isCompany ? 'Start' : 'Standard',
      planType: isCompany ? 'business' : 'private',
      startDate: new Date(),
      status: 'active',
      autoRenew: false,
    },
  };

  try {
    return await Subscription.findOneAndUpdate(
      { userId },
      { $setOnInsert: insert },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    // With a unique index on userId in place, two concurrent upserts can both decide
    // to insert and one gets E11000. The row it collided with is the one we wanted, so
    // read it back rather than surfacing an error -- this is success, not failure.
    if (err && err.code === 11000) {
      return Subscription.findOne({ userId });
    }
    throw err;
  }
};

/**
 * Create or update user subscription
 */
exports.upsertSubscription = async ({
  userId,
  planId,
  planName,
  planType,
  stripeSubscriptionId,
  autoRenew,
  discountAmount = 0,
  discountCoupon = null,
  couponId = null,
}) => {
  const now = new Date();
  const nextMonth = new Date(now);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  let subscription = await Subscription.findOne({ userId });

  if (!subscription) {
    // 🆕 First time subscription
    subscription = new Subscription({
      userId,
      currentPlan: {
        planId,
        plan: planName,
        planType,
        stripeSubscriptionId,
        startDate: now,
        endDate: nextMonth,
        renewalDate: nextMonth,
        autoRenew,
        status: 'active',
        discountAmount,
        discountCoupon,
        coupon: couponId,
      },
      planHistory: [],
    });
  } else {
    const isPlanChanged = !subscription.currentPlan || subscription.currentPlan.plan !== planName;

    // 📜 Push old plan to history
    if (isPlanChanged && subscription.currentPlan?.plan) {
      subscription.planHistory.push({
        planId: subscription.currentPlan.planId,
        plan: subscription.currentPlan.plan,
        planType: subscription.currentPlan.planType,
        startDate: subscription.currentPlan.startDate || now,
        endDate: now,
        stripeSubscriptionId: subscription.currentPlan.stripeSubscriptionId || null,
        status: 'expired',
        discountAmount: subscription.currentPlan.discountAmount || 0,
        discountCoupon: subscription.currentPlan.discountCoupon || null,
        coupon: subscription.currentPlan.coupon || null,
      });
    }

    // 🔄 Update current plan
    subscription.currentPlan = {
      planId,
      plan: planName,
      planType,
      stripeSubscriptionId,
      startDate: now,
      endDate: nextMonth,
      renewalDate: nextMonth,
      autoRenew,
      status: 'active',
      discountAmount,
      discountCoupon,
      coupon: couponId,
    };
  }

  await subscription.save();

  // 🔄 Also update the User model for quick access/display
  const User = require('../models/User');
  await User.findByIdAndUpdate(userId, {
    subscription: planName,
  });

  return subscription;
};
