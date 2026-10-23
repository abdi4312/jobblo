jest.mock('../models/Order', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/StripePaymentIncident', () => ({
  findOne: jest.fn(),
}));

jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));

jest.mock('../services/stripe/customers', () => ({
  resolveStripeCustomer: jest.fn(),
}));
jest.mock('../services/stripe/webhookReadiness', () => ({
  getStripeWebhookReadiness: jest.fn(),
}));

const { createSafePaySession } = require('../controllers/SafePayCheckoutController');
const { checkoutSessionStatus } = require('../controllers/SafePayCheckoutController');
const Order = require('../models/Order');
const User = require('../models/User');
const StripePaymentIncident = require('../models/StripePaymentIncident');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');
const { resolveStripeCustomer } = require('../services/stripe/customers');
const { getStripeWebhookReadiness } = require('../services/stripe/webhookReadiness');
const crypto = require('crypto');

const ORDER_ID = '507f1f77bcf86cd799439011';
const USER_ID = '507f1f77bcf86cd799439012';

function makeRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = 'https://example.com';
  process.env.MOBILE_APP_LINK_PREFIX = 'jobblo://';
  process.env.MOBILE_RETURN_URL = 'https://example.com/mobile-return';

  Order.findById.mockImplementation(() => ({
    populate: jest.fn().mockResolvedValue(makeOrder()),
    select: jest.fn().mockResolvedValue(makeOrder()),
  }));

  User.findById.mockResolvedValue({ _id: USER_ID });
  StripePaymentIncident.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue(null),
  });
  resolveStripeCustomer.mockResolvedValue('cus_test_123');
  getStripeConfiguration.mockResolvedValue({
    testMode: true,
    mode: 'test',
    secretKey: 'sk_test_example',
    webhookSecret: 'whsec_test_example',
    keyModeValid: true,
    webhookSecretValid: true,
    fingerprint: 'test-fingerprint',
    });
    getStripeWebhookReadiness.mockResolvedValue({
    ready: true,
    status: 'endpoint_unverified',
    mode: 'test',
  });
});
afterEach(() => jest.restoreAllMocks());

function makeOrder(overrides = {}) {
  const base = {
    _id: ORDER_ID,
    customerId: USER_ID,
    providerId: '507f1f77bcf86cd799439013',
    agreedPrice: 1000,
    status: 'awaiting_payment',
    paymentStatus: 'unpaid',
    serviceId: { title: 'Design mockup', _id: '507f1f77bcf86cd799439014' },
    checkoutSessionId: null,
    checkoutSessionStatus: null,
  };
  return { ...base, ...overrides, populate: jest.fn().mockReturnThis() };
}

describe('SafePay checkout reservations', () => {
  it('blocks a new checkout while a paid webhook is awaiting manual review', async () => {
    StripePaymentIncident.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'incident_1' }),
    });
    const stripe = {
      checkout: { sessions: { retrieve: jest.fn(), create: jest.fn() } },
    };
    getStripeForMode.mockResolvedValue(stripe);

    const res = makeRes();
    await createSafePaySession(
      {
        userId: USER_ID,
        body: { orderId: ORDER_ID },
        protocol: 'https',
        get: jest.fn(() => 'example.com'),
      },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.payload).toMatchObject({ code: 'payment_review_required' });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('fails closed if the payment review state cannot be read', async () => {
    StripePaymentIncident.findOne.mockReturnValue({
      select: jest.fn().mockRejectedValue(new Error('mongo unavailable')),
    });
    const stripe = {
      checkout: { sessions: { retrieve: jest.fn(), create: jest.fn() } },
    };
    getStripeForMode.mockResolvedValue(stripe);

    const res = makeRes();
    await createSafePaySession(
      {
        userId: USER_ID,
        body: { orderId: ORDER_ID },
        protocol: 'https',
        get: jest.fn(() => 'example.com'),
      },
      res
    );

    expect(res.statusCode).toBe(503);
    expect(res.payload).toMatchObject({ code: 'payment_review_unavailable' });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('status polling reads database confirmation only and cannot confirm from a browser redirect', async () => {
    Order.findOne.mockResolvedValue(makeOrder({
      checkoutSessionId: 'cs_test_status',
      checkoutSessionStatus: 'complete',
      paymentStatus: 'unpaid',
    }));

    const res = makeRes();
    await checkoutSessionStatus(
      { params: { sessionId: 'cs_test_status' }, userId: USER_ID },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ payment_status: 'unpaid', status: 'complete' });
    expect(getStripeForMode).not.toHaveBeenCalled();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('blocks checkout before reserving anything when webhook readiness is invalid', async () => {
    const stripe = {
      checkout: { sessions: { retrieve: jest.fn(), create: jest.fn() } },
    };
    getStripeForMode.mockResolvedValue(stripe);
    getStripeWebhookReadiness.mockResolvedValue({
      ready: false,
      status: 'invalid_configuration',
      mode: 'test',
    });

    const res = makeRes();
    await createSafePaySession(
      {
        userId: USER_ID,
        body: { orderId: ORDER_ID },
        protocol: 'https',
        get: jest.fn(() => 'example.com'),
      },
      res
    );

    expect(res.statusCode).toBe(503);
    expect(res.payload).toMatchObject({ code: 'STRIPE_WEBHOOK_NOT_READY' });
    expect(Order.findById).not.toHaveBeenCalled();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(JSON.stringify(res.payload)).not.toMatch(/sk_(test|live)_|whsec_/);
  });

  it('does not claim a second checkout while a prior reservation is still pending', async () => {
    const stripe = {
      checkout: {
        sessions: {
          retrieve: jest.fn().mockResolvedValue({ id: 'cs_pending_existing', status: 'open' }),
          create: jest.fn(),
        },
      },
    };
    getStripeForMode.mockResolvedValue(stripe);

    Order.findById.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(
        makeOrder({ checkoutSessionStatus: 'pending', checkoutSessionId: 'PENDING_123' })
      ),
    });

    const req = {
      userId: USER_ID,
      body: { orderId: ORDER_ID },
      protocol: 'https',
      get: jest.fn(() => 'example.com'),
    };

    const res = makeRes();
    await createSafePaySession(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.payload).toMatchObject({ code: 'checkout_in_progress' });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  describe('a reservation whose Stripe outcome was never recorded, older than the idempotency window', () => {
    // In-memory order whose findOneAndUpdate honours the real compare-and-swap filters.
    function storedOrder(fields) {
      let doc = makeOrder({
        checkoutSessionStatus: 'pending',
        checkoutSessionId: 'PENDING_attempt_old',
        checkoutAttemptId: 'attempt_old',
        checkoutMode: 'test',
        checkoutCustomerId: 'cus_test_123',
        checkoutAmountMinor: 103000,
        checkoutSessionCreatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
        ...fields,
      });
      const matches = (filter) =>
        Object.entries(filter).every(([key, cond]) => {
          if (key === '_id') return true;
          if (key === '$or') return cond.some((sub) => matches(sub));
          const value = doc[key];
          if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
            if ('$in' in cond) return cond.$in.includes(value ?? null);
            if ('$ne' in cond) return value !== cond.$ne;
            if ('$lte' in cond) return value <= cond.$lte;
          }
          return value === cond;
        });
      Order.findById.mockImplementation(() => ({ populate: jest.fn(async () => ({ ...doc })) }));
      Order.findOneAndUpdate.mockImplementation(async (filter, update) => {
        if (!matches(filter)) return null;
        doc = { ...doc, ...update.$set };
        return { ...doc };
      });
      return () => doc;
    }
    const req = () => ({ userId: USER_ID, body: { orderId: ORDER_ID }, protocol: 'https', get: () => 'example.com' });
    const sessionsList = (sessions) => jest.fn(() => (async function* list() { yield* sessions; })());

    it('releases it when Stripe has no session for that attempt, then starts a fresh attempt', async () => {
      jest.spyOn(crypto, 'randomUUID').mockReturnValue('attempt_new');
      const current = storedOrder();
      const stripe = {
        checkout: {
          sessions: {
            list: sessionsList([{ id: 'cs_other', metadata: { checkoutAttemptId: 'someone_else', orderId: ORDER_ID } }]),
            retrieve: jest.fn(),
            create: jest.fn(async () => ({ id: 'cs_fresh', status: 'open', url: 'https://checkout.stripe.com/fresh' })),
          },
        },
      };
      getStripeForMode.mockResolvedValue(stripe);

      const res = makeRes();
      await createSafePaySession(req(), res);

      expect(stripe.checkout.sessions.list).toHaveBeenCalledWith({ customer: 'cus_test_123', limit: 100 });
      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({ url: 'https://checkout.stripe.com/fresh' });
      expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
      // New attempt => new idempotency key; the stale key is never replayed.
      expect(stripe.checkout.sessions.create.mock.calls[0][1]).toEqual({ idempotencyKey: `safepay:${ORDER_ID}:attempt_new` });
      expect(current()).toMatchObject({ checkoutSessionId: 'cs_fresh', checkoutAttemptId: 'attempt_new' });
    });

    it('adopts the session Stripe did create for that attempt instead of creating a second one', async () => {
      const current = storedOrder();
      const created = {
        id: 'cs_lost',
        status: 'open',
        mode: 'payment',
        amount_total: 103000,
        currency: 'nok',
        livemode: false,
        metadata: { orderId: ORDER_ID, userId: USER_ID, checkoutAttemptId: 'attempt_old' },
        url: 'https://checkout.stripe.com/lost',
      };
      const stripe = {
        checkout: {
          sessions: {
            list: sessionsList([created]),
            retrieve: jest.fn(async () => created),
            create: jest.fn(),
          },
        },
      };
      getStripeForMode.mockResolvedValue(stripe);

      const res = makeRes();
      await createSafePaySession(req(), res);

      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(current()).toMatchObject({ checkoutSessionId: 'cs_lost', checkoutSessionStatus: 'open' });
      expect(res.payload).toEqual({ url: 'https://checkout.stripe.com/lost', reused: true });
    });

    it('keeps the lock (support review) when Stripe cannot be asked', async () => {
      const current = storedOrder();
      const stripe = {
        checkout: {
          sessions: {
            list: jest.fn(() => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); }),
            retrieve: jest.fn(),
            create: jest.fn(),
          },
        },
      };
      getStripeForMode.mockResolvedValue(stripe);
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = makeRes();
      await createSafePaySession(req(), res);

      expect(res.statusCode).toBe(409);
      expect(res.payload).toMatchObject({ code: 'checkout_review_required' });
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
      expect(current()).toMatchObject({ checkoutSessionId: 'PENDING_attempt_old', checkoutSessionStatus: 'pending' });
    });
  });

  it('admits only one simultaneous checkout reservation', async () => {
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('attempt_winner');
    let reservationClaimed = false;
    Order.findById.mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(makeOrder()),
    }));
    Order.findOneAndUpdate
      .mockImplementationOnce(async (_filter, update) => {
        reservationClaimed = true;
        return { ...makeOrder(), ...update.$set };
      })
      .mockImplementationOnce(async () => {
        if (reservationClaimed) return null;
        return null;
      })
      .mockResolvedValueOnce({ ...makeOrder(), checkoutSessionId: 'cs_test_winner' });

    let finishCreate;
    const sessionCreated = new Promise((resolve) => {
      finishCreate = resolve;
    });
    const stripe = {
      checkout: {
        sessions: {
          retrieve: jest.fn(),
          create: jest.fn(() => sessionCreated),
        },
      },
    };
    getStripeForMode.mockResolvedValue(stripe);
    const req = {
      userId: USER_ID,
      body: { orderId: ORDER_ID },
      protocol: 'https',
      get: jest.fn(() => 'example.com'),
    };
    const firstRes = makeRes();
    const secondRes = makeRes();
    const first = createSafePaySession(req, firstRes);
    const second = createSafePaySession(req, secondRes);
    await new Promise((resolve) => setTimeout(resolve, 10));
    finishCreate({ id: 'cs_test_winner', status: 'open', url: 'https://checkout.stripe.com/winner' });
    await Promise.all([first, second]);

    expect([firstRes.statusCode, secondRes.statusCode].sort()).toEqual([200, 409]);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('preserves an open reservation when retrieving its session times out', async () => {
    const stripe = {
      checkout: {
        sessions: {
          retrieve: jest.fn().mockRejectedValue({ type: 'StripeConnectionError', code: 'ETIMEDOUT' }),
          create: jest.fn(),
        },
      },
    };
    getStripeForMode.mockResolvedValue(stripe);
    Order.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(
        makeOrder({ checkoutSessionId: 'cs_test_unknown', checkoutSessionStatus: 'open' })
      ),
    });

    const res = makeRes();
    await createSafePaySession(
      { userId: USER_ID, body: { orderId: ORDER_ID }, protocol: 'https', get: () => 'example.com' },
      res
    );

    expect(res.statusCode).toBe(503);
    expect(res.payload).toMatchObject({ code: 'checkout_status_unavailable' });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('reuses an open checkout session instead of making a second active session', async () => {
    const existingSession = {
      id: 'cs_test_123',
      status: 'open',
      mode: 'payment',
      amount_total: 103000,
      currency: 'nok',
      livemode: false,
      metadata: { orderId: ORDER_ID, userId: USER_ID },
      success_url: 'https://example.com/safepay/success?session_id={CHECKOUT_SESSION_ID}&orderId=507f1f77bcf86cd799439011',
      url: 'https://checkout.stripe.com/test_123',
    };
    const stripe = {
      checkout: {
        sessions: {
          retrieve: jest.fn().mockResolvedValue(existingSession),
          create: jest.fn(),
        },
      },
    };
    getStripeForMode.mockResolvedValue(stripe);

    Order.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(
        makeOrder({ checkoutSessionId: existingSession.id, checkoutSessionStatus: 'open' })
      ),
      select: jest.fn().mockResolvedValue(
        makeOrder({ checkoutSessionId: existingSession.id, checkoutSessionStatus: 'open' })
      ),
    });
    Order.findOneAndUpdate.mockResolvedValue(null);

    const req = {
      userId: USER_ID,
      body: { orderId: ORDER_ID },
      protocol: 'https',
      get: jest.fn(() => 'example.com'),
    };

    const res = makeRes();
    await createSafePaySession(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ url: existingSession.url, reused: true });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('uses a deterministic idempotency key when it creates a new Stripe checkout session', async () => {
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('attempt_123');
    const stripe = {
      checkout: {
        sessions: {
          retrieve: jest.fn().mockResolvedValue({ status: 'expired' }),
          create: jest.fn().mockResolvedValue({
            id: 'cs_test_new',
            status: 'open',
            url: 'https://checkout.stripe.com/new',
          }),
        },
      },
    };
    getStripeForMode.mockResolvedValue(stripe);

    Order.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(makeOrder({ checkoutSessionStatus: 'expired' })),
      select: jest.fn().mockResolvedValue(makeOrder({ checkoutSessionStatus: 'expired' })),
    });
    Order.findOneAndUpdate.mockResolvedValueOnce({
      _id: ORDER_ID,
      checkoutSessionId: 'PENDING_attempt_123',
      checkoutAttemptId: 'attempt_123',
      checkoutAmountMinor: 103000,
      checkoutCurrency: 'nok',
      checkoutMode: 'test',
      checkoutCustomerId: 'cus_test_123',
      checkoutSuccessUrl: expect.any(String),
      checkoutCancelUrl: expect.any(String),
      checkoutProductName: 'SafePay: Design mockup',
    }).mockResolvedValueOnce({
      _id: ORDER_ID,
      checkoutSessionId: 'cs_test_new',
      checkoutAttemptId: 'attempt_123',
      checkoutSessionStatus: 'open',
    });
    User.findById.mockResolvedValue({ _id: USER_ID });
    resolveStripeCustomer.mockResolvedValue('cus_test_123');

    const req = {
      userId: USER_ID,
      body: { orderId: ORDER_ID, jobId: 'client_job', jobTitle: 'Client supplied title' },
      protocol: 'https',
      get: jest.fn(() => 'example.com'),
    };

    const res = makeRes();
    await createSafePaySession(req, res);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ idempotencyKey: `safepay:${ORDER_ID}:attempt_123` })
    );
    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.metadata).toMatchObject({
      type: 'safepay_payment',
      jobId: '507f1f77bcf86cd799439014',
      jobTitle: 'Design mockup',
      orderId: ORDER_ID,
    });
    expect(params.payment_intent_data).toMatchObject({
      description: 'SafePay | Job: Design mockup | Job ID: 507f1f77bcf86cd799439014',
      metadata: {
        type: 'safepay_payment',
        jobId: '507f1f77bcf86cd799439014',
        jobTitle: 'Design mockup',
        orderId: ORDER_ID,
      },
    });
    expect(params.line_items[0].price_data).toMatchObject({
      unit_amount: 103000,
      product_data: {
        name: 'SafePay: Design mockup',
        description: 'SafePay | Job: Design mockup | Job ID: 507f1f77bcf86cd799439014',
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('bounds Stripe metadata, description, and product name for long job titles', async () => {
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('attempt_long_title');
    const longTitle = 'House Cleaning '.repeat(60);
    const stripe = {
      checkout: {
        sessions: {
          retrieve: jest.fn().mockResolvedValue({ status: 'expired' }),
          create: jest.fn().mockResolvedValue({
            id: 'cs_test_long_title',
            status: 'open',
            url: 'https://checkout.stripe.com/long-title',
          }),
        },
      },
    };
    getStripeForMode.mockResolvedValue(stripe);
    Order.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(
        makeOrder({
          serviceId: { _id: '507f1f77bcf86cd799439014', title: longTitle },
          checkoutSessionStatus: 'expired',
        })
      ),
    });
    Order.findOneAndUpdate.mockResolvedValueOnce({
      _id: ORDER_ID,
      checkoutSessionId: 'PENDING_attempt_long_title',
      checkoutAttemptId: 'attempt_long_title',
      checkoutAmountMinor: 103000,
      checkoutCurrency: 'nok',
      checkoutMode: 'test',
      checkoutCustomerId: 'cus_test_123',
      checkoutSuccessUrl: 'https://example.com/success',
      checkoutCancelUrl: 'https://example.com/cancel',
      checkoutProductName: 'SafePay: House Cleaning',
    }).mockResolvedValueOnce({
      _id: ORDER_ID,
      checkoutSessionId: 'cs_test_long_title',
      checkoutSessionStatus: 'open',
    });

    const res = makeRes();
    await createSafePaySession(
      {
        userId: USER_ID,
        body: { orderId: ORDER_ID },
        protocol: 'https',
        get: jest.fn(() => 'example.com'),
      },
      res
    );

    const params = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(params.metadata.jobTitle).toHaveLength(500);
    expect(params.payment_intent_data.metadata.jobTitle).toHaveLength(500);
    expect(params.payment_intent_data.description).toHaveLength(500);
    expect(params.line_items[0].price_data.product_data.name.length).toBeLessThanOrEqual(250);
    expect(params.line_items[0].price_data.product_data.description.length).toBeLessThanOrEqual(500);
    expect(params.payment_intent_data.description).toContain(
      '| Job ID: 507f1f77bcf86cd799439014'
    );
  });

  it('rejects checkout safely when the job service record is missing', async () => {
    const stripe = {
      checkout: { sessions: { retrieve: jest.fn(), create: jest.fn() } },
    };
    getStripeForMode.mockResolvedValue(stripe);
    Order.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(makeOrder({ serviceId: null })),
    });

    const res = makeRes();
    await createSafePaySession(
      {
        userId: USER_ID,
        body: { orderId: ORDER_ID },
        protocol: 'https',
        get: jest.fn(() => 'example.com'),
      },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.payload.code).toBe('service_missing');
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
