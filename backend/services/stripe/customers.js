const crypto = require('crypto');
const User = require('../../models/User');
const { isTestMode } = require('../../config/stripe');

/**
 * One place that turns a Jobblo user into a Stripe customer id.
 *
 * Two problems this exists to solve:
 *
 * 1. `cus_…` ids belong to one Stripe mode. The codebase stored a single id and
 *    handed it straight to Stripe unvalidated, so after any test/live switch every
 *    existing user's next purchase failed with `resource_missing` ("No such
 *    customer"). Each mode now gets its own field.
 *
 * 2. Even inside one mode the stored id can go away — deleted in the dashboard,
 *    restored from a different account, copied between environments. Retrieving
 *    before reuse turns a hard 500 into a transparent re-create.
 *
 * Unrelated Stripe errors (rate limits, auth, network) are rethrown: swallowing
 * them would silently create duplicate customers every time Stripe had a bad
 * minute.
 */

/** Which User field holds the customer id for the mode we are currently in. */
async function customerFieldForMode(testMode) {
  const useTestMode = testMode === undefined ? await isTestMode() : testMode;
  return useTestMode ? 'stripeCustomerIdTest' : 'stripeCustomerId';
}

function isResourceMissing(err) {
  return err?.code === 'resource_missing' || err?.rawType === 'invalid_request_error';
}

/**
 * Create the customer once, even when several requests race here.
 *
 * Two concurrent SafePay checkouts for one user (a double click) both reached this
 * before the checkout reservation existed: each created its own Stripe customer and the
 * last DB write won, leaving the user's payments and saved cards split across two
 * customers. Now:
 *   - Stripe idempotency key: same user + mode + the id being replaced (+ the params,
 *     which Stripe requires to be identical for a key) -> racing requests get the SAME
 *     customer back. Replacing a deleted customer uses a different key, so it really
 *     creates a new one.
 *   - Compare-and-swap: the id is stored only if the field still holds what we read; if
 *     another request stored first, its customer is used.
 */
async function createAndPersist(stripe, user, field, replacing = null) {
  const params = {
    email: user.email,
    name: user.name,
    metadata: { userId: String(user._id) },
  };
  const paramsHash = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 16);
  const customer = await stripe.customers.create(params, {
    idempotencyKey: `jobblo-customer:${field}:${user._id}:${replacing || 'none'}:${paramsHash}`,
  });
  const stored = await User.findOneAndUpdate(
    { _id: user._id, [field]: replacing || null },
    { $set: { [field]: customer.id } },
    { new: true }
  ).select(field).lean();
  let winner = customer.id;
  if (!stored) {
    // Someone else stored a customer for this mode first — use theirs.
    const current = await User.findById(user._id).select(field).lean();
    if (!current?.[field]) throw new Error('stripe_customer_persistence_failed');
    winner = current[field];
  }
  // Keep the in-memory document in step so a caller reusing `user` later in the
  // same request does not re-create a second customer.
  user[field] = winner;
  return winner;
}

/**
 * The user's Stripe customer for the active mode, created once and reused.
 * Always returns a customer id that Stripe currently recognises.
 */
async function resolveStripeCustomer(stripe, user, testMode) {
  const field = await customerFieldForMode(testMode);
  const stored = user?.[field];

  if (!stored) return createAndPersist(stripe, user, field);

  try {
    const existing = await stripe.customers.retrieve(stored);
    // A deleted customer still resolves, but cannot be charged.
    if (existing && !existing.deleted) return stored;
    return createAndPersist(stripe, user, field, stored);
  } catch (err) {
    if (isResourceMissing(err)) {
      // Belongs to another mode or account, or was deleted. Replace it.
      return createAndPersist(stripe, user, field, stored);
    }
    throw err;
  }
}

module.exports = { resolveStripeCustomer, customerFieldForMode, isResourceMissing };
