const Subscription = require('../../models/Subscription');
const { isResourceMissing } = require('./customers');

/**
 * One answer to one question: "can this user's existing Stripe subscription still
 * bill them?"
 *
 * Why this exists as its own module rather than an `if` inside the controller:
 *
 * `createCheckoutSession` had no existing-subscription guard at all. It created a
 * second Stripe subscription for anyone who pressed "buy" again — same plan or a
 * different one — and `utils/subscription.upsertSubscription` then overwrote
 * `currentPlan.stripeSubscriptionId` with the new id. The previous subscription kept
 * billing on Stripe every month and was no longer reachable from
 * `cancelMySubscription`, because that reads the stored id. The customer was charged
 * twice, indefinitely, with no way to stop the first charge from inside Jobblo.
 *
 * Fixing that needs the same judgement in two places — before creating a session, and
 * before provisioning overwrites a stored id — so the judgement lives here once.
 *
 * Two rules shape the status list below:
 *
 * 1. Mongo is not trusted on its own. `currentPlan.status` is written by webhooks, and
 *    a webhook that never arrived leaves it stale in whichever direction is least
 *    convenient. Stripe is asked directly, the same way `getMySubscription` and
 *    `services/stripe/customers` already do.
 *
 * 2. Where the two could disagree, the expensive mistake wins. Refusing a purchase
 *    costs a sale and can be retried; allowing a duplicate takes real money from
 *    someone every month until they notice. So anything that Stripe could still turn
 *    into an invoice counts as blocking, and a Stripe lookup that fails outright
 *    blocks rather than waves the purchase through.
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
 * Stripe will never invoice against them again. (`cancelled` with two Ls is accepted
 * as a settled spelling only because that is how `models/Subscription` spells its own
 * local status; Stripe itself always sends one L.)
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
 * Tagged with a `code` and no `statusCode`, which is what `createCheckoutSession`'s
 * catch block needs to report it as a 500 carrying the generic Norwegian payment
 * message rather than echoing a raw Stripe error code at the customer.
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
 * Does this user already have a Stripe subscription that can bill them?
 *
 * Note what is *not* asked: whether a Subscription document exists. Every account
 * gets one at signup from `utils/subscription.ensureDefaultSubscription`, on the free
 * default plan, with no `stripeSubscriptionId` — so "a row exists" would block every
 * first purchase in the product. The stored Stripe id is the thing that matters.
 *
 * A subscription set to cancel at period end still reports `active` to Stripe and is
 * still invoiceable until the period actually ends, so it blocks too. Letting it
 * through would mean the customer pays for the remainder of the old plan and the whole
 * of the new one at the same time — the exact double-billing this guard exists to stop.
 *
 * @throws an error tagged `subscription_check_unavailable` when Stripe cannot be reached.
 * @returns {Promise<{ blocking: boolean, reason: string, stripeSubscriptionId?: string,
 *   stripeStatus?: string, cancelAtPeriodEnd?: boolean, planName?: string|null }>}
 */
async function findBillingCapableSubscription(stripe, userId) {
  // Bare findOne({ userId }) is how every other reader in the codebase resolves a
  // subscription; the model documents why there is exactly one row per user.
  const record = await Subscription.findOne({ userId });
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
