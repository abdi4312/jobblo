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
    ['get', '/api/stripe/subscription'],
    ['post', '/api/stripe/subscription/cancel'],
    ['post', '/api/stripe/subscription/resume'],
    ['post', '/api/stripe/subscription/portal'],
    ['get', '/api/stripe/subscription/billing-history'],
    ['get', '/api/stripe/subscription/invoices/in_1/pdf'],
    ['post', '/api/stripe/subscription/change/preview'],
    ['post', '/api/stripe/subscription/change'],
    ['post', '/api/stripe/create-checkout-session'],
    ['get', '/api/stripe/checkout-session/cs_1'],
    ['post', '/api/stripe/create-extra-contact-payment'],
    ['get', '/api/stripe/extra-contact-status/cs_1'],
    ['get', '/api/plans'],
    ['post', '/api/coupons/validate'],
    ['get', '/api/admin/billing/subscriptions/summary'],
    ['post', '/api/admin/billing/subscriptions/reconcile'],
    ['get', '/api/admin/promotion-codes'],
    ['post', '/api/admin/promotion-codes'],
    ['post', '/api/admin/promotion-codes/coupon_1/deactivate'],
  ])('%s %s returns the disabled response', async (method, path) => {
    const response = await request(app)[method](path);

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: 'SUBSCRIPTION_REBUILD_IN_PROGRESS',
      message: 'Subscription functionality is temporarily unavailable.',
    });

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
