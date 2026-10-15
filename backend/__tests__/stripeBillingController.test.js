const mockBillingOperations = new Map();
jest.mock('../models/StripeBillingOperation', () => ({
  findOne: jest.fn(({ fingerprint }) =>
    Promise.resolve(
      [...mockBillingOperations.values()].find(
        (operation) =>
          operation.fingerprint === fingerprint &&
          ['pending', 'reconciliation_required'].includes(operation.status)
      ) || null
    )
  ),
  create: jest.fn(async (operation) => {
    const saved = { _id: `billing_${mockBillingOperations.size + 1}`, ...operation };
    mockBillingOperations.set(saved.operationId, saved);
    return saved;
  }),
  updateOne: jest.fn(async ({ _id }, update) => {
    const operation = [...mockBillingOperations.values()].find((entry) => entry._id === _id);
    if (operation) Object.assign(operation, update.$set);
    return { modifiedCount: operation ? 1 : 0 };
  }),
}));
jest.mock('../models/Subscription', () => ({
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));
jest.mock('../models/SubscriptionPlan', () => ({ findById: jest.fn() }));
jest.mock('../models/Transaction', () => ({ find: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));
jest.mock('../services/stripe/customers', () => ({
  customerFieldForMode: jest.fn((testMode) =>
    testMode ? 'stripeCustomerIdTest' : 'stripeCustomerId'
  ),
}));
jest.mock('../services/stripe/planPrice', () => ({
  ensureStripePlanPrice: jest.fn(),
}));
jest.mock('../services/stripe/provisioning', () => ({
  applyInvoicePaid: jest.fn(),
  applyInvoicePaymentFailed: jest.fn(),
  applySubscriptionUpdated: jest.fn(),
  subscriptionPeriodEnd: jest.fn((sub) => new Date((sub.current_period_end || sub.period_end) * 1000)),
  invoiceSubscriptionId: jest.fn((invoice) => invoice.subscription),
}));
jest.mock('../services/stripe/webhookReadiness', () => ({
  getStripeWebhookReadiness: jest.fn(),
}));
jest.mock('../services/admin/activityService', () => ({ logActivity: jest.fn() }));

const Subscription = require('../models/Subscription');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');
const { ensureStripePlanPrice } = require('../services/stripe/planPrice');
const controller = require('../controllers/stripeBillingController');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

let stripe;
let record;
let liveSubscription;
const USER_ID = '507f1f77bcf86cd799439011';
const CURRENT_PLAN_ID = '507f1f77bcf86cd799439022';
const TARGET_PLAN_ID = '507f1f77bcf86cd799439033';

beforeEach(() => {
  jest.clearAllMocks();
  mockBillingOperations.clear();
  process.env.FRONTEND_URL = 'https://jobblo.no';
  getStripeConfiguration.mockResolvedValue({ testMode: true });
  record = {
    userId: USER_ID,
    currentPlan: {
      planId: CURRENT_PLAN_ID,
      plan: 'Basic',
      planType: 'private',
      stripeSubscriptionId: 'sub_test_1',
      stripeMode: 'test',
      status: 'active',
    },
    pendingPlan: undefined,
    save: jest.fn().mockResolvedValue(undefined),
  };
  liveSubscription = {
    id: 'sub_test_1',
    status: 'active',
    livemode: false,
    cancel_at_period_end: false,
    customer: 'cus_test_1',
    start_date: 1_791_000_000,
    current_period_end: Math.floor(Date.now() / 1000) + 86_400,
    metadata: { userId: USER_ID },
    items: {
      data: [
        {
          id: 'si_1',
          quantity: 1,
          price: { id: 'price_current', unit_amount: 30000, currency: 'nok' },
        },
      ],
    },
  };
  stripe = {
    subscriptions: {
      retrieve: jest.fn().mockResolvedValue(liveSubscription),
      update: jest.fn().mockResolvedValue(liveSubscription),
    },
    customers: {
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_test_1', deleted: false }),
    },
    billingPortal: {
      sessions: { create: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.test/p1' }) },
    },
    invoices: {
      createPreview: jest.fn().mockResolvedValue({ amount_due: 5000, currency: 'nok' }),
      retrieve: jest.fn(),
      list: jest.fn().mockResolvedValue({ data: [] }),
    },
    prices: { retrieve: jest.fn() },
    subscriptionSchedules: {
      create: jest.fn().mockResolvedValue({
        id: 'sched_1',
        current_phase: { start_date: 1_791_000_000 },
        metadata: {},
      }),
      retrieve: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'sched_1' }),
      release: jest.fn(),
    },
  };
  getStripeForMode.mockResolvedValue(stripe);
  User.findById.mockResolvedValue({
    _id: USER_ID,
    role: 'user',
    stripeCustomerId: 'cus_live_1',
    stripeCustomerIdTest: 'cus_test_1',
  });
  Subscription.findOne.mockResolvedValue(record);
  SubscriptionPlan.findById.mockResolvedValue({
    _id: TARGET_PLAN_ID,
    name: 'Target',
    type: 'private',
    price: 400,
    isActive: true,
  });
  ensureStripePlanPrice.mockResolvedValue('price_target');
  stripe.prices.retrieve.mockResolvedValue({
    id: 'price_target',
    unit_amount: 40000,
    currency: 'nok',
  });
});

describe('authenticated subscription billing actions', () => {
  it('creates a customer portal session in the subscription’s stored Stripe mode', async () => {
    const res = response();
    await controller.createPortalSession({ userId: USER_ID }, res);

    expect(getStripeForMode).toHaveBeenCalledWith(true);
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: 'cus_test_1',
      return_url: 'https://jobblo.no/membership',
    });
    expect(res.body.url).toBe('https://billing.stripe.test/p1');
  });

  it('refuses to manage a subscription attached to a different Stripe customer', async () => {
    liveSubscription.customer = 'cus_victim';
    const res = response();

    await controller.createPortalSession({ userId: USER_ID }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.message).not.toContain('cus_victim');
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it('previews an immediate upgrade with Stripe proration before changing it', async () => {
    const res = response();
    await controller.previewPlanChange({ userId: USER_ID, body: { planId: TARGET_PLAN_ID } }, res);

    expect(res.body).toMatchObject({
      strategy: 'immediate',
      amountDueNow: 5000,
      currency: 'nok',
    });
    expect(stripe.invoices.createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription: 'sub_test_1',
        subscription_details: expect.objectContaining({
          proration_behavior: 'always_invoice',
        }),
      })
    );
  });

  it('schedules a lower-priced plan at the end of the current paid period', async () => {
    SubscriptionPlan.findById.mockResolvedValue({
      _id: TARGET_PLAN_ID,
      name: 'Lower plan',
      type: 'private',
      price: 200,
      isActive: true,
    });
    stripe.prices.retrieve.mockResolvedValue({
      id: 'price_target',
      unit_amount: 20000,
      currency: 'nok',
    });
    const res = response();
    await controller.changePlan({ userId: USER_ID, body: { planId: TARGET_PLAN_ID } }, res);

    expect(res.body.strategy).toBe('period_end');
    expect(stripe.subscriptionSchedules.create).toHaveBeenCalledWith(
      { from_subscription: 'sub_test_1' },
      expect.objectContaining({ idempotencyKey: expect.stringContaining('downgrade') })
    );
    expect(stripe.subscriptionSchedules.update).toHaveBeenCalledWith(
      'sched_1',
      expect.objectContaining({
        end_behavior: 'release',
        phases: expect.arrayContaining([
          expect.objectContaining({ proration_behavior: 'none' }),
        ]),
      }),
      expect.objectContaining({ idempotencyKey: expect.stringContaining('schedule_update') })
    );
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(record.pendingPlan.plan).toBe('Lower plan');
  });

  it('replays an already confirmed downgrade without creating another schedule', async () => {
    const effectiveAt = new Date('2026-01-01T00:00:00.000Z');
    record.pendingPlan = { planId: TARGET_PLAN_ID, effectiveAt };
    liveSubscription.schedule = 'sched_1';
    stripe.subscriptionSchedules.retrieve.mockResolvedValue({
      id: 'sched_1',
      metadata: {
        jobbloPendingPlanId: TARGET_PLAN_ID,
        jobbloUserId: USER_ID,
      },
    });
    SubscriptionPlan.findById.mockResolvedValue({
      _id: TARGET_PLAN_ID,
      name: 'Target',
      type: 'private',
      price: 200,
      isActive: true,
    });
    stripe.prices.retrieve.mockResolvedValue({
      id: 'price_target',
      unit_amount: 20000,
      currency: 'nok',
    });
    const res = response();

    await controller.changePlan({ userId: USER_ID, body: { planId: TARGET_PLAN_ID } }, res);

    expect(res.body).toMatchObject({ strategy: 'period_end', effectiveAt });
    expect(stripe.subscriptionSchedules.create).not.toHaveBeenCalled();
    expect(stripe.subscriptionSchedules.update).not.toHaveBeenCalled();
  });

  it('does not allow an invoice PDF to be retrieved from another customer', async () => {
    stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_other',
      customer: 'cus_victim',
      invoice_pdf: 'https://stripe.example/private.pdf',
    });
    const res = response();
    await controller.downloadInvoicePdf(
      { userId: USER_ID, params: { invoiceId: 'in_other' }, query: { mode: 'test' } },
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.url).toBeUndefined();
  });

  it('returns a PDF link only when the invoice belongs to the authenticated customer', async () => {
    stripe.invoices.retrieve.mockResolvedValue({
      id: 'in_owned',
      customer: 'cus_test_1',
      invoice_pdf: 'https://stripe.example/owned.pdf',
    });
    const res = response();
    await controller.downloadInvoicePdf(
      { userId: USER_ID, params: { invoiceId: 'in_owned' }, query: { mode: 'test' } },
      res
    );

    expect(res.body).toEqual({ url: 'https://stripe.example/owned.pdf' });
  });
});
