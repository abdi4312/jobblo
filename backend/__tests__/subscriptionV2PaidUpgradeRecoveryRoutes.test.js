const express = require('express');
const request = require('supertest');

jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    const authorization = req.get('authorization');
    if (!authorization) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED' });
    req.user = {
      _id: '64b000000000000000000001',
      role: authorization === 'super-admin' ? 'superAdmin' : 'user',
    };
    return next();
  },
  requireAdmin: (req, res, next) =>
    req.user?.role === 'superAdmin'
      ? next()
      : res.status(403).json({ code: 'ADMIN_REQUIRED' }),
}));
jest.mock('../services/subscriptions/v2PaidUpgradeRecovery', () => ({
  PaidUpgradeRecoveryError: class PaidUpgradeRecoveryError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  recoverPaidUpgrade: jest.fn(),
}));

const recovery = require('../services/subscriptions/v2PaidUpgradeRecovery');

const app = express();
app.use(express.json());
app.use('/api/stripe', require('../routes/stripe'));

const managementFlag = process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED;
const recoveryFlag = process.env.SUBSCRIPTION_V2_PAID_UPGRADE_RECOVERY_ENABLED;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED = 'true';
  delete process.env.SUBSCRIPTION_V2_PAID_UPGRADE_RECOVERY_ENABLED;
});

afterAll(() => {
  if (managementFlag === undefined) delete process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED;
  else process.env.SUBSCRIPTION_V2_MANAGEMENT_ENABLED = managementFlag;
  if (recoveryFlag === undefined) delete process.env.SUBSCRIPTION_V2_PAID_UPGRADE_RECOVERY_ENABLED;
  else process.env.SUBSCRIPTION_V2_PAID_UPGRADE_RECOVERY_ENABLED = recoveryFlag;
});

describe('one-time paid upgrade reconciliation route', () => {
  test('requires authentication and a super-admin role', async () => {
    expect((await request(app).post('/api/stripe/v2/admin/reconcile-paid-upgrade')).status).toBe(401);
    expect((await request(app)
      .post('/api/stripe/v2/admin/reconcile-paid-upgrade')
      .set('Authorization', 'user')).status).toBe(403);
    expect(recovery.recoverPaidUpgrade).not.toHaveBeenCalled();
  });

  test('is disabled by default even for a super-admin', async () => {
    const response = await request(app)
      .post('/api/stripe/v2/admin/reconcile-paid-upgrade')
      .set('Authorization', 'super-admin')
      .send({ confirmation: 'RECONCILE_ALREADY_PAID_TEST_UPGRADE' });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('SUBSCRIPTION_V2_RECOVERY_DISABLED');
    expect(recovery.recoverPaidUpgrade).not.toHaveBeenCalled();
  });

  test('passes only the authenticated admin and exact confirmation to the scoped recovery', async () => {
    process.env.SUBSCRIPTION_V2_PAID_UPGRADE_RECOVERY_ENABLED = 'true';
    recovery.recoverPaidUpgrade.mockResolvedValue({
      reconciled: true,
      plan: 'Pro',
      invoiceId: 'in_test',
    });
    const response = await request(app)
      .post('/api/stripe/v2/admin/reconcile-paid-upgrade')
      .set('Authorization', 'super-admin')
      .send({ confirmation: 'RECONCILE_ALREADY_PAID_TEST_UPGRADE' });
    expect(response.status).toBe(200);
    expect(recovery.recoverPaidUpgrade).toHaveBeenCalledWith({
      adminId: '64b000000000000000000001',
      confirmation: 'RECONCILE_ALREADY_PAID_TEST_UPGRADE',
    });
  });
});
