/**
 * SafePay scheduler: failed-payout retry. It used to relabel every retry as
 * `admin_override` (losing the dispute link and who released it) and re-read the same
 * first 25 failed payouts forever, starving everything behind them.
 */
jest.mock('../config/stripe', () => ({ getStripeConfiguration: jest.fn(), getStripeForMode: jest.fn() }));
jest.mock('../services/stripe/financialHistory', () => ({ reconcileConnectedAccountsBatch: jest.fn() }));
jest.mock('../utils/errorLogger', () => ({ logApplicationError: jest.fn() }));
jest.mock('../services/notifications', () => ({ notify: jest.fn() }));
jest.mock('../models/Notification', () => ({}));
jest.mock('../services/payout/releasePayoutToProvider', () => jest.fn());
jest.mock('../models/Order', () => ({ find: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../models/Payment', () => ({ findOne: jest.fn() }));
jest.mock('../models/Payout', () => ({ find: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/Dispute', () => ({ findOne: jest.fn() }));

const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const releasePayoutToProvider = require('../services/payout/releasePayoutToProvider');
const { retryFailedPayouts } = require('../services/scheduler/jobs');

const chain = (rows) => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => rows });
let query;

beforeEach(() => {
  jest.clearAllMocks();
  Payment.findOne.mockResolvedValue({ stripePaymentIntentId: 'pi', stripeSessionId: 'cs' });
  releasePayoutToProvider.mockResolvedValue({});
  Payout.find.mockImplementation(() => {
    query = { sort: null };
    const c = chain([
      { _id: 'po1', orderId: 'o1', providerId: 'p', customerId: 'c', serviceId: 's', grossAmount: 500, platformFee: 0, releaseSource: 'dispute_release', releasedBy: 'admin', disputeId: 'd1' },
      { _id: 'po2', orderId: 'o2', providerId: 'p', customerId: 'c', serviceId: 's', grossAmount: 500, platformFee: 15, releaseSource: 'customer_approve', releasedBy: 'c' },
    ]);
    c.sort = (s) => { query.sort = s; return c; };
    return c;
  });
});

it('retries each payout under its original release source, least-recently-tried first', async () => {
  await retryFailedPayouts();
  expect(query.sort).toEqual({ lastAttemptedAt: 1, _id: 1 });
  expect(releasePayoutToProvider.mock.calls.map(([a]) => [a.orderId, a.releaseSource, a.releasedBy, a.disputeId])).toEqual([
    ['o1', 'dispute_release', 'admin', 'd1'],
    ['o2', 'customer_approve', 'c', undefined],
  ]);
});

it('a payout that still fails is rotated to the back of the queue', async () => {
  releasePayoutToProvider.mockRejectedValueOnce(Object.assign(new Error('order invalid'), { code: 'PAYOUT_ORDER_INVALID' }));
  await retryFailedPayouts();
  expect(Payout.updateOne).toHaveBeenCalledWith({ _id: 'po1', status: 'failed' }, { $set: { lastAttemptedAt: expect.any(Date) } });
});
