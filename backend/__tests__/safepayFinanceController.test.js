jest.mock('../models/Order', () => ({}));
jest.mock('../models/Payout', () => ({}));
jest.mock('../models/User', () => ({}));
jest.mock('../models/StripeTransferRecord', () => ({}));
jest.mock('../models/StripeBankPayoutRecord', () => ({}));
jest.mock('../models/StripeFinancialSyncState', () => ({}));
jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));
jest.mock('../services/stripe/financialHistory', () => ({
  syncTransfersPage: jest.fn(),
  syncBankPayoutsPage: jest.fn(),
  modeField: (livemode) => (livemode ? 'stripeConnectAccountId' : 'stripeConnectAccountIdTest'),
}));
jest.mock('../services/admin/activityService', () => ({ logActivity: jest.fn() }));

const { getStripeForMode } = require('../config/stripe');
const controller = require('../controllers/safepayFinanceController');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe('SafePay finance API request validation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not allow providers to filter financial history by Stripe mode', async () => {
    const res = response();
    await controller.getTransfers({ userId: '507f1f77bcf86cd799439011', query: { mode: 'live' } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/administratorer/);
  });

  it('rejects a single-provider request combined with a batch cursor', async () => {
    const res = response();
    await controller.reconcile({
      userId: '507f1f77bcf86cd799439011',
      body: {
        mode: 'test',
        providerId: '507f1f77bcf86cd799439012',
        cursorProviderId: '507f1f77bcf86cd799439013',
      },
      headers: {},
    }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Velg enten én provider/);
    expect(getStripeForMode).not.toHaveBeenCalled();
  });

  it('rejects an invalid reconciliation cursor before contacting Stripe', async () => {
    const res = response();
    await controller.reconcile({
      userId: '507f1f77bcf86cd799439011',
      body: { mode: 'live', cursorProviderId: 'invalid' },
      headers: {},
    }, res);

    expect(res.statusCode).toBe(400);
    expect(getStripeForMode).not.toHaveBeenCalled();
  });
});
