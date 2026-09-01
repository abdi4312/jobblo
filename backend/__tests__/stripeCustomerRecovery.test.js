/**
 * `cus_…` ids are not portable between Stripe's test and live modes. The code stored
 * one id and handed it to Stripe unvalidated, so after any mode switch every existing
 * user's next purchase failed with `resource_missing` — "No such customer".
 */

jest.mock('../models/User', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../config/stripe', () => ({ isTestMode: jest.fn() }));

const User = require('../models/User');
const { isTestMode } = require('../config/stripe');
const { resolveStripeCustomer, customerFieldForMode } = require('../services/stripe/customers');

function makeStripe({ retrieve, create } = {}) {
  return {
    customers: {
      retrieve: retrieve || jest.fn().mockResolvedValue({ id: 'cus_existing', deleted: false }),
      create: create || jest.fn().mockResolvedValue({ id: 'cus_new' }),
    },
  };
}

function resourceMissing() {
  const err = new Error("No such customer: 'cus_from_other_mode'");
  err.code = 'resource_missing';
  err.rawType = 'invalid_request_error';
  return err;
}

const user = () => ({ _id: 'user_1', email: 'a@b.no', name: 'Test' });

beforeEach(() => {
  jest.clearAllMocks();
  User.findByIdAndUpdate.mockResolvedValue({});
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
    const u = { ...user(), stripeCustomerId: 'cus_live_only' };

    const id = await resolveStripeCustomer(stripe, u);

    expect(stripe.customers.retrieve).not.toHaveBeenCalled();
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    expect(id).toBe('cus_new');
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user_1', {
      stripeCustomerIdTest: 'cus_new',
    });
  });
});

describe('resource_missing recovery', () => {
  it('creates and persists a replacement when Stripe does not recognise the stored id', async () => {
    const stripe = makeStripe({
      retrieve: jest.fn().mockRejectedValue(resourceMissing()),
    });
    const u = { ...user(), stripeCustomerId: 'cus_from_other_mode' };

    const id = await resolveStripeCustomer(stripe, u);

    expect(id).toBe('cus_new');
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user_1', { stripeCustomerId: 'cus_new' });
  });

  it('replaces a customer that exists but was deleted in the dashboard', async () => {
    const stripe = makeStripe({
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_gone', deleted: true }),
    });
    const u = { ...user(), stripeCustomerId: 'cus_gone' };

    const id = await resolveStripeCustomer(stripe, u);

    expect(id).toBe('cus_new');
  });

  it('reuses a customer Stripe still recognises', async () => {
    const stripe = makeStripe();
    const u = { ...user(), stripeCustomerId: 'cus_existing' };

    const id = await resolveStripeCustomer(stripe, u);

    expect(id).toBe('cus_existing');
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('creates one when the user has never bought anything', async () => {
    const stripe = makeStripe();

    const id = await resolveStripeCustomer(stripe, user());

    expect(id).toBe('cus_new');
    expect(stripe.customers.retrieve).not.toHaveBeenCalled();
  });

  it('rethrows unrelated Stripe errors instead of creating duplicate customers', async () => {
    const rateLimited = new Error('Too many requests');
    rateLimited.code = 'rate_limit';
    rateLimited.rawType = 'rate_limit_error';

    const stripe = makeStripe({ retrieve: jest.fn().mockRejectedValue(rateLimited) });
    const u = { ...user(), stripeCustomerId: 'cus_existing' };

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
