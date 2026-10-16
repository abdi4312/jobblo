const mongoose = require('mongoose');
const { isResourceMissing } = require('./customers');

/**
 * Read-only account-deletion safeguard. Read historical subscription data directly
 * so this protection does not depend on the removed legacy Mongoose model.
 */

/**
 * Stripe statuses that can still produce a charge.
 *
 * - `active`, `trialing` — obviously.
 * - `past_due` — Stripe is still retrying the card on its dunning schedule.
 * - `unpaid` — retries are exhausted, but the subscription is not cancelled and its
 *   open invoice stays payable, so it can come back to life.
 * - `incomplete` — the first payment has not succeeded yet and Stripe holds the
 *   subscription open for ~23 hours waiting for it.
 * - `paused` — collection is paused, not stopped; resuming needs no new subscription.
 *
 * Deliberately absent: `canceled` and `incomplete_expired`, which are terminal —
 * Stripe will never invoice against them again.
 */
const BILLING_CAPABLE_STRIPE_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
]);

/** True when Stripe could still invoice against a subscription in this status. */
function isBillingCapableStripeStatus(status) {
  if (!status) return false;
  return BILLING_CAPABLE_STRIPE_STATUSES.has(String(status).toLowerCase());
}

/**
 * A Stripe lookup failed for a reason that is not "no such subscription" — a rate
 * limit, a network blip, a bad key.
 *
 * A failed lookup must not be mistaken for a settled subscription during deletion.
 */
function verificationUnavailable(err) {
  const wrapped = new Error(
    `Could not verify the existing Stripe subscription: ${err?.message || 'unknown error'}`
  );
  wrapped.code = 'subscription_check_unavailable';
  wrapped.cause = err;
  return wrapped;
}

/**
 * Fetch a subscription from Stripe, distinguishing "Stripe says it does not exist"
 * from "Stripe could not answer".
 *
 * A stored id genuinely stops existing: it can belong to the other Stripe mode after
 * a test/live switch, or to an account the data was copied from. That is the same
 * reasoning — and the same `isResourceMissing` test — that `resolveStripeCustomer`
 * uses to replace a stale `cus_…`, and it means "not found" is a safe *allow*.
 * Anything else is not safe to interpret, so it is rethrown.
 *
 * @returns {Promise<{ found: boolean, subscription: object|null }>}
 */
async function retrieveLiveSubscription(stripe, stripeSubscriptionId) {
  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    return { found: Boolean(subscription), subscription: subscription || null };
  } catch (err) {
    if (isResourceMissing(err)) return { found: false, subscription: null };
    throw err;
  }
}

/**
 * Check whether the account's stored Stripe subscription can still bill. A
 * subscription scheduled to cancel remains billable until its period ends. Fail
 * closed on database or Stripe errors so account deletion cannot orphan billing.
 *
 * @throws an error tagged `subscription_check_unavailable` when Stripe cannot be reached.
 * @returns {Promise<{ blocking: boolean, reason: string, stripeSubscriptionId?: string,
 *   stripeStatus?: string, cancelAtPeriodEnd?: boolean, planName?: string|null }>}
 */
async function findBillingCapableSubscription(stripe, userId) {
  const record = await mongoose.connection.db.collection('subscriptions').findOne(
    { userId: new mongoose.Types.ObjectId(userId) },
    { projection: { 'currentPlan.stripeSubscriptionId': 1, 'currentPlan.plan': 1 } }
  );
  const stripeSubscriptionId = record?.currentPlan?.stripeSubscriptionId || null;

  if (!stripeSubscriptionId) {
    return { blocking: false, reason: 'no_stripe_subscription' };
  }

  let live;
  try {
    live = await retrieveLiveSubscription(stripe, stripeSubscriptionId);
  } catch (err) {
    throw verificationUnavailable(err);
  }

  if (!live.found) {
    return { blocking: false, reason: 'stripe_subscription_missing', stripeSubscriptionId };
  }

  const stripeStatus = live.subscription.status;

  if (!isBillingCapableStripeStatus(stripeStatus)) {
    return {
      blocking: false,
      reason: 'stripe_status_settled',
      stripeSubscriptionId,
      stripeStatus,
    };
  }

  return {
    blocking: true,
    reason: 'billing_capable',
    stripeSubscriptionId,
    stripeStatus,
    cancelAtPeriodEnd: Boolean(live.subscription.cancel_at_period_end),
    planName: record?.currentPlan?.plan || null,
  };
}

module.exports = {
  BILLING_CAPABLE_STRIPE_STATUSES,
  isBillingCapableStripeStatus,
  retrieveLiveSubscription,
  findBillingCapableSubscription,
};
