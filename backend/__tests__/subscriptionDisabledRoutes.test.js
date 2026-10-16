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
});
