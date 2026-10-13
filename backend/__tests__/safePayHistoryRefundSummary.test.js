jest.mock('../models/SafePayHistory', () => ({ find: jest.fn() }));
jest.mock('../models/StripeTransferRecord', () => ({ find: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));

const mongoose = require('mongoose');
const SafePayHistory = require('../models/SafePayHistory');
const StripeTransferRecord = require('../models/StripeTransferRecord');
const User = require('../models/User');
const { getSafePayHistory } = require('../controllers/safepayController');

async function readHistory({
  userId,
  providerId,
  refundStatus,
  refundMinor,
  transfers = [],
  card = true,
  cancelled = refundStatus !== 'none',
}) {
  const orderId = new mongoose.Types.ObjectId();
  const record = {
    _id: new mongoose.Types.ObjectId(),
    orderId,
    customerId: { _id: userId, name: 'Customer', lastName: 'One' },
    providerId: { _id: providerId, name: 'Provider', lastName: 'One' },
    serviceTitle: 'Maling',
    amounts: {
      agreedPrice: 300,
      fee: 9,
      tax: 0,
      totalCustomer: 309,
      netProvider: 291,
    },
    status: refundStatus === 'succeeded' || (refundStatus === 'none' && cancelled)
      ? 'automatically_cancelled'
      : refundStatus === 'none' ? 'payment_received' : 'refund_pending',
    originalPaymentAmountMinor: 30900,
    refundAmountMinor: refundMinor,
    refundedAmountMinor: refundStatus === 'succeeded' ? refundMinor : 0,
    refundStatus,
    ...(cancelled ? { cancellationReason: 'provider_stripe_connect_timeout' } : {}),
    stripePaymentIntentId: 'pi_test_1',
    stripeRefundId: 're_3U07AbcRnp',
    ...(card ? { paymentMethodBrand: 'visa', paymentMethodLast4: '4242' } : {}),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    paymentDate: new Date('2025-01-01T00:01:00Z'),
  };
  SafePayHistory.find.mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue([record]),
  });
  StripeTransferRecord.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(
      transfers.map((transfer) => ({ ...transfer, orderId: transfer.orderId || orderId }))
    ),
  });

  const res = { json: jest.fn() };
  await getSafePayHistory(
    { params: { userId: String(userId) }, userId: String(userId) },
    res
  );
  return { payload: res.json.mock.calls[0][0], orderId };
}

beforeEach(() => jest.clearAllMocks());

it('returns verified card/refund references and excludes a full refund from customer spend', async () => {
  const customerId = new mongoose.Types.ObjectId();
  const providerId = new mongoose.Types.ObjectId();
  const { payload } = await readHistory({
    userId: customerId,
    providerId,
    refundStatus: 'succeeded',
    refundMinor: 30900,
  });

  expect(payload).toEqual(expect.objectContaining({
    summary: expect.objectContaining({
      totalSpent: 0,
      totalEarned: 0,
      totalFees: 0,
      transactionCount: 1,
    }),
    history: [
      expect.objectContaining({
        status: 'automatically_cancelled',
        refundStatus: 'succeeded',
        refundedAmountMinor: 30900,
        stripeRefundId: 're_3U07AbcRnp',
        cancellationReason: 'provider_stripe_connect_timeout',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '4242',
      }),
    ],
  }));
});

it.each([
  ['partial success', 'succeeded', 10000, 209, false],
  ['pending refund', 'pending', 30900, 309, false],
  ['failed refund', 'failed', 30900, 309, false],
  ['canceled without confirmed refund', 'none', 30900, 309, true],
  ['normal successful payment', 'none', 0, 309, false],
])('counts %s as only confirmed customer refunds', async (_label, refundStatus, refundMinor, expectedSpent, cancelled) => {
  const { payload } = await readHistory({
    userId: new mongoose.Types.ObjectId(),
    providerId: new mongoose.Types.ObjectId(),
    refundStatus,
    refundMinor,
    card: false,
    cancelled,
  });

  expect(payload.summary.totalSpent).toBe(expectedSpent);
  expect(payload.history[0]).not.toHaveProperty('paymentMethodLast4');
});

it('counts provider earnings only from verified transfers after reversals', async () => {
  const providerId = new mongoose.Types.ObjectId();
  const { payload, orderId } = await readHistory({
    userId: providerId,
    providerId,
    refundStatus: 'succeeded',
    refundMinor: 30900,
    transfers: [{
      orderId: undefined,
      amount: 29100,
      amountReversed: 2000,
      normalizedStatus: 'partially_reversed',
    }],
  });

  expect(StripeTransferRecord.find).toHaveBeenCalledWith(expect.objectContaining({
    providerId: String(providerId),
    normalizedStatus: { $in: ['transferred', 'partially_reversed', 'fully_reversed'] },
    lastVerifiedAt: { $ne: null },
  }));
  expect(orderId).toBeDefined();
  expect(payload.summary.totalEarned).toBe(271);
  expect(payload.summary.totalFees).toBe(9);
  expect(payload.history[0].providerTransferAmountMinor).toBe(27100);
  expect(payload.summary.totalSpent).toBe(0);
});

it('does not expose history or card details to a non-participant', async () => {
  const targetUser = new mongoose.Types.ObjectId();
  const requester = new mongoose.Types.ObjectId();
  User.findById.mockResolvedValue({ role: 'user' });
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  await getSafePayHistory(
    { params: { userId: String(targetUser) }, userId: String(requester) },
    res
  );

  expect(res.status).toHaveBeenCalledWith(403);
  expect(SafePayHistory.find).not.toHaveBeenCalled();
});
