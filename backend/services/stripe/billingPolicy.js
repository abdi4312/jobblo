const DEFAULT_GRACE_DAYS = 3;

function subscriptionGraceDays() {
  const configured = process.env.STRIPE_SUBSCRIPTION_GRACE_DAYS;
  if (configured === undefined || configured === '') return DEFAULT_GRACE_DAYS;
  const days = Number(configured);
  if (!Number.isInteger(days) || days < 0 || days > 30) {
    throw new Error('STRIPE_SUBSCRIPTION_GRACE_DAYS must be an integer from 0 to 30');
  }
  return days;
}

function hasPaidEntitlement(currentPlan, now = new Date()) {
  if (!currentPlan?.stripeSubscriptionId) {
    return currentPlan?.status === 'active';
  }
  const periodEnd = new Date(currentPlan.endDate || currentPlan.renewalDate || NaN).getTime();
  if (currentPlan.status === 'active') {
    return Number.isFinite(periodEnd) && now.getTime() < periodEnd;
  }
  if (currentPlan.status !== 'past_due' || !currentPlan.pastDueSince) return false;
  const graceMs = subscriptionGraceDays() * 24 * 60 * 60 * 1000;
  const failedAt = new Date(currentPlan.pastDueSince).getTime();
  return Number.isFinite(failedAt) && now.getTime() < failedAt + graceMs;
}

module.exports = { DEFAULT_GRACE_DAYS, subscriptionGraceDays, hasPaidEntitlement };
