jest.mock('../models/Order', () => ({}));
jest.mock('../models/Payout', () => ({
  collection: { name: 'payouts' },
  populate: jest.fn(async (rows) => rows),
  aggregate: jest.fn(),
}));
jest.mock('../models/User', () => ({
  findById: jest.fn(() => ({
    select: () => Promise.resolve({ stripeConnectAccountIdTest: 'acct_test' }),
  })),
}));
jest.mock('../models/StripeTransferRecord', () => ({
  collection: { name: 'stripetransferrecords' },
  aggregate: jest.fn(),
  populate: jest.fn(async (rows) => rows),
}));
jest.mock('../models/StripeBankPayoutRecord', () => ({ aggregate: jest.fn() }));
jest.mock('../models/StripeFinancialSyncState', () => ({
  find: jest.fn(() => ({
    sort: () => ({
      select: () => ({
        limit: () => ({ lean: jest.fn().mockResolvedValue([]) }),
      }),
    }),
  })),
}));
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

const { getStripeForMode, getStripeConfiguration } = require('../config/stripe');
const StripeTransferRecord = require('../models/StripeTransferRecord');
const StripeBankPayoutRecord = require('../models/StripeBankPayoutRecord');
const Payout = require('../models/Payout');
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
  beforeEach(() => {
    jest.clearAllMocks();
    getStripeConfiguration.mockResolvedValue({ testMode: true, mode: 'test' });
  });

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

  it('combines Stripe transfers and local attempts before sorting and paginating', async () => {
    const stripeRow = {
      _id: 'stripe_1',
      stripeObjectId: 'tr_1',
      orderId: '507f1f77bcf86cd799439012',
      payoutId: {
        _id: '507f1f77bcf86cd799439013',
        platformFee: 45,
        grossAmount: 300,
        netProviderAmount: 255,
        serviceId: { title: 'Maling' },
      },
      stripeCreatedAt: new Date('2025-01-03T00:00:00Z'),
      createdAt: new Date('2025-01-03T00:00:00Z'),
      normalizedStatus: 'transferred',
      livemode: false,
    };
    const localRow = {
      _id: 'payout_1',
      orderId: 'order_1',
      createdAt: new Date('2025-01-02T00:00:00Z'),
      status: 'failed',
      stripeLivemode: false,
    };
    StripeTransferRecord.aggregate.mockReturnValue({
      allowDiskUse: jest.fn().mockResolvedValue([
        {
          data: [
            { source: 'stripe', row: stripeRow },
            { source: 'local', row: localRow },
          ],
          metadata: [{ total: 2 }],
        },
      ]),
    });
    const res = response();

    await controller.getAdminTransfers(
      {
        query: { mode: 'all', providerId: '507f1f77bcf86cd799439011', page: '1', limit: '10' },
        userId: 'admin_1',
      },
      res
    );

    const pipeline = StripeTransferRecord.aggregate.mock.calls[0][0];
    expect(pipeline.some((stage) => stage.$unionWith?.coll === 'payouts')).toBe(true);
    expect(pipeline.some((stage) => stage.$sort?.sortAt === -1 && stage.$sort?.tieId === -1)).toBe(true);
    expect(pipeline.find((stage) => stage.$facet)?.$facet.data).toEqual([
      { $skip: 0 },
      { $limit: 10 },
    ]);
    expect(res.body.pagination).toMatchObject({ total: 2, totalPages: 1 });
    expect(res.body.items.map((item) => item.id)).toEqual(['stripe_1', 'payout_1']);
    expect(res.body.items[0]).toEqual(expect.objectContaining({
      orderId: '507f1f77bcf86cd799439012',
      orderTitle: 'Maling',
      agreedPrice: 300,
      jobbloFee: 4500,
      netProviderAmount: 25500,
    }));
    expect(res.body.snapshotAt).toEqual(expect.any(String));
    expect(res.body.testDataNotice).toBeNull();
  });

  it('keeps a linked local attempt in the same snapshot de-duplication query', async () => {
    StripeTransferRecord.aggregate.mockReturnValue({
      allowDiskUse: jest.fn().mockResolvedValue([{ data: [], metadata: [{ total: 0 }] }]),
    });
    const snapshotAt = '2025-01-03T00:00:00.000Z';
    const providerId = '507f1f77bcf86cd799439011';
    const orderId = '507f1f77bcf86cd799439012';
    const res = response();

    await controller.getAdminTransfers(
      {
        query: {
          mode: 'live',
          providerId,
          orderId,
          status: 'transfer_failed',
          dateFrom: '2025-01-01T00:00:00.000Z',
          dateTo: snapshotAt,
          snapshotAt,
        },
        userId: 'admin_1',
      },
      res
    );

    const pipeline = StripeTransferRecord.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toMatchObject({
      providerId: expect.anything(),
      orderId: expect.anything(),
      livemode: true,
      normalizedStatus: 'transfer_failed',
      createdAt: { $lte: new Date(snapshotAt) },
    });
    const localMatch = pipeline
      .find((stage) => stage.$unionWith)
      .$unionWith.pipeline.find((stage) => stage.$match).$match;
    expect(localMatch).toMatchObject({
      providerId: expect.anything(),
      orderId: expect.anything(),
      stripeLivemode: true,
      status: 'failed',
      createdAt: { $lte: new Date(snapshotAt) },
    });
    expect(localMatch.$expr.$and).toHaveLength(2);
    const union = pipeline.find((stage) => stage.$unionWith);
    const lookup = union.$unionWith.pipeline.find((stage) => stage.$lookup);
    expect(lookup.$lookup.pipeline[0].$match.$expr.$and).toContainEqual({
      $lte: ['$createdAt', new Date(snapshotAt)],
    });
    expect(res.body.pagination.total).toBe(0);
  });

  it('returns mode-scoped verified net transfer, fee and pending payout totals', async () => {
    StripeTransferRecord.aggregate.mockResolvedValue([
      { _id: { currency: 'NOK', status: 'partially_reversed' }, count: 1, amount: 27100, jobbloFee: 4500 },
    ]);
    StripeBankPayoutRecord.aggregate.mockResolvedValue([
      { _id: { currency: 'NOK', status: 'in_transit' }, count: 1, amount: 27100 },
    ]);
    Payout.aggregate.mockResolvedValue([
      { _id: { currency: 'NOK' }, count: 2, amount: 50000 },
    ]);
    const res = response();

    await controller.getSummary({ userId: '507f1f77bcf86cd799439011' }, res);

    expect(res.body).toEqual(expect.objectContaining({
      mode: 'test',
      transfers: [expect.objectContaining({ amount: 27100, jobbloFee: 4500 })],
      bankPayouts: [expect.objectContaining({ amount: 27100 })],
      pendingTransfers: [expect.objectContaining({ count: 2, amount: 50000 })],
    }));
    const transferPipeline = StripeTransferRecord.aggregate.mock.calls[0][0];
    expect(transferPipeline.find((stage) => stage.$set).$set.netTransferredAmount).toEqual({
      $max: [0, { $subtract: ['$amount', { $ifNull: ['$amountReversed', 0] }] }],
    });
    expect(Payout.aggregate.mock.calls[0][0].some((stage) =>
      stage.$lookup?.from === 'stripetransferrecords'
    )).toBe(true);
  });
});
