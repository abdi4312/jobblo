const express = require('express');
const request = require('supertest');
const { Types } = require('mongoose');

const mockUserId = new Types.ObjectId();

jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    if (!req.get('authorization')) {
      return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' });
    }
    req.user = { _id: mockUserId };
    return next();
  },
  requireAdmin: (req, res, next) => next(),
}));
jest.mock('../services/subscriptions/v2Management', () => {
  class SubscriptionManagementError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    SubscriptionManagementError,
    getCurrentSubscription: jest.fn(),
    getBillingHistory: jest.fn(),
    getInvoicePdf: jest.fn(),
    cancelSubscription: jest.fn(),
    cancelScheduledPlanChange: jest.fn(),
    resumeSubscription: jest.fn(),
    createBillingPortalSession: jest.fn(),
    previewPlanChange: jest.fn(),
    changePlan: jest.fn(),
  };
});
jest.mock('../services/subscriptions/v2Entitlements', () => ({
  V2EntitlementError: class V2EntitlementError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  enabled: jest.fn(() => process.env.SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED === 'true'),
  resolveEntitlements: jest.fn(),
}));
jest.mock('../services/subscriptions/v2Checkout', () => ({
  SubscriptionV2Error: class SubscriptionV2Error extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  checkoutEnabled: jest.fn(() => process.env.SUBSCRIPTION_V2_CHECKOUT_ENABLED === 'true'),
  createSubscriptionCheckoutSession: jest.fn(),
  getSubscriptionCheckoutStatus: jest.fn(),
}));
jest.mock('../models/SubscriptionPlan', () => ({ find: jest.fn() }));
jest.mock('../models/SubscriptionV2', () => ({ exists: jest.fn() }));
jest.mock('../models/Transaction', () => ({ aggregate: jest.fn() }));

const management = require('../services/subscriptions/v2Management');
const entitlements = require('../services/subscriptions/v2Entitlements');
const checkout = require('../services/subscriptions/v2Checkout');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const SubscriptionV2 = require('../models/SubscriptionV2');
const Transaction = require('../models/Transaction');
const subscriptionController = require('../controllers/subscriptionV2Controller');

const app = express();
app.use(express.json());
app.use('/api/stripe', require('../routes/stripe'));
app.use('/api/plans', require('../routes/subscriptionPlan'));

function enabledFlags() {
  process.env.SUBSCRIPTION_V2_CHECKOUT_ENABLED = 'true';
  process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED = 'true';
  process.env.SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED = 'true';
}

function disableFlags() {
  delete process.env.SUBSCRIPTION_V2_CHECKOUT_ENABLED;
  delete process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED;
  delete process.env.SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED;
  delete process.env.SUBSCRIPTION_V2_PLAN_CATALOGUE_ENABLED;
}

beforeEach(() => {
  jest.clearAllMocks();
  disableFlags();
  SubscriptionV2.exists.mockResolvedValue(null);
  Transaction.aggregate.mockResolvedValue([]);
});

afterAll(disableFlags);

describe('legacy URLs backed by Subscription V2', () => {
  test('keeps old URLs on the rebuild response when their V2 flags are off', async () => {
    for (const [method, path] of [
      ['get', '/api/plans'],
      ['get', '/api/stripe/subscription'],
      ['post', '/api/stripe/create-checkout-session'],
      ['post', '/api/stripe/subscription/cancel'],
      ['post', '/api/stripe/subscription/resume'],
      ['post', '/api/stripe/subscription/change/cancel'],
      ['post', '/api/stripe/subscription/portal'],
      ['get', '/api/stripe/subscription/billing-history'],
      ['get', '/api/stripe/checkout-session/cs_test_1'],
    ]) {
      const builder = request(app)[method](path);
      if (path === '/api/stripe/subscription') builder.set('Authorization', 'test-token');
      const response = await builder;
      expect(response.status).toBe(503);
      expect(response.body.code).toBe('SUBSCRIPTION_REBUILD_IN_PROGRESS');
    }
    expect(management.cancelSubscription).not.toHaveBeenCalled();
    expect(checkout.createSubscriptionCheckoutSession).not.toHaveBeenCalled();
    expect(checkout.getSubscriptionCheckoutStatus).not.toHaveBeenCalled();
  });

  test('requires authentication when a compatibility adapter is enabled', async () => {
    enabledFlags();
    const response = await request(app).post('/api/stripe/subscription/cancel');
    expect(response.status).toBe(401);
    expect(management.cancelSubscription).not.toHaveBeenCalled();
  });

  test('serves V2 entitlements to the authenticated V2 owner while the flag is off', async () => {
    SubscriptionV2.exists.mockResolvedValue({ _id: mockUserId });
    entitlements.resolveEntitlements.mockResolvedValue({
      plan: { name: 'Pro', price: 149 },
      includedContacts: 35,
      consumedIncludedContacts: 1,
      remainingIncludedContacts: 34,
    });

    const response = await request(app)
      .get('/api/stripe/v2/entitlements?userId=another-user')
      .set('Authorization', '******');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      includedContacts: 35,
      consumedIncludedContacts: 1,
      remainingIncludedContacts: 34,
    }));
    expect(SubscriptionV2.exists).toHaveBeenCalledWith({ userId: mockUserId });
    expect(entitlements.resolveEntitlements).toHaveBeenCalledWith(mockUserId);
  });

  test('keeps flag-off entitlement reads disabled for legacy users', async () => {
    const response = await request(app)
      .get('/api/stripe/v2/entitlements')
      .set('Authorization', '******');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED');
    expect(entitlements.resolveEntitlements).not.toHaveBeenCalled();
  });

  test('serves the existing UI subscription summary to a V2 owner with management disabled', async () => {
    SubscriptionV2.exists.mockResolvedValue({ _id: mockUserId });
    entitlements.resolveEntitlements.mockResolvedValue({
      status: 'active',
      plan: { id: 'plan-pro', name: 'Pro', price: 149 },
      planType: 'private',
      isPaid: true,
      includedContacts: 35,
      consumedIncludedContacts: 1,
      remainingIncludedContacts: 34,
      purchasedExtraContacts: 0,
      consumedExtraContacts: 0,
      entitlements: {},
    });
    management.getCurrentSubscription.mockResolvedValue({
      subscription: { stripeSubscriptionId: 'sub_owned', stripeStatus: 'active' },
    });

    const response = await request(app)
      .get('/api/stripe/subscription')
      .set('Authorization', '******');

    expect(response.status).toBe(200);
    expect(response.body.subscription.plan).toBe('Pro');
    expect(response.body.subscription.contacts).toEqual(expect.objectContaining({
      includedLimit: 35,
      includedUsed: 1,
      includedRemaining: 34,
    }));
    expect(SubscriptionV2.exists).toHaveBeenCalledWith({ userId: mockUserId });
    expect(management.cancelSubscription).not.toHaveBeenCalled();
  });

  test('keeps the UI subscription summary unavailable to legacy users while flags are off', async () => {
    const response = await request(app)
      .get('/api/stripe/subscription')
      .set('Authorization', '******');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('SUBSCRIPTION_REBUILD_IN_PROGRESS');
    expect(entitlements.resolveEntitlements).not.toHaveBeenCalled();
    expect(management.getCurrentSubscription).not.toHaveBeenCalled();
  });

  test('does not enable subscription mutations when V2 read access is allowed', async () => {
    SubscriptionV2.exists.mockResolvedValue({ _id: mockUserId });

    const response = await request(app)
      .post('/api/stripe/subscription/cancel')
      .set('Authorization', '******');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('SUBSCRIPTION_REBUILD_IN_PROGRESS');
    expect(management.cancelSubscription).not.toHaveBeenCalled();
  });

  test('serves a read-only plan list with the UI fields from seeded plan values', async () => {
    enabledFlags();
    const seeded = {
      _id: new Types.ObjectId(),
      name: 'Plus',
      price: 99,
      type: 'private',
      entitlements: { freeContact: 15, perContactPrice: 29, ContactUnlock: 60 },
      featuresText: ['15 kontakter'],
      isActive: true,
      stripePriceId: 'must-not-leak',
    };
    const query = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([seeded]),
    };
    SubscriptionPlan.find.mockReturnValue(query);

    const response = await request(app).get('/api/plans');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([expect.objectContaining({
      _id: String(seeded._id),
      name: 'Plus',
      price: 99,
      type: 'private',
      freeViews: 15,
      pricePerExtraView: 29,
      features: ['15 kontakter'],
      featuresText: ['15 kontakter'],
      isActive: true,
    })]);
    expect(response.body[0]).not.toHaveProperty('stripePriceId');
    expect(SubscriptionPlan.find).toHaveBeenCalledWith({ isActive: { $ne: false } });
  });

  test('serves the read-only catalogue on its own flag without enabling checkout', async () => {
    process.env.SUBSCRIPTION_V2_PLAN_CATALOGUE_ENABLED = 'true';
    const query = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ name: 'Pro', price: 149, type: 'private' }]),
    };
    SubscriptionPlan.find.mockReturnValue(query);

    const catalogue = await request(app).get('/api/plans');
    const checkoutResponse = await request(app).post('/api/stripe/create-checkout-session');

    expect(catalogue.status).toBe(200);
    expect(checkoutResponse.status).toBe(503);
    expect(checkoutResponse.body.code).toBe('SUBSCRIPTION_REBUILD_IN_PROGRESS');
    expect(checkout.createSubscriptionCheckoutSession).not.toHaveBeenCalled();
  });

  test('maps checkout and status requests to the existing V2 checkout service', async () => {
    enabledFlags();
    checkout.createSubscriptionCheckoutSession.mockResolvedValue({ url: 'https://checkout.test/session' });
    checkout.getSubscriptionCheckoutStatus.mockResolvedValue({
      payment_status: 'paid',
      provisioning_status: 'pending',
      checkout_status: 'processing',
      plan: 'Plus',
      amount: 99,
      currency: 'nok',
    });

    const created = await request(app)
      .post('/api/stripe/create-checkout-session')
      .set('Authorization', 'Bearer test')
      .send({ planId: 'plan-v2' });
    expect(created.status).toBe(200);
    expect(created.body).toEqual({ url: 'https://checkout.test/session' });
    expect(checkout.createSubscriptionCheckoutSession).toHaveBeenCalledWith({
      user: { _id: mockUserId },
      planId: 'plan-v2',
      couponCode: undefined,
    });

    const status = await request(app)
      .get('/api/stripe/checkout-session/cs_test_owned')
      .set('Authorization', 'Bearer test');
    expect(status.status).toBe(200);
    expect(status.body).toEqual(expect.objectContaining({
      payment_status: 'paid',
      provisioning_status: 'pending',
      checkout_status: 'processing',
    }));
    expect(checkout.getSubscriptionCheckoutStatus).toHaveBeenCalledWith(
      mockUserId,
      'cs_test_owned'
    );
  });

  test('projects accurate V2 entitlements into the existing subscription response', async () => {
    enabledFlags();
    Transaction.aggregate.mockResolvedValue([{ total: 58 }]);
    entitlements.resolveEntitlements.mockResolvedValue({
      status: 'past_due',
      plan: { id: 'plan-v2', name: 'Plus', price: 99 },
      planType: 'private',
      isPaid: true,
      includedContacts: 15,
      consumedIncludedContacts: 4,
      remainingIncludedContacts: 11,
      purchasedExtraContacts: 2,
      consumedExtraContacts: 1,
      entitlements: { perContactPrice: 29, ContactUnlock: 60 },
    });
    management.getCurrentSubscription.mockResolvedValue({
      subscription: {
        stripeSubscriptionId: 'sub_owned',
        stripeStatus: 'past_due',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-11-01T00:00:00.000Z',
        paymentRecovery: { active: true, status: 'retrying' },
      },
    });

    const response = await request(app)
      .get('/api/stripe/subscription')
      .set('Authorization', 'Bearer test');
    expect(response.status).toBe(200);
    expect(response.body.subscription).toEqual(expect.objectContaining({
      hasPlan: true,
      plan: 'Plus',
      planId: 'plan-v2',
      status: 'past_due',
      stripeSubscriptionId: 'sub_owned',
      contacts: {
        includedLimit: 15,
        includedUsed: 4,
        includedRemaining: 11,
        perContactPrice: 29,
        contactUnlockMinutes: 60,
        paidPurchased: 2,
        paidUsed: 1,
        paidAvailable: 1,
        totalPaidForExtraContacts: 58,
      },
      paymentRecovery: { active: true, status: 'retrying' },
    }));
    expect(entitlements.resolveEntitlements).toHaveBeenCalledWith(mockUserId);
    expect(Transaction.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          userId: mockUserId,
          type: 'extra_contact',
          status: 'succeeded',
          refunded: { $ne: true },
          currency: 'nok',
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
  });

  test('projects canceled billing as canceled instead of presenting a free fallback as active', async () => {
    enabledFlags();
    entitlements.resolveEntitlements.mockResolvedValue({
      status: 'free',
      plan: { id: 'standard-plan', name: 'Standard', price: 0 },
      planType: 'private',
      isPaid: false,
      includedContacts: 5,
      consumedIncludedContacts: 0,
      remainingIncludedContacts: 5,
      purchasedExtraContacts: 0,
      consumedExtraContacts: 0,
      entitlements: {},
    });
    management.getCurrentSubscription.mockResolvedValue({
      subscription: { stripeStatus: 'canceled', stripeSubscriptionId: 'sub_canceled' },
    });
    const response = { json: jest.fn() };

    await subscriptionController.getLegacySubscription({ user: { _id: mockUserId } }, response);

    expect(response.json.mock.calls[0][0].subscription.status).toBe('cancelled');
  });

  test('maps cancellation, resume, preview, change, portal, invoice history and PDF URLs', async () => {
    enabledFlags();
    management.cancelSubscription.mockResolvedValue({ message: 'cancel', effectiveAt: 'end' });
    management.cancelScheduledPlanChange.mockResolvedValue({ canceled: true });
    management.resumeSubscription.mockResolvedValue({ message: 'resume', effectiveAt: 'end' });
    management.createBillingPortalSession.mockResolvedValue({ url: 'https://billing.test' });
    management.previewPlanChange.mockResolvedValue({ strategy: 'immediate', amountDueNow: 25, currency: 'nok' });
    management.changePlan.mockResolvedValue({ strategy: 'period_end', effectiveAt: 'end' });
    management.getBillingHistory.mockResolvedValue({ invoices: [], payments: [] });
    management.getInvoicePdf.mockResolvedValue({ url: 'https://invoice.test/pdf' });

    const auth = (requestBuilder) => requestBuilder.set('Authorization', 'Bearer test');
    const cancel = await auth(request(app).post('/api/stripe/subscription/cancel'));
    const cancelChange = await auth(request(app).post('/api/stripe/subscription/change/cancel'));
    const resume = await auth(request(app).post('/api/stripe/subscription/resume'));
    const portal = await auth(request(app).post('/api/stripe/subscription/portal'));
    const preview = await auth(request(app).post('/api/stripe/subscription/change/preview').send({ planId: 'target' }));
    const change = await auth(request(app).post('/api/stripe/subscription/change').send({ planId: 'target' }));
    const history = await auth(request(app).get('/api/stripe/subscription/billing-history?mode=all'));
    const pdf = await auth(request(app).get('/api/stripe/subscription/invoices/in_1/pdf?mode=test'));

    expect(cancel.body.message).toBe('cancel');
    expect(cancelChange.body.canceled).toBe(true);
    expect(resume.body.message).toBe('resume');
    expect(portal.body.url).toBe('https://billing.test');
    expect(preview.body).toEqual({ strategy: 'immediate', amountDueNow: 25, currency: 'nok' });
    expect(change.body.strategy).toBe('period_end');
    expect(history.body).toEqual({ invoices: [], payments: [] });
    expect(pdf.body.url).toBe('https://invoice.test/pdf');
    expect(management.previewPlanChange).toHaveBeenCalledWith(mockUserId, 'target');
    expect(management.changePlan).toHaveBeenCalledWith(mockUserId, 'target');
    expect(management.getInvoicePdf).toHaveBeenCalledWith(mockUserId, 'in_1', 'test');
    expect(management.cancelScheduledPlanChange).toHaveBeenCalledWith(mockUserId);
  });
});
