/**
 * `createCheckoutSession` used to create a Stripe subscription for anyone who asked.
 *
 * It never looked at what the caller already had, so pressing "buy" a second time — on
 * the same plan or a different one — produced a second live Stripe subscription. The
 * old one kept billing every month, and `utils/subscription.upsertSubscription`
 * overwrote its id in Mongo, so nothing in Jobblo could reach it any more to cancel it.
 * Two other rules were missing from the same endpoint: an inactive plan was still
 * purchasable if the caller held its id, and a coupon that discounted the total to zero
 * reached Stripe as a recurring line item of `unit_amount: 0`.
 *
 * These are server rules. The web and mobile plan lists filter and gate for UX, but
 * neither is trusted here — every case below calls the controller directly, with no UI
 * in the way, and the sole test of success is whether `checkout.sessions.create` ran.
 */

jest.mock('../models/SubscriptionPlan', () => ({ findById: jest.fn() }));
jest.mock('../models/Subscription', () => ({ findOne: jest.fn() }));
jest.mock('../models/Coupon', () => ({ findOne: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/User', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Service', () => ({ findById: jest.fn() }));
jest.mock('../config/stripe', () => ({ getStripe: jest.fn(), isTestMode: jest.fn() }));
jest.mock('../utils/transaction', () => ({ upsertTransaction: jest.fn() }));
jest.mock('../utils/subscription', () => ({ upsertSubscription: jest.fn() }));
// Provisioning is only reached by the *status* endpoint; stubbing it keeps this file
// from pulling in the notification stack.
jest.mock('../services/stripe/provisioning', () => ({
  provisionSubscriptionFromSession: jest.fn(),
  provisionExtraContactFromSession: jest.fn(),
  subscriptionPeriodEnd: jest.fn(),
}));
jest.mock('../services/stripe/customers', () => ({
  resolveStripeCustomer: jest.fn(),
  customerFieldForMode: jest.fn(),
  // Kept faithful to the real implementation: subscriptionState uses it to tell "no
  // such subscription" (safe to allow) from "Stripe could not answer" (must block).
  isResourceMissing: (err) =>
    err?.code === 'resource_missing' || err?.rawType === 'invalid_request_error',
}));

const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Coupon = require('../models/Coupon');
const { getStripe } = require('../config/stripe');
const { resolveStripeCustomer } = require('../services/stripe/customers');
const { createCheckoutSession } = require('../controllers/stripeController');

const USER_ID = '507f1f77bcf86cd799439011';
const PLAN_ID = '507f1f77bcf86cd799439022';

let stripe;

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

function makeReq(body = {}) {
  return { body: { planId: PLAN_ID, ...body }, user: { _id: USER_ID, email: 'a@b.no', name: 'A' } };
}

function paidPlan(overrides = {}) {
  return { _id: PLAN_ID, name: 'Pro', price: 299, type: 'private', isActive: true, ...overrides };
}

/** The row every account gets at signup: a free default plan, no Stripe id. */
function freeDefaultRow() {
  return { userId: USER_ID, currentPlan: { plan: 'Standard', planType: 'private', status: 'active' } };
}

function paidRow(stripeSubscriptionId = 'sub_existing') {
  return {
    userId: USER_ID,
    currentPlan: { plan: 'Pro', planType: 'private', status: 'active', stripeSubscriptionId },
  };
}

function stripeSub(status, extra = {}) {
  return { id: 'sub_existing', status, cancel_at_period_end: false, ...extra };
}

function resourceMissing() {
  const err = new Error("No such subscription: 'sub_existing'");
  err.code = 'resource_missing';
  err.rawType = 'invalid_request_error';
  return err;
}

function validCoupon(overrides = {}) {
  return {
    _id: 'coupon_1',
    code: 'SPAR20',
    type: 'percentage',
    amount: 20,
    active: true,
    usageLimit: 0,
    usedBy: [],
    targetPlanType: 'all',
    expiresDate: new Date(Date.now() + 86400000),
    ...overrides,
  };
}

/** The line item Stripe was actually asked to bill, in øre. */
function sentUnitAmount() {
  return stripe.checkout.sessions.create.mock.calls[0][0].line_items[0].price_data.unit_amount;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = 'https://jobblo.no';

  stripe = {
    subscriptions: { retrieve: jest.fn() },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_1' }),
      },
    },
  };
  getStripe.mockResolvedValue(stripe);
  resolveStripeCustomer.mockResolvedValue('cus_1');
  SubscriptionPlan.findById.mockResolvedValue(paidPlan());
  Subscription.findOne.mockResolvedValue(freeDefaultRow());
});

describe('A — a user with no paid subscription can buy an active paid plan', () => {
  it('creates the session', async () => {
    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/pay/cs_1' });
  });

  it('does not treat the free default subscription row as a paid subscription', async () => {
    // Every account has a row from signup. Blocking on "a row exists" would block every
    // first purchase in the product, so the stored Stripe id is what counts.
    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('is unaffected by a missing subscription row entirely', async () => {
    Subscription.findOne.mockResolvedValue(null);
    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });
});

describe('B — an existing live Stripe subscription blocks a second one', () => {
  it('returns 409 active_subscription_exists and creates nothing at Stripe', async () => {
    Subscription.findOne.mockResolvedValue(paidRow());
    stripe.subscriptions.retrieve.mockResolvedValue(stripeSub('active'));

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('active_subscription_exists');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    // Blocked before the customer is touched, so a refusal leaves no Stripe side effects.
    expect(resolveStripeCustomer).not.toHaveBeenCalled();
  });

  it('answers in Norwegian and points at the existing subscription', async () => {
    Subscription.findOne.mockResolvedValue(paidRow());
    stripe.subscriptions.retrieve.mockResolvedValue(stripeSub('active'));

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.body.message).toBe(
      'Du har allerede et aktivt abonnement. Administrer det eksisterende abonnementet før du kjøper en ny plan.'
    );
  });

  it('blocks a trial as well as a paid period', async () => {
    Subscription.findOne.mockResolvedValue(paidRow());
    stripe.subscriptions.retrieve.mockResolvedValue(stripeSub('trialing'));

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it.each(['past_due', 'unpaid', 'incomplete', 'paused'])(
    'blocks %s, because Stripe can still invoice against it',
    async (status) => {
      Subscription.findOne.mockResolvedValue(paidRow());
      stripe.subscriptions.retrieve.mockResolvedValue(stripeSub(status));

      const res = makeRes();
      await createCheckoutSession(makeReq(), res);

      expect(res.statusCode).toBe(409);
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    }
  );

  it('blocks a different plan just as firmly as the same plan', async () => {
    // "Switching" through this endpoint is exactly what produced two live subscriptions.
    Subscription.findOne.mockResolvedValue(paidRow());
    stripe.subscriptions.retrieve.mockResolvedValue(stripeSub('active'));
    SubscriptionPlan.findById.mockResolvedValue(
      paidPlan({ _id: 'other_plan', name: 'Premium', price: 599 })
    );

    const res = makeRes();
    await createCheckoutSession(makeReq({ planId: '507f1f77bcf86cd799439099' }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('active_subscription_exists');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('does not cancel or modify the existing subscription', async () => {
    Subscription.findOne.mockResolvedValue(paidRow());
    stripe.subscriptions.retrieve.mockResolvedValue(stripeSub('active'));
    stripe.subscriptions.update = jest.fn();
    stripe.subscriptions.cancel = jest.fn();

    await createCheckoutSession(makeReq(), makeRes());

    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
  });
});

describe('C — cancel-at-period-end still blocks until the period actually ends', () => {
  it('refuses while the cancelling subscription is still active', async () => {
    // It is still `active` at Stripe and still invoiceable. Allowing a purchase here
    // would have the customer paying out the old plan and the new one at once.
    Subscription.findOne.mockResolvedValue(paidRow());
    stripe.subscriptions.retrieve.mockResolvedValue(
      stripeSub('active', { cancel_at_period_end: true })
    );

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('active_subscription_exists');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});

describe('D — a settled subscription does not block', () => {
  it.each(['canceled', 'incomplete_expired'])('allows a purchase after %s', async (status) => {
    Subscription.findOne.mockResolvedValue(paidRow());
    stripe.subscriptions.retrieve.mockResolvedValue(stripeSub(status));

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/pay/cs_1' });
  });

  it('allows a purchase when Stripe has never heard of the stored id', async () => {
    // A `sub_…` from the other Stripe mode, or from an account the data was copied
    // from. The same reasoning `resolveStripeCustomer` uses for a stale `cus_…`.
    Subscription.findOne.mockResolvedValue(paidRow());
    stripe.subscriptions.retrieve.mockRejectedValue(resourceMissing());

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('refuses rather than guesses when Stripe cannot answer at all', async () => {
    // Fail closed. A lost sale can be retried; a duplicate subscription takes money
    // every month until someone notices.
    const rateLimited = new Error('Too many requests');
    rateLimited.code = 'rate_limit';
    rateLimited.rawType = 'rate_limit_error';

    Subscription.findOne.mockResolvedValue(paidRow());
    stripe.subscriptions.retrieve.mockRejectedValue(rateLimited);

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('subscription_check_unavailable');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    // The customer gets the generic payment message, not a raw Stripe error code.
    expect(res.body.message).toBe('Kunne ikke starte betalingen. Prøv igjen, eller kontakt support.');
  });
});

describe('E — an inactive plan cannot be bought even by id', () => {
  it('returns 400 plan_inactive', async () => {
    SubscriptionPlan.findById.mockResolvedValue(paidPlan({ isActive: false }));

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('plan_inactive');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('does not depend on GET /api/plans or on client-side filtering', async () => {
    // `GET /api/plans` deliberately returns inactive plans — the admin plan editor reads
    // the same public route. So the rule has to live at checkout.
    SubscriptionPlan.findById.mockResolvedValue(paidPlan({ isActive: undefined }));

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('plan_inactive');
  });

  it('still rejects a nonexistent plan with 404', async () => {
    SubscriptionPlan.findById.mockResolvedValue(null);

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.statusCode).toBe(404);
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('reports a malformed planId as a missing plan rather than a server error', async () => {
    const res = makeRes();
    await createCheckoutSession(makeReq({ planId: 'not-an-objectid' }), res);

    expect(res.statusCode).toBe(404);
    expect(SubscriptionPlan.findById).not.toHaveBeenCalled();
  });
});

describe('F — a free plan is still refused', () => {
  it.each([0, null, undefined])('rejects price %p with plan_is_free', async (price) => {
    SubscriptionPlan.findById.mockResolvedValue(paidPlan({ price }));

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('plan_is_free');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});

describe('G — a coupon that leaves something to pay is honoured', () => {
  it('bills the discounted amount', async () => {
    Coupon.findOne.mockResolvedValue(validCoupon());

    const res = makeRes();
    await createCheckoutSession(makeReq({ couponCode: 'spar20' }), res);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    // 299 less 20% = 239.20 kr.
    expect(sentUnitAmount()).toBe(23920);
    expect(res.body).toEqual({ url: 'https://checkout.stripe.com/pay/cs_1' });
  });

  it('looks the code up case-insensitively', async () => {
    Coupon.findOne.mockResolvedValue(validCoupon());

    await createCheckoutSession(makeReq({ couponCode: 'spar20' }), makeRes());

    expect(Coupon.findOne).toHaveBeenCalledWith({ code: 'SPAR20' });
  });
});

describe('H — a coupon that zeroes the total is refused', () => {
  it('rejects a 100% discount with zero_total_subscription', async () => {
    Coupon.findOne.mockResolvedValue(validCoupon({ amount: 100 }));

    const res = makeRes();
    await createCheckoutSession(makeReq({ couponCode: 'SPAR20' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('zero_total_subscription');
    expect(res.body.message).toBe(
      'Rabatten gjør betalingen gratis, og kan ikke behandles som et Stripe-abonnement.'
    );
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects a fixed discount worth at least the plan price', async () => {
    // calculateDiscount clamps at zero, so an over-large fixed coupon lands on 0 too.
    Coupon.findOne.mockResolvedValue(validCoupon({ type: 'fixed', amount: 400 }));

    const res = makeRes();
    await createCheckoutSession(makeReq({ couponCode: 'SPAR20' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('zero_total_subscription');
  });

  it('rejects a sub-øre remainder, which Stripe would round to zero', async () => {
    SubscriptionPlan.findById.mockResolvedValue(paidPlan({ price: 100 }));
    Coupon.findOne.mockResolvedValue(validCoupon({ type: 'fixed', amount: 99.999 }));

    const res = makeRes();
    await createCheckoutSession(makeReq({ couponCode: 'SPAR20' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('zero_total_subscription');
  });

  it('does not invent a free subscription instead', async () => {
    // There is no server-side "activate a free plan" operation to fall back on, so the
    // only safe answer is a refusal.
    Coupon.findOne.mockResolvedValue(validCoupon({ amount: 100 }));
    const { upsertSubscription } = require('../utils/subscription');

    await createCheckoutSession(makeReq({ couponCode: 'SPAR20' }), makeRes());

    expect(upsertSubscription).not.toHaveBeenCalled();
  });
});

describe('I — existing coupon validation is unchanged', () => {
  it('passes an expired coupon message straight through as a 400', async () => {
    Coupon.findOne.mockResolvedValue(
      validCoupon({ expiresDate: new Date(Date.now() - 86400000) })
    );

    const res = makeRes();
    await createCheckoutSession(makeReq({ couponCode: 'SPAR20' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Coupon has expired');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown code', async () => {
    Coupon.findOne.mockResolvedValue(null);

    const res = makeRes();
    await createCheckoutSession(makeReq({ couponCode: 'NOPE' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Invalid or inactive coupon');
  });

  it('rejects a coupon the user has already used', async () => {
    Coupon.findOne.mockResolvedValue(validCoupon({ usedBy: [USER_ID] }));

    const res = makeRes();
    await createCheckoutSession(makeReq({ couponCode: 'SPAR20' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('You have already used this coupon');
  });

  it('rejects a coupon meant for the other plan type', async () => {
    Coupon.findOne.mockResolvedValue(validCoupon({ targetPlanType: 'business' }));

    const res = makeRes();
    await createCheckoutSession(makeReq({ couponCode: 'SPAR20' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('This coupon is only valid for business plans');
  });

  it('treats a non-string code as invalid rather than crashing', async () => {
    const res = makeRes();
    await createCheckoutSession(makeReq({ couponCode: { $ne: null } }), res);

    expect(res.statusCode).toBe(400);
    expect(Coupon.findOne).not.toHaveBeenCalled();
  });
});

describe('J — the server, not the client, decides what is charged', () => {
  it('ignores a client-supplied price, discount and final price', async () => {
    const res = makeRes();
    await createCheckoutSession(
      makeReq({ price: 1, finalPrice: 1, discountAmount: 298, amount: 1 }),
      res
    );

    expect(sentUnitAmount()).toBe(29900);
    const metadata = stripe.checkout.sessions.create.mock.calls[0][0].metadata;
    expect(metadata.planPrice).toBe(299);
    expect(metadata.discountAmount).toBe(0);
  });

  it('ignores a client-supplied userId and bills the authenticated user', async () => {
    const res = makeRes();
    await createCheckoutSession(makeReq({ userId: 'someone_else' }), res);

    expect(stripe.checkout.sessions.create.mock.calls[0][0].metadata.userId).toBe(USER_ID);
  });

  it('ignores a client-supplied Stripe customer and subscription id', async () => {
    await createCheckoutSession(
      makeReq({ stripeCustomerId: 'cus_attacker', stripeSubscriptionId: 'sub_attacker' }),
      makeRes()
    );

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.customer).toBe('cus_1');
    // The only place a customer id can come from is resolveStripeCustomer.
    expect(resolveStripeCustomer).toHaveBeenCalledWith(stripe, expect.objectContaining({ _id: USER_ID }));
  });

  it('never accepts a client-supplied return URL', async () => {
    await createCheckoutSession(
      makeReq({ returnUrl: 'https://evil.example/steal', success_url: 'https://evil.example' }),
      makeRes()
    );

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.success_url).toBe(
      'https://jobblo.no/subscription/success?session_id={CHECKOUT_SESSION_ID}'
    );
    expect(params.cancel_url).toBe('https://jobblo.no/membership');
  });

  it('re-reads the plan from the database rather than trusting a posted plan object', async () => {
    await createCheckoutSession(makeReq({ plan: { name: 'Free', price: 0 } }), makeRes());

    expect(SubscriptionPlan.findById).toHaveBeenCalledWith(PLAN_ID);
    expect(stripe.checkout.sessions.create.mock.calls[0][0].metadata.planName).toBe('Pro');
  });
});

describe('double-submit protection', () => {
  it('gives Stripe an idempotency key derived only from server-side values', async () => {
    await createCheckoutSession(makeReq(), makeRes());

    const options = stripe.checkout.sessions.create.mock.calls[0][1];
    expect(options.idempotencyKey).toContain(`sub_checkout_${USER_ID}_${PLAN_ID}_nocoupon_`);
  });

  it('varies the key by coupon so applying one gets a correctly priced session', async () => {
    Coupon.findOne.mockResolvedValue(validCoupon());
    await createCheckoutSession(makeReq({ couponCode: 'SPAR20' }), makeRes());

    expect(stripe.checkout.sessions.create.mock.calls[0][1].idempotencyKey).toContain('_SPAR20_');
  });

  it('answers a simultaneous duplicate with 409 checkout_in_progress', async () => {
    const inUse = new Error('Key already in use');
    inUse.code = 'idempotency_key_in_use';
    stripe.checkout.sessions.create.mockRejectedValue(inUse);

    const res = makeRes();
    await createCheckoutSession(makeReq(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('checkout_in_progress');
  });
});
