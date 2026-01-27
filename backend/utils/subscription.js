const Subscription = require("../models/Subscription");

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
        status: "active",
        discountAmount,
        discountCoupon,
        coupon: couponId,
      },
      planHistory: [],
    });
  } else {
    const isPlanChanged =
      !subscription.currentPlan ||
      subscription.currentPlan.plan !== planName;

    // 📜 Push old plan to history
    if (isPlanChanged && subscription.currentPlan?.plan) {
      subscription.planHistory.push({
        planId: subscription.currentPlan.planId,
        plan: subscription.currentPlan.plan,
        planType: subscription.currentPlan.planType,
        startDate: subscription.currentPlan.startDate || now,
        endDate: now,
        stripeSubscriptionId:
          subscription.currentPlan.stripeSubscriptionId || null,
        status: "expired",
        discountAmount:
          subscription.currentPlan.discountAmount || 0,
        discountCoupon:
          subscription.currentPlan.discountCoupon || null,
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
      status: "active",
      discountAmount,
      discountCoupon,
      coupon: couponId,
    };
  }

  await subscription.save();
  return subscription;
};
