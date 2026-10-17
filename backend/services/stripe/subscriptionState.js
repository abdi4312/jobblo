const mongoose = require('mongoose');
const { isResourceMissing } = require('./customers');

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
 *   stripeStatus?: string, cancelAtPeriodEnd?: boolean }>}
 */
async function findBillingCapableSubscription(stripe, userId) {
  const objectId = new mongoose.Types.ObjectId(userId);
  const db = mongoose.connection.db;
  let pendingCheckout;
  let v2Record;
  try {
    pendingCheckout = await db.collection('subscription_billing_operations_v2').findOne({
      userId: objectId,
      operationType: 'checkout',
      status: { $in: ['pending', 'reconciliation_required'] },
    });
    v2Record = await db.collection('subscription_v2').findOne(
      { userId: objectId },
      { projection: { stripeSubscriptionId: 1, stripeMode: 1, status: 1 } }
    );
  } catch (err) {
    throw verificationUnavailable(err);
  }
  if (pendingCheckout) {
    return { blocking: true, reason: 'pending_subscription_checkout' };
  }

  if (!v2Record) return { blocking: false, reason: 'no_v2_subscription' };
  if (!v2Record.stripeSubscriptionId || !['test', 'live'].includes(v2Record.stripeMode)) {
    throw verificationUnavailable(new Error('V2 subscription has no verifiable Stripe reference'));
  }

  try {
    let client = stripe;
    if (typeof stripe.getStripeForMode === 'function') {
      client = await stripe.getStripeForMode(v2Record.stripeMode === 'test');
    } else if (!client?.subscriptions?.retrieve && typeof stripe.getStripe === 'function') {
      client = await stripe.getStripe();
    }
    const live = await retrieveLiveSubscription(client, v2Record.stripeSubscriptionId);
    if (!live.found || !isBillingCapableStripeStatus(live.subscription.status)) {
      return { blocking: false, reason: 'stripe_status_settled' };
    }
    return {
      blocking: true,
      reason: 'billing_capable',
      stripeSubscriptionId: v2Record.stripeSubscriptionId,
      stripeStatus: live.subscription.status,
      cancelAtPeriodEnd: Boolean(live.subscription.cancel_at_period_end),
    };
  } catch (err) {
    throw verificationUnavailable(err);
  }
}

module.exports = {
  BILLING_CAPABLE_STRIPE_STATUSES,
  isBillingCapableStripeStatus,
  retrieveLiveSubscription,
  findBillingCapableSubscription,
};
