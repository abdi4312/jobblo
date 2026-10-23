/**
 * `cus_…` ids are not portable between Stripe's test and live modes. The code stored
 * one id and handed it to Stripe unvalidated, so after any mode switch every existing
 * user's next purchase failed with `resource_missing` — "No such customer".
 *
 * Also: two concurrent SafePay checkouts for one user (a double click, confirmed
 * against real Stripe TEST) each created a Stripe customer and the last DB write won,
 * splitting the user's payments and saved cards across two customers.
 *
 * The User model is an in-memory stand-in with real compare-and-swap semantics; Stripe
 * is a fake that honours idempotency keys the way Stripe does. Nothing real is created.
 */

jest.mock('../models/User', () => ({ findOneAndUpdate: jest.fn(), findById: jest.fn() }));
jest.mock('../config/stripe', () => ({ isTestMode: jest.fn() }));

const User = require('../models/User');
const { isTestMode } = require('../config/stripe');
const { resolveStripeCustomer, customerFieldForMode } = require('../services/stripe/customers');

let db; // userId -> stored user document
const chain = (value) => ({ select: () => ({ lean: async () => value }) });

function makeStripe({ retrieve, createImpl } = {}) {
  const byKey = new Map();
  let n = 0;
  const create = jest.fn(async (params, options) => {
    if (createImpl) return createImpl(params, options);
    // Stripe returns the original object for a repeated idempotency key.
    const key = options?.idempotencyKey;
    if (key && byKey.has(key)) return byKey.get(key);
    await new Promise((r) => setImmediate(r));
    if (key && byKey.has(key)) return byKey.get(key);
    const customer = { id: `cus_new_${++n}`, metadata: params.metadata };
    if (key) byKey.set(key, customer);
    return customer;
  });
  return {
    customers: {
      retrieve: retrieve || jest.fn().mockResolvedValue({ id: 'cus_existing', deleted: false }),
      create,
    },
  };
}

function resourceMissing() {
  const err = new Error("No such customer: 'cus_from_other_mode'");
  err.code = 'resource_missing';
  err.rawType = 'invalid_request_error';
  return err;
}

const user = (fields = {}) => {
  const u = { _id: 'user_1', email: 'a@b.no', name: 'Test', ...fields };
  db.set('user_1', { ...u });
  return u;
};

beforeEach(() => {
  jest.clearAllMocks();
  db = new Map();
  User.findOneAndUpdate.mockImplementation((filter, update) => {
    const doc = db.get(filter._id);
    const [[field, expected]] = Object.entries(filter).filter(([k]) => k !== '_id');
    const current = doc?.[field] ?? null;
    if (!doc || current !== expected) return chain(null);
    Object.assign(doc, update.$set);
    return chain({ ...doc });
  });
  User.findById.mockImplementation((id) => chain(db.get(id) ? { ...db.get(id) } : null));
  isTestMode.mockResolvedValue(false);
});

describe('mode-scoped storage', () => {
  it('uses the live field in live mode and the test field in test mode', async () => {
    isTestMode.mockResolvedValue(false);
    expect(await customerFieldForMode()).toBe('stripeCustomerId');

    isTestMode.mockResolvedValue(true);
    expect(await customerFieldForMode()).toBe('stripeCustomerIdTest');
  });

  it('does not read a live customer id while in test mode', async () => {
    isTestMode.mockResolvedValue(true);
    const stripe = makeStripe();
    // Only the LIVE field is populated — test mode must ignore it.
    const u = user({ stripeCustomerId: 'cus_live_only' });

    const id = await resolveStripeCustomer(stripe, u);

    expect(stripe.customers.retrieve).not.toHaveBeenCalled();
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    expect(id).toBe('cus_new_1');
    expect(db.get('user_1')).toMatchObject({ stripeCustomerIdTest: 'cus_new_1', stripeCustomerId: 'cus_live_only' });
  });
});

describe('resource_missing recovery', () => {
  it('creates and persists a replacement when Stripe does not recognise the stored id', async () => {
    const stripe = makeStripe({
      retrieve: jest.fn().mockRejectedValue(resourceMissing()),
    });
    const u = user({ stripeCustomerId: 'cus_from_other_mode' });

    const id = await resolveStripeCustomer(stripe, u);

    expect(id).toBe('cus_new_1');
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    expect(db.get('user_1').stripeCustomerId).toBe('cus_new_1');
  });

  it('replaces a customer that exists but was deleted in the dashboard', async () => {
    const stripe = makeStripe({
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_gone', deleted: true }),
    });
    const u = user({ stripeCustomerId: 'cus_gone' });

    const id = await resolveStripeCustomer(stripe, u);

    expect(id).toBe('cus_new_1');
    // A replacement uses a key tied to the id it replaces, so it is a genuinely new create.
    expect(stripe.customers.create.mock.calls[0][1].idempotencyKey).toContain(':cus_gone:');
  });

  it('reuses a customer Stripe still recognises', async () => {
    const stripe = makeStripe();
    const u = user({ stripeCustomerId: 'cus_existing' });

    const id = await resolveStripeCustomer(stripe, u);

    expect(id).toBe('cus_existing');
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('creates one when the user has never bought anything', async () => {
    const stripe = makeStripe();

    const id = await resolveStripeCustomer(stripe, user());

    expect(id).toBe('cus_new_1');
    expect(stripe.customers.retrieve).not.toHaveBeenCalled();
  });

  it('rethrows unrelated Stripe errors instead of creating duplicate customers', async () => {
    const rateLimited = new Error('Too many requests');
    rateLimited.code = 'rate_limit';
    rateLimited.rawType = 'rate_limit_error';

    const stripe = makeStripe({ retrieve: jest.fn().mockRejectedValue(rateLimited) });
    const u = user({ stripeCustomerId: 'cus_existing' });

    await expect(resolveStripeCustomer(stripe, u)).rejects.toThrow('Too many requests');
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });

  it('updates the in-memory user so one request cannot create two customers', async () => {
    const stripe = makeStripe();
    const u = user();

    await resolveStripeCustomer(stripe, u);
    await resolveStripeCustomer(stripe, u);

    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
  });
});

describe('concurrent creation (double-clicked checkout)', () => {
  it('two simultaneous requests for one user end up with ONE Stripe customer', async () => {
    const stripe = makeStripe();
    user();
    // Separate request objects, as two HTTP requests would load them.
    const [a, b] = await Promise.all([
      resolveStripeCustomer(stripe, { ...db.get('user_1') }),
      resolveStripeCustomer(stripe, { ...db.get('user_1') }),
    ]);

    expect(a).toBe(b);
    expect(db.get('user_1').stripeCustomerId).toBe(a);
    const keys = stripe.customers.create.mock.calls.map(([, o]) => o.idempotencyKey);
    expect(new Set(keys).size).toBe(1); // both asked Stripe with the same key
  });

  it('if another request already stored a different customer, that one wins and is returned', async () => {
    const stripe = makeStripe();
    const u = user();
    // Simulate a racer that stored its customer between our read and our write.
    stripe.customers.create.mockImplementationOnce(async () => {
      db.get('user_1').stripeCustomerId = 'cus_racer';
      return { id: 'cus_ours' };
    });

    const id = await resolveStripeCustomer(stripe, u);

    expect(id).toBe('cus_racer');
    expect(db.get('user_1').stripeCustomerId).toBe('cus_racer'); // never overwritten
    expect(u.stripeCustomerId).toBe('cus_racer');
  });

  it('TEST and LIVE customers stay separate and use different keys', async () => {
    const stripe = makeStripe();
    user();
    isTestMode.mockResolvedValue(true);
    const testId = await resolveStripeCustomer(stripe, { ...db.get('user_1') });
    isTestMode.mockResolvedValue(false);
    const liveId = await resolveStripeCustomer(stripe, { ...db.get('user_1') });

    expect(testId).not.toBe(liveId);
    expect(db.get('user_1')).toMatchObject({ stripeCustomerIdTest: testId, stripeCustomerId: liveId });
  });

  it('a failed create stores nothing, and a retry reuses the same idempotency key', async () => {
    const stripe = makeStripe();
    const u = user();
    stripe.customers.create.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }));

    await expect(resolveStripeCustomer(stripe, u)).rejects.toThrow('timeout');
    expect(db.get('user_1').stripeCustomerId).toBeUndefined();

    const id = await resolveStripeCustomer(stripe, u);
    const [first, second] = stripe.customers.create.mock.calls.map(([, o]) => o.idempotencyKey);
    expect(second).toBe(first); // if the timed-out create did happen, Stripe returns it
    expect(db.get('user_1').stripeCustomerId).toBe(id);
  });

  it('fails closed if the customer cannot be stored at all', async () => {
    const stripe = makeStripe();
    const u = user();
    User.findOneAndUpdate.mockReturnValueOnce(chain(null));
    User.findById.mockReturnValueOnce(chain(null));

    await expect(resolveStripeCustomer(stripe, u)).rejects.toThrow('stripe_customer_persistence_failed');
  });
});
