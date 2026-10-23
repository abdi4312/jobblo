const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  authenticate: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
}));
jest.mock('../middleware/rateLimiter', () => ({
  adminLimiter: (_req, _res, next) => next(),
  financeSyncLimiter: (_req, _res, next) => next(),
}));

const app = express();
app.use('/api/stripe', require('../routes/stripe'));
app.use('/api/plans', require('../routes/subscriptionPlan'));
app.use('/api/coupons', require('../routes/coupon'));
app.use('/api/admin', require('../routes/admin/index'));

describe('legacy subscription endpoints', () => {
  it.each([
    ['get', '/api/stripe/subscription', 'AUTHENTICATION_REQUIRED'],
    ['post', '/api/stripe/subscription/cancel', 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED'],
    ['post', '/api/stripe/subscription/resume', 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED'],
    ['post', '/api/stripe/subscription/portal', 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED'],
    ['get', '/api/stripe/subscription/billing-history', 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED'],
    ['get', '/api/stripe/subscription/invoices/in_1/pdf', 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED'],
    ['post', '/api/stripe/subscription/change/preview', 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED'],
    ['post', '/api/stripe/subscription/change', 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED'],
    ['post', '/api/stripe/create-checkout-session', 'SUBSCRIPTION_V2_CHECKOUT_DISABLED'],
    ['get', '/api/stripe/checkout-session/cs_1', 'SUBSCRIPTION_V2_CHECKOUT_DISABLED'],
    // Paid extra contacts are a V2 entitlement feature: off with the entitlements flag.
    ['post', '/api/stripe/create-extra-contact-payment', 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED'],
    ['get', '/api/stripe/extra-contact-status/cs_1', 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED'],
    ['get', '/api/plans', 'SUBSCRIPTION_V2_PLAN_CATALOGUE_DISABLED'],
    ['post', '/api/coupons/validate', 'SUBSCRIPTION_REBUILD_IN_PROGRESS'],
    ['get', '/api/admin/billing/subscriptions/summary', 'SUBSCRIPTION_REBUILD_IN_PROGRESS'],
    ['post', '/api/admin/billing/subscriptions/reconcile', 'SUBSCRIPTION_REBUILD_IN_PROGRESS'],
    ['get', '/api/admin/promotion-codes', 'SUBSCRIPTION_REBUILD_IN_PROGRESS'],
    ['post', '/api/admin/promotion-codes', 'SUBSCRIPTION_REBUILD_IN_PROGRESS'],
    ['post', '/api/admin/promotion-codes/coupon_1/deactivate', 'SUBSCRIPTION_REBUILD_IN_PROGRESS'],
  ])('%s %s returns the appropriate disabled response', async (method, path, code) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(503);
    expect(response.body.code).toBe(code);

  });

  it('keeps the V2 checkout route disabled unless its server-side flag is enabled', async () => {
    const previous = process.env.SUBSCRIPTION_V2_CHECKOUT_ENABLED;
    delete process.env.SUBSCRIPTION_V2_CHECKOUT_ENABLED;
    try {
      const response = await request(app).post('/api/stripe/v2/create-checkout-session');
      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        code: 'SUBSCRIPTION_V2_CHECKOUT_DISABLED',
        message: 'Subscription checkout is not currently available.',
      });
    } finally {
      if (previous === undefined) delete process.env.SUBSCRIPTION_V2_CHECKOUT_ENABLED;
      else process.env.SUBSCRIPTION_V2_CHECKOUT_ENABLED = previous;
    }
  });

  it('keeps V2 management endpoints disabled unless their server-side flag is enabled', async () => {
    const previous = process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED;
    delete process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED;
    try {
      const responses = await Promise.all([
        request(app).get('/api/stripe/v2/subscription'),
        request(app).post('/api/stripe/v2/subscription/cancel'),
        request(app).post('/api/stripe/v2/subscription/resume'),
        request(app).post('/api/stripe/v2/subscription/change/preview').send({ planId: 'plan' }),
        request(app).post('/api/stripe/v2/subscription/change').send({ planId: 'plan' }),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(503);
        expect(response.body).toEqual({
          code: 'SUBSCRIPTION_V2_MANAGEMENT_DISABLED',
          message: 'Subscription management is not currently available.',
        });
      }
    } finally {
      if (previous === undefined) delete process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED;
      else process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED = previous;
    }
  });

  it('keeps V2 entitlements disabled unless their server-side flag is enabled', async () => {
    const previous = process.env.SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED;
    delete process.env.SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED;
    try {
      const response = await request(app).get('/api/stripe/v2/entitlements');
      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        code: 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED',
        message: 'Subscription entitlements are not currently available.',
      });
    } finally {
      if (previous === undefined) delete process.env.SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED;
      else process.env.SUBSCRIPTION_V2_ENTITLEMENTS_ENABLED = previous;
    }
  });
});
