const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');
const { resolveAllowedPlanType } = require('./planAccess');

async function resolveCurrentSubscriptionEntitlements(userId) {
  const [user, subscription] = await Promise.all([
    User.findById(userId),
    Subscription.findOne({ userId }),
  ]);
  if (!user) return null;

  const current = subscription?.currentPlan;
  const allowedType = resolveAllowedPlanType(user);
  if (!allowedType) return null;

  const noPlan = {
    planId: null,
    planName: null,
    planType: allowedType,
    price: 0,
    isActive: false,
    hasPlan: false,
    entitlements: {
      freeContact: 0,
      perContactPrice: 0,
      ContactUnlock: 0,
      maxJobsValue: null,
      maxContact: 0,
      radius: 0,
      visibilityLevel: 0,
      locationPrecision: 'approximate',
      hasBadge: false,
      hasAnalytics: false,
    },
    usage: Math.max(0, user.monthlyContactUsage || 0),
    subscription,
    user,
  };

  let plan = current?.planId ? await SubscriptionPlan.findById(current.planId) : null;
  if (!current?.planId && current?.plan && current?.planType === allowedType) {
    plan = await SubscriptionPlan.findOne({ name: current.plan, type: allowedType });
  }
  if (!plan || plan.type !== allowedType) return noPlan;

  // Company signup creates a schema-compatible business placeholder, but it is not
  // a purchased plan until Stripe provisions a planId and subscription id. It must
  // not inherit Start's included contacts merely because Start is the placeholder name.
  const isUnselectedCompany =
    user.role === 'company' && !current?.planId && !current?.stripeSubscriptionId;
  const entitlements = plan.entitlements?.toObject?.() || plan.entitlements;

  return {
    planId: plan._id,
    planName: plan.name,
    planType: plan.type,
    price: plan.price,
    isActive: plan.isActive,
    hasPlan: !isUnselectedCompany,
    entitlements: isUnselectedCompany ? { ...entitlements, freeContact: 0 } : entitlements,
    isUnselected: isUnselectedCompany,
    usage: Math.max(0, user.monthlyContactUsage || 0),
    subscription,
    user,
  };
}

function summarizePaidExtraContacts(transactions) {
  const eligible = (transactions || []).filter(
    (transaction) =>
      transaction?.type === 'extra_contact' &&
      transaction.status === 'succeeded' &&
      transaction.refunded !== true
  );
  const paidPurchased = eligible.length;
  const paidUsed = eligible.filter((transaction) => transaction.consumedAt != null).length;

  return {
    paidPurchased,
    paidUsed,
    paidAvailable: Math.max(paidPurchased - paidUsed, 0),
    totalPaidForExtraContacts: eligible.reduce(
      (total, transaction) => total + (Number.isFinite(transaction.amount) ? transaction.amount : 0),
      0
    ),
  };
}

module.exports = { resolveCurrentSubscriptionEntitlements, summarizePaidExtraContacts };
