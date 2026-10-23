const mongoose = require('mongoose');
const {
  SubscriptionV2Error,
  checkoutEnabled,
  createSubscriptionCheckoutSession,
  getSubscriptionCheckoutStatus,
  returnUrls,
} = require('../services/subscriptions/v2Checkout');

const userId = new mongoose.Types.ObjectId();
const planId = new mongoose.Types.ObjectId();

function fixture(overrides = {}) {
  const plan = {
    _id: planId,
    name: 'Plus',
    price: 99,
    type: 'private',
    isActive: true,
    stripePriceId: 'price_live',
    stripePriceIdTest: 'price_test',
    stripeProductId: 'prod_live',
    stripeProductIdTest: 'prod_test',
  };
  const operation = {
    _id: new mongoose.Types.ObjectId(),
    operationId: 'operation-v2-1',
    idempotencyKey: 'stable-key',
    stripeMode: 'test',
    operationType: 'checkout',
    status: 'pending',
    userId,
    targetPlanId: planId,
    stripePriceId: 'price_test',
    stripeCustomerId: 'cus_test',
    stripeCheckoutSessionId: null,
  };
  const models = {
    PlanModel: { findById: jest.fn(() => ({ lean: async () => plan })) },
    SubscriptionV2Model: { findOne: jest.fn(() => ({ lean: async () => null })) },
    OperationModel: {
      findOne: jest.fn(async () => null),
      findById: jest.fn(async () => operation),
      create: jest.fn(async (data) => ({ ...operation, ...data })),
      findOneAndUpdate: jest.fn(async () => ({ ...operation })),
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    },
    UserModel: { findByIdAndUpdate: jest.fn(async () => ({ _id: userId })) },
  };
  const stripe = {
    prices: {
      retrieve: jest.fn(async (id) => ({
        id,
        active: true,
        livemode: false,
        currency: 'nok',
        type: 'recurring',
        recurring: { interval: 'month', interval_count: 1 },
        unit_amount: 9900,
        product: 'prod_test',
      })),
    },
    subscriptions: {
      retrieve: jest.fn(async () => ({ status: 'canceled' })),
      list: jest.fn(async () => ({ data: [], has_more: false })),
    },
    customers: {
      retrieve: jest.fn(async () => ({
        id: 'cus_test',
        deleted: false,
        metadata: { userId: String(userId) },
      })),
      create: jest.fn(async () => ({ id: 'cus_created' })),
    },
    checkout: {
      sessions: {
        retrieve: jest.fn(async () => ({ status: 'open', url: 'https://stripe.test/open' })),
        create: jest.fn(async () => ({
          id: 'cs_test',
          url: 'https://stripe.test/checkout',
          mode: 'subscription',
        })),
      },
    },
  };
  const dependencies = {
    ...models,
    mongoose: { Types: mongoose.Types },
    getConfiguration: jest.fn(async () => ({
      testMode: true,
      mode: 'test',
      secretKey: 'sk_test_mock',
      keyModeValid: true,
    })),
    stripeForMode: jest.fn(async (testMode) => {
      if (testMode !== true) throw new Error('wrong Stripe mode');
      return stripe;
    }),
    env: { FRONTEND_URL: 'https://jobblo.example/' },
    ...overrides,
  };
  return {
    plan,
    operation,
    stripe,
    dependencies,
    user: {
      _id: userId,
      role: 'provider',
      planType: 'private',
      email: 'buyer@example.test',
      name: 'Buyer',
      stripeCustomerIdTest: 'cus_test',
    },
  };
}

async function startCheckout(f, input = {}) {
  return createSubscriptionCheckoutSession(
    { user: f.user, planId: String(planId), ...input },
    f.dependencies
  );
}

describe('Subscription V2 checkout service', () => {
  test('creates a server-priced monthly NOK subscription with trusted metadata and stable idempotency', async () => {
    const f = fixture();

    await expect(startCheckout(f)).resolves.toEqual({ url: 'https://stripe.test/checkout' });

    const createdOperation = await f.dependencies.OperationModel.create.mock.results[0].value;
    expect(f.dependencies.stripeForMode).toHaveBeenCalledWith(true);
    expect(f.stripe.prices.retrieve).toHaveBeenCalledWith('price_test');
    expect(f.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_test',
        client_reference_id: String(userId),
        line_items: [{ price: 'price_test', quantity: 1 }],
        metadata: {
          subscriptionV2: 'true',
          userId: String(userId),
          planId: String(planId),
          operationId: createdOperation.operationId,
          stripeMode: 'test',
        },
        subscription_data: {
          metadata: expect.objectContaining({ subscriptionV2: 'true' }),
        },
        success_url: 'https://jobblo.example/subscription/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://jobblo.example/membership?checkout=cancelled',
      }),
      { idempotencyKey: `jobblo-subv2-test-${createdOperation.idempotencyKey}` }
    );
    expect(f.dependencies.OperationModel.updateOne).toHaveBeenCalledWith(
      { _id: f.operation._id, status: 'pending' },
      {
        $set: expect.objectContaining({
          stripeCheckoutSessionId: 'cs_test',
          stripeCustomerId: 'cus_test',
        }),
      }
    );
  });

  test('rejects a business plan for a private account and vice versa', async () => {
    const f = fixture();
    f.plan.type = 'business';
    await expect(startCheckout(f)).rejects.toMatchObject({ code: 'plan_type_not_allowed' });
    expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test('rejects unknown, inactive, and free plans', async () => {
    const missing = fixture({
      PlanModel: { findById: jest.fn(() => ({ lean: async () => null })) },
    });
    await expect(startCheckout(missing)).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });

    const inactive = fixture();
    inactive.plan.isActive = false;
    await expect(startCheckout(inactive)).rejects.toMatchObject({ code: 'plan_inactive' });

    const free = fixture();
    free.plan.price = 0;
    await expect(startCheckout(free)).rejects.toMatchObject({
      code: 'FREE_PLAN_CHECKOUT_NOT_ALLOWED',
    });
  });

  test('rejects absent, wrong-mode, non-monthly, wrong-currency, and wrong-amount prices', async () => {
    const noPrice = fixture();
    noPrice.plan.stripePriceIdTest = undefined;
    await expect(startCheckout(noPrice)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_PRICE_UNCONFIGURED',
    });

    for (const priceOverride of [
      { livemode: true },
      { recurring: { interval: 'year', interval_count: 1 } },
      { currency: 'usd' },
      { unit_amount: 14900 },
      { active: false },
    ]) {
      const f = fixture();
      f.stripe.prices.retrieve.mockResolvedValue({
        id: 'price_test',
        active: true,
        livemode: false,
        currency: 'nok',
        type: 'recurring',
        recurring: { interval: 'month', interval_count: 1 },
        unit_amount: 9900,
        product: 'prod_test',
        ...priceOverride,
      });
      await expect(startCheckout(f)).rejects.toMatchObject({
        code: 'SUBSCRIPTION_PRICE_INVALID',
      });
    }
  });

  test('rejects unavailable Stripe configuration and verifies test/live price selection', async () => {
    const missing = fixture({
      getConfiguration: jest.fn(async () => ({
        testMode: true,
        mode: 'test',
        secretKey: null,
        keyModeValid: false,
      })),
    });
    await expect(startCheckout(missing)).rejects.toMatchObject({
      code: 'STRIPE_CONFIGURATION_UNAVAILABLE',
    });

    const live = fixture({
      getConfiguration: jest.fn(async () => ({
        testMode: false,
        mode: 'live',
        secretKey: 'sk_live_mock',
        keyModeValid: true,
      })),
      stripeForMode: jest.fn(async (testMode) => {
        if (testMode !== false) throw new Error('wrong Stripe mode');
        return {
          ...fixture().stripe,
          prices: {
            retrieve: jest.fn(async (id) => ({
              id,
              active: true,
              livemode: true,
              currency: 'nok',
              type: 'recurring',
              recurring: { interval: 'month', interval_count: 1 },
              unit_amount: 9900,
              product: 'prod_live',
            })),
          },
          customers: {
            retrieve: jest.fn(async () => ({
              deleted: false,
              metadata: { userId: String(userId) },
            })),
          },
        };
      }),
    });
    live.user.stripeCustomerId = 'cus_live';
    live.user.stripeCustomerIdTest = undefined;
    await startCheckout(live);
    expect(live.dependencies.stripeForMode).toHaveBeenCalledWith(false);
  });

  test('blocks an existing V2 subscriber and fails closed on V2 status lookup errors', async () => {
    const v2 = fixture({
      SubscriptionV2Model: { findOne: () => ({ lean: async () => ({
        stripeMode: 'test',
        stripeSubscriptionId: 'sub_v2',
      }) }) },
    });
    v2.stripe.subscriptions.retrieve.mockResolvedValue({ status: 'active' });
    await expect(startCheckout(v2)).rejects.toMatchObject({ code: 'active_subscription_exists' });

    const unavailable = fixture();
    unavailable.dependencies.SubscriptionV2Model.findOne.mockImplementation(() => {
      throw new Error('database unavailable');
    });
    await expect(startCheckout(unavailable)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_STATUS_UNAVAILABLE',
    });
  });

  test('does not query historical subscription collections or enumerate stored Stripe customers', async () => {
    const f = fixture();
    await startCheckout(f);

    expect(f.stripe.subscriptions.list).not.toHaveBeenCalled();
    expect(f.dependencies.mongoose.connection).toBeUndefined();
  });

  test('returns an existing open checkout instead of creating another session', async () => {
    const f = fixture({
      OperationModel: {
        findOne: jest.fn(async () => ({
          ...fixture().operation,
          stripeCheckoutSessionId: 'cs_open',
        })),
        findById: jest.fn(),
        create: jest.fn(),
        findOneAndUpdate: jest.fn(),
        updateOne: jest.fn(),
      },
    });
    await expect(startCheckout(f)).resolves.toEqual({ url: 'https://stripe.test/open' });
    expect(f.stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_open');
    expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test('creates a new mode-specific customer with a stable operation key when needed', async () => {
    const f = fixture();
    f.user.stripeCustomerIdTest = undefined;
    await startCheckout(f);

    const createdOperation = await f.dependencies.OperationModel.create.mock.results[0].value;
    expect(f.stripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: f.user.email,
        metadata: { userId: String(userId) },
      }),
      { idempotencyKey: `jobblo-subv2-customer-test-${createdOperation.operationId}` }
    );
    expect(f.dependencies.UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      { stripeCustomerIdTest: 'cus_created' }
    );
  });

  test('rejects another account checkout in progress and duplicate request creation', async () => {
    const pendingOperation = { ...fixture().operation, targetPlanId: new mongoose.Types.ObjectId() };
    const otherPlan = fixture({
      OperationModel: {
        findOne: jest.fn(async () => pendingOperation),
        findById: jest.fn(),
        create: jest.fn(),
        findOneAndUpdate: jest.fn(),
        updateOne: jest.fn(),
      },
    });
    await expect(startCheckout(otherPlan)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_CHECKOUT_IN_PROGRESS',
    });

    const concurrent = fixture({
      OperationModel: {
        findOne: jest.fn(async () => pendingOperation),
        findById: jest.fn(),
        create: jest.fn(async () => {
          const err = new Error('duplicate pending checkout');
          err.code = 11000;
          throw err;
        }),
        findOneAndUpdate: jest.fn(async () => null),
        updateOne: jest.fn(),
      },
    });
    await expect(startCheckout(concurrent)).rejects.toMatchObject({
      code: 'SUBSCRIPTION_CHECKOUT_IN_PROGRESS',
    });
    expect(concurrent.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  test('rejects legacy coupon codes rather than silently charging a different amount', async () => {
    const f = fixture();
    await expect(startCheckout(f, { couponCode: 'OLD-PROMO' })).rejects.toMatchObject({
      code: 'SUBSCRIPTION_PROMOTION_NOT_SUPPORTED',
    });
  });

  test('returns paid and provisioning status from the owned session and V2 record without mutations', async () => {
    const f = fixture();
    const sessionId = 'cs_test_status';
    f.operation.stripeCheckoutSessionId = sessionId;
    const session = {
      id: sessionId,
      mode: 'subscription',
      livemode: false,
      status: 'complete',
      payment_status: 'paid',
      customer: 'cus_test',
      subscription: 'sub_status',
      client_reference_id: String(userId),
      metadata: {
        subscriptionV2: 'true',
        userId: String(userId),
        planId: String(planId),
        operationId: f.operation.operationId,
        stripeMode: 'test',
      },
      amount_total: 9900,
      currency: 'nok',
      total_details: { amount_discount: 0 },
    };
    f.dependencies.OperationModel.findOne.mockReturnValue({ lean: async () => f.operation });
    f.dependencies.SubscriptionV2Model.findOne.mockReturnValue({
      lean: async () => ({
        stripeMode: 'test',
        stripeSubscriptionId: 'sub_status',
        stripeCustomerId: 'cus_test',
        status: 'active',
      }),
    });
    f.stripe.checkout.sessions.retrieve.mockResolvedValue(session);

    await expect(getSubscriptionCheckoutStatus(userId, sessionId, f.dependencies)).resolves.toEqual({
      payment_status: 'paid',
      provisioning_status: 'complete',
      checkout_status: 'complete',
      plan: 'Plus',
      planType: 'private',
      amount: 99,
      currency: 'nok',
      discountAmount: 0,
      coupon: null,
      subscription_status: 'active',
    });
    expect(f.dependencies.OperationModel.updateOne).not.toHaveBeenCalled();
  });

  test('reports webhook provisioning as pending and hides sessions not owned by the user', async () => {
    const f = fixture();
    const sessionId = 'cs_test_pending';
    f.operation.stripeCheckoutSessionId = sessionId;
    f.dependencies.OperationModel.findOne.mockReturnValue({ lean: async () => f.operation });
    f.dependencies.SubscriptionV2Model.findOne.mockReturnValue({ lean: async () => null });
    const session = {
      id: sessionId,
      mode: 'subscription',
      livemode: false,
      status: 'complete',
      payment_status: 'paid',
      customer: 'cus_test',
      subscription: 'sub_pending',
      client_reference_id: String(userId),
      metadata: {
        subscriptionV2: 'true',
        userId: String(userId),
        planId: String(planId),
        operationId: f.operation.operationId,
        stripeMode: 'test',
      },
      amount_total: 9900,
      currency: 'nok',
    };
    f.stripe.checkout.sessions.retrieve.mockResolvedValue(session);
    await expect(getSubscriptionCheckoutStatus(userId, sessionId, f.dependencies))
      .resolves.toEqual(expect.objectContaining({
        payment_status: 'paid',
        provisioning_status: 'pending',
        checkout_status: 'processing',
      }));

    session.amount_total = 10000;
    await expect(getSubscriptionCheckoutStatus(userId, sessionId, f.dependencies))
      .rejects.toMatchObject({ status: 503, code: 'SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED' });
    session.amount_total = 9900;

    f.dependencies.OperationModel.findOne.mockReturnValue({ lean: async () => null });
    await expect(getSubscriptionCheckoutStatus(userId, 'cs_test_other', f.dependencies))
      .rejects.toMatchObject({ status: 404, code: 'CHECKOUT_SESSION_NOT_FOUND' });
  });

  test('feature flag is opt-in and return URL configuration is validated', () => {
    expect(checkoutEnabled({})).toBe(false);
    expect(checkoutEnabled({ SUBSCRIPTION_V2_CHECKOUT_ENABLED: 'true' })).toBe(true);
    expect(() => returnUrls({ FRONTEND_URL: 'javascript:alert(1)' })).toThrow(SubscriptionV2Error);
    expect(() =>
      returnUrls({ FRONTEND_URL: 'http://jobblo.example', NODE_ENV: 'production' })
    ).toThrow(SubscriptionV2Error);
  });
});
