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
async function customerFieldForMode() {
  return (await isTestMode()) ? 'stripeCustomerIdTest' : 'stripeCustomerId';
}

function isResourceMissing(err) {
  return err?.code === 'resource_missing' || err?.rawType === 'invalid_request_error';
}

async function createAndPersist(stripe, user, field) {
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: String(user._id) },
  });
  await User.findByIdAndUpdate(user._id, { [field]: customer.id });
  // Keep the in-memory document in step so a caller reusing `user` later in the
  // same request does not re-create a second customer.
  user[field] = customer.id;
  return customer.id;
}

/**
 * The user's Stripe customer for the active mode, created once and reused.
 * Always returns a customer id that Stripe currently recognises.
 */
async function resolveStripeCustomer(stripe, user) {
  const field = await customerFieldForMode();
  const stored = user?.[field];

  if (!stored) return createAndPersist(stripe, user, field);

  try {
    const existing = await stripe.customers.retrieve(stored);
    // A deleted customer still resolves, but cannot be charged.
    if (existing && !existing.deleted) return stored;
    return createAndPersist(stripe, user, field);
  } catch (err) {
    if (isResourceMissing(err)) {
      // Belongs to another mode or account, or was deleted. Replace it.
      return createAndPersist(stripe, user, field);
    }
    throw err;
  }
}

module.exports = { resolveStripeCustomer, customerFieldForMode };
