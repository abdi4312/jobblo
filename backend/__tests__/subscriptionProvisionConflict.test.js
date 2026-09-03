/**
 * `upsertSubscription` overwrites `currentPlan.stripeSubscriptionId` wholesale, and
 * `provisionSubscriptionFromSession` called it unconditionally.
 *
 * That is right for a replay and for a re-subscribe after cancellation, but destructive
 * in one case: the stored id names a *different* subscription that Stripe is still
 * invoicing. Overwriting leaves the first one billing every month with nothing in Jobblo
 * pointing at it — `cancelMySubscription`, `applySubscriptionUpdated` and
 * `applySubscriptionDeleted` all find their subscription through the stored id, so it
 * becomes unreachable and uncancellable from inside the product.
 *
 * `createCheckoutSession` now refuses to create the second session in the first place,
 * but this path still has to defend itself: a session created before that guard existed
 * can still be paid, a checkout link can sit in a browser tab for hours, and two
 * simultaneous unpaid sessions can still both be completed.
 */

jest.mock('../models/Subscription', () => ({ findOne: jest.fn() }));
jest.mock('../models/Coupon', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/SubscriptionPlan', () => ({ findById: jest.fn() }));
jest.mock('../models/Notification', () => ({}));
jest.mock('../config/stripe', () => ({ getStripe: jest.fn(), isTestMode: jest.fn() }));
jest.mock('../utils/transaction', () => ({ upsertTransaction: jest.fn() }));
jest.mock('../utils/subscription', () => ({ upsertSubscription: jest.fn() }));
jest.mock('../services/notifications', () => ({ notify: jest.fn() }));
jest.mock('../services/stripe/customers', () => ({
  resolveStripeCustomer: jest.fn(),
  customerFieldForMode: jest.fn(),
  isResourceMissing: (err) =>
    err?.code === 'resource_missing' || err?.rawType === 'invalid_request_error',
}));

const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const User = require('../models/User');
const { getStripe } = require('../config/stripe');
const { upsertTransaction } = require('../utils/transaction');
const { upsertSubscription } = require('../utils/subscription');
const { provisionSubscriptionFromSession } = require('../services/stripe/provisioning');

const USER_ID = '507f1f77bcf86cd799439011';
const PLAN_ID = '507f1f77bcf86cd799439022';

let stripe;

function paidSession(subscriptionId = 'sub_new') {
  return {
    id: 'cs_new',
    amount_total: 29900,
    currency: 'nok',
    subscription: subscriptionId,
    metadata: { userId: USER_ID, planId: PLAN_ID, planName: 'Premium', planType: 'private' },
  };
}

function storedRow(stripeSubscriptionId) {
  return {
    userId: USER_ID,
    currentPlan: stripeSubscriptionId
      ? { plan: 'Pro', stripeSubscriptionId }
      : { plan: 'Standard' },
  };
}

function resourceMissing() {
  const err = new Error("No such subscription: 'sub_old'");
  err.code = 'resource_missing';
  err.rawType = 'invalid_request_error';
  return err;
}

beforeEach(() => {
  jest.clearAllMocks();
  stripe = {
    subscriptions: { retrieve: jest.fn() },
    checkout: { sessions: { retrieve: jest.fn() } },
  };
  getStripe.mockResolvedValue(stripe);
  upsertSubscription.mockResolvedValue({ currentPlan: { plan: 'Premium' } });
  upsertTransaction.mockResolvedValue({});
  Subscription.findOne.mockResolvedValue(storedRow(null));
  SubscriptionPlan.findById.mockResolvedValue({ _id: PLAN_ID, type: 'private' });
  User.findById.mockResolvedValue({ _id: USER_ID, role: 'user' });
});

describe('K — a paid session cannot silently orphan a live subscription', () => {
  it('refuses to overwrite a different subscription Stripe is still billing', async () => {
    Subscription.findOne.mockResolvedValue(storedRow('sub_old'));
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_old', status: 'active' });

    const result = await provisionSubscriptionFromSession(paidSession('sub_new'));

    expect(result).toEqual({ ok: false, reason: 'conflicting_live_subscription' });
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it('still records the transaction, because the customer was charged', async () => {
    // Withholding the receipt as well would leave the payment invisible to anyone
    // reconciling or refunding it.
    Subscription.findOne.mockResolvedValue(storedRow('sub_old'));
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_old', status: 'active' });

    await provisionSubscriptionFromSession(paidSession('sub_new'));

    expect(upsertTransaction).toHaveBeenCalledTimes(1);
    expect(upsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ stripeSessionId: 'cs_new', status: 'succeeded', amount: 299 })
    );
  });

  it('names both subscriptions in the log so the duplicate can be found and cancelled', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    Subscription.findOne.mockResolvedValue(storedRow('sub_old'));
    stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_old', status: 'active' });

    await provisionSubscriptionFromSession(paidSession('sub_new'));

    const logged = error.mock.calls[0].join(' ');
    expect(logged).toContain('sub_old');
    expect(logged).toContain('sub_new');
    error.mockRestore();
  });

  it.each(['past_due', 'unpaid', 'trialing', 'incomplete', 'paused'])(
    'refuses when the stored subscription is %s',
    async (status) => {
      Subscription.findOne.mockResolvedValue(storedRow('sub_old'));
      stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_old', status });

      const result = await provisionSubscriptionFromSession(paidSession('sub_new'));

      expect(result.ok).toBe(false);
      expect(upsertSubscription).not.toHaveBeenCalled();
    }
  );
});

describe('the guard does not break normal provisioning', () => {
  it('provisions a first purchase, where nothing is stored yet', async () => {
    const result = await provisionSubscriptionFromSession(paidSession('sub_new'));

    expect(result.ok).toBe(true);
    expect(upsertSubscription).toHaveBeenCalledTimes(1);
    // No stored id means no reason to ask Stripe anything.
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('provisions a replay of the same session idempotently', async () => {
    Subscription.findOne.mockResolvedValue(storedRow('sub_same'));

    const result = await provisionSubscriptionFromSession(paidSession('sub_same'));

    expect(result.ok).toBe(true);
    expect(upsertSubscription).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it('records Stripe total and native promotion discount, never a Jobblo coupon id', async () => {
    const session = paidSession('sub_new');
    session.discounts = [{ promotion_code: 'promo_1' }];
    stripe.checkout.sessions = {
      retrieve: jest.fn().mockResolvedValue({
        ...session,
        amount_total: 23920,
        total_details: { amount_discount: 5980 },
        discounts: [{ promotion_code: { code: 'JOBBLO20' } }],
      }),
    };

    const result = await provisionSubscriptionFromSession(session);

    expect(result.ok).toBe(true);
    expect(upsertTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 239.2,
        discountAmount: 59.8,
        discountCoupon: 'JOBBLO20',
        coupon: null,
      })
    );
    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ discountAmount: 59.8, discountCoupon: 'JOBBLO20', couponId: null })
    );
    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_new', {
      expand: ['discounts.promotion_code'],
    });
  });

  it.each(['canceled', 'incomplete_expired'])(
    'replaces a stored subscription that is %s',
    async (status) => {
      Subscription.findOne.mockResolvedValue(storedRow('sub_old'));
      stripe.subscriptions.retrieve.mockResolvedValue({ id: 'sub_old', status });

      const result = await provisionSubscriptionFromSession(paidSession('sub_new'));

      expect(result.ok).toBe(true);
      expect(upsertSubscription).toHaveBeenCalledTimes(1);
    }
  );

  it('replaces a stored id Stripe no longer recognises', async () => {
    // A `sub_…` from the other Stripe mode, or from an account the data was copied from.
    Subscription.findOne.mockResolvedValue(storedRow('sub_old'));
    stripe.subscriptions.retrieve.mockRejectedValue(resourceMissing());

    const result = await provisionSubscriptionFromSession(paidSession('sub_new'));

    expect(result.ok).toBe(true);
    expect(upsertSubscription).toHaveBeenCalledTimes(1);
  });

  it('throws when Stripe cannot answer, so the webhook claim is released and retried', async () => {
    // The dispatcher's contract: throw for transient faults, return for anything a retry
    // cannot fix. Returning a conflict here would strand a paid customer permanently.
    const rateLimited = new Error('Too many requests');
    rateLimited.code = 'rate_limit';
    rateLimited.rawType = 'rate_limit_error';

    Subscription.findOne.mockResolvedValue(storedRow('sub_old'));
    stripe.subscriptions.retrieve.mockRejectedValue(rateLimited);

    await expect(provisionSubscriptionFromSession(paidSession('sub_new'))).rejects.toThrow(
      'Too many requests'
    );
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it('still refuses a session with no user metadata', async () => {
    const result = await provisionSubscriptionFromSession({ id: 'cs_x', metadata: {} });

    expect(result).toEqual({ ok: false, reason: 'missing_user_metadata' });
    expect(upsertTransaction).not.toHaveBeenCalled();
  });
});

describe('webhook plan metadata remains defensive', () => {
  it('rejects metadata whose type disagrees with the database plan', async () => {
    const session = paidSession('sub_new');
    session.metadata.planType = 'business';

    const result = await provisionSubscriptionFromSession(session);

    expect(result).toEqual({ ok: false, reason: 'plan_metadata_mismatch' });
    expect(upsertTransaction).not.toHaveBeenCalled();
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it('rejects a private plan when the account role is company', async () => {
    User.findById.mockResolvedValue({ _id: USER_ID, role: 'company' });

    const result = await provisionSubscriptionFromSession(paidSession('sub_new'));

    expect(result).toEqual({ ok: false, reason: 'plan_type_not_allowed' });
    expect(upsertTransaction).not.toHaveBeenCalled();
    expect(upsertSubscription).not.toHaveBeenCalled();
  });
});
