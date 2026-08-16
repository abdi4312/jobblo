/**
 * Every dispute outcome must settle the money it claims to settle.
 *
 * Before this: `partial_refund` and `split_payment` recorded a providerAmount that no
 * code ever transferred, `cancel_without_payment` refunded nobody while cancelling
 * the order, and `no_action` — documented as no action — cancelled it too. The refund
 * also ran inside a MongoDB transaction, so an abort after a successful refund left
 * the customer refunded and the database certain it never happened.
 */

const captured = { success: null, error: null };

jest.mock('../utils/apiResponse', () => ({
  asyncHandler: (fn) => fn,
  sendSuccess: jest.fn((res, data, message) => {
    captured.success = { data, message };
    return res;
  }),
  sendError: jest.fn((res, message, status) => {
    captured.error = { message, status };
    return res;
  }),
  buildPagination: jest.fn(),
}));
jest.mock('../utils/pagination', () => ({
  parsePagination: jest.fn(),
  parseObjectId: jest.fn((v) => v),
  parseSort: jest.fn(),
  parseDate: jest.fn(),
}));
jest.mock('../models/Dispute', () => ({ findById: jest.fn() }));
jest.mock('../models/Order', () => ({}));
jest.mock('../models/Payment', () => ({ findOne: jest.fn() }));
jest.mock('../models/SafePayHistory', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../models/ChatMessage', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Notification', () => ({ create: jest.fn() }));
jest.mock('../models/User', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../services/admin/activityService', () => ({ logActivity: jest.fn() }));
jest.mock('../utils/errorLogger', () => ({ logApplicationError: jest.fn() }));
jest.mock('../config/stripe', () => ({ getStripe: jest.fn() }));
jest.mock('../services/payout/releasePayoutToProvider', () => jest.fn());

const Dispute = require('../models/Dispute');
const Payment = require('../models/Payment');
const SafePayHistory = require('../models/SafePayHistory');
const Notification = require('../models/Notification');
const { getStripe } = require('../config/stripe');
const releasePayoutToProvider = require('../services/payout/releasePayoutToProvider');
const { logApplicationError } = require('../utils/errorLogger');
const { resolveDispute } = require('../controllers/admin/disputesAdminController');

const ORDER = () => ({
  _id: 'order_1',
  customerId: 'cust_1',
  providerId: 'prov_1',
  serviceId: 'svc_1',
  agreedPrice: 1000,
  chatId: null,
  status: 'disputed',
  history: [],
  save: jest.fn().mockResolvedValue(),
});

function disputeDoc(order, previousOrderStatus = 'ready_for_review') {
  return {
    _id: 'dispute_1',
    orderId: order,
    status: 'open',
    previousOrderStatus,
    timeline: [],
    resolution: undefined,
    save: jest.fn().mockResolvedValue(),
  };
}

let refundsCreate;

function run(outcome, body = {}) {
  const req = {
    params: { disputeId: 'dispute_1' },
    body: { outcome, reason: 'Behandlet av support', ...body },
    user: { _id: 'admin_1', name: 'Admin' },
    ip: '127.0.0.1',
    headers: {},
    originalUrl: '/api/admin/disputes/dispute_1/resolve',
  };
  return resolveDispute(req, {}, jest.fn());
}

beforeEach(() => {
  jest.clearAllMocks();
  captured.success = null;
  captured.error = null;

  refundsCreate = jest.fn().mockResolvedValue({ id: 're_1', status: 'succeeded' });
  getStripe.mockResolvedValue({ refunds: { create: refundsCreate } });

  Payment.findOne.mockResolvedValue({
    stripePaymentIntentId: 'pi_1',
    stripeSessionId: 'cs_1',
    status: 'disputed',
    save: jest.fn().mockResolvedValue(),
  });
  SafePayHistory.findOneAndUpdate.mockResolvedValue({});
  Notification.create.mockResolvedValue({});
  releasePayoutToProvider.mockResolvedValue({
    payout: { stripeTransferId: 'tr_1' },
    alreadyPaid: false,
  });
});

describe('outcomes that pay the provider', () => {
  it('release_to_provider transfers and completes', async () => {
    const order = ORDER();
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(disputeDoc(order)) });

    await run('release_to_provider');

    expect(refundsCreate).not.toHaveBeenCalled();
    expect(releasePayoutToProvider).toHaveBeenCalledWith(
      expect.objectContaining({ grossAmount: 1000, platformFee: 30 })
    );
    expect(order.status).toBe('completed');
  });

  it('partial_refund now ALSO pays the provider its recorded share', async () => {
    const order = ORDER();
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(disputeDoc(order)) });

    await run('partial_refund', { customerAmount: 400, providerAmount: 600 });

    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 40000 }), // 400 kr in øre
      expect.objectContaining({ idempotencyKey: 'dispute_refund_dispute_1' })
    );
    // This transfer never happened before — the amount was recorded and dropped.
    expect(releasePayoutToProvider).toHaveBeenCalledWith(
      expect.objectContaining({ grossAmount: 600, platformFee: 0 })
    );
    expect(order.status).toBe('completed');
  });

  it('split_payment makes real Stripe calls instead of none at all', async () => {
    const order = ORDER();
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(disputeDoc(order)) });

    await run('split_payment', { customerAmount: 300, providerAmount: 700 });

    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 30000 }),
      expect.any(Object)
    );
    expect(releasePayoutToProvider).toHaveBeenCalledWith(
      expect.objectContaining({ grossAmount: 700 })
    );
  });
});

describe('outcomes that return money to the customer', () => {
  it('full_refund_to_customer refunds and cancels', async () => {
    const order = ORDER();
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(disputeDoc(order)) });

    await run('full_refund_to_customer');

    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100000 }),
      expect.any(Object)
    );
    expect(releasePayoutToProvider).not.toHaveBeenCalled();
    expect(order.status).toBe('cancelled');
  });

  it('cancel_without_payment now refunds instead of keeping the money', async () => {
    const order = ORDER();
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(disputeDoc(order)) });

    await run('cancel_without_payment');

    // Previously: no Stripe call whatsoever, order cancelled, platform kept the funds.
    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100000 }),
      expect.any(Object)
    );
    expect(order.status).toBe('cancelled');
  });
});

describe('no_action', () => {
  it('takes no action: no money moves and the order returns to where it was', async () => {
    const order = ORDER();
    Dispute.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(disputeDoc(order, 'ready_for_review')),
    });

    await run('no_action');

    expect(refundsCreate).not.toHaveBeenCalled();
    expect(releasePayoutToProvider).not.toHaveBeenCalled();
    // Was 'cancelled' — the exact opposite of what the outcome promises.
    expect(order.status).toBe('ready_for_review');
  });

  it('restores in_progress when that is where the dispute found the order', async () => {
    const order = ORDER();
    Dispute.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(disputeDoc(order, 'in_progress')),
    });

    await run('no_action');

    expect(order.status).toBe('in_progress');
  });
});

describe('failure handling and retryability', () => {
  it('leaves the dispute unresolved and retryable when the refund fails', async () => {
    const order = ORDER();
    const dispute = disputeDoc(order);
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(dispute) });
    refundsCreate.mockRejectedValue(new Error('card_declined'));

    await run('full_refund_to_customer');

    expect(dispute.resolution.moneyState).toBe('failed');
    expect(dispute.status).not.toBe('resolved');
    expect(captured.error.status).toBe(502);
    expect(logApplicationError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'DISPUTE_RESOLUTION_MONEY_FAILED' })
    );
    // The order must NOT be moved when the money did not move.
    expect(order.status).toBe('disputed');
  });

  it('leaves the dispute retryable when the payout fails', async () => {
    const order = ORDER();
    const dispute = disputeDoc(order);
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(dispute) });
    releasePayoutToProvider.mockRejectedValue(new Error('PAYOUT_SETUP_REQUIRED'));

    await run('release_to_provider');

    expect(dispute.resolution.moneyState).toBe('failed');
    expect(captured.error.status).toBe(502);
    expect(order.status).toBe('disputed');
  });

  it('records the intent BEFORE calling Stripe, so a crash is discoverable', async () => {
    const order = ORDER();
    const dispute = disputeDoc(order);
    let moneyStateAtRefundTime = null;
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(dispute) });
    refundsCreate.mockImplementation(async () => {
      moneyStateAtRefundTime = dispute.resolution.moneyState;
      return { id: 're_1', status: 'succeeded' };
    });

    await run('full_refund_to_customer');

    expect(moneyStateAtRefundTime).toBe('pending');
    expect(dispute.resolution.moneyState).toBe('settled');
  });

  it('marks money settled and the dispute resolved on success', async () => {
    const order = ORDER();
    const dispute = disputeDoc(order);
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(dispute) });

    await run('release_to_provider');

    expect(dispute.status).toBe('resolved');
    expect(dispute.payoutFrozen).toBe(false);
    expect(dispute.resolution.moneyState).toBe('settled');
    expect(dispute.resolution.stripeTransferId).toBe('tr_1');
    expect(captured.success).not.toBeNull();
  });

  it('allows re-resolving a dispute whose money movement previously failed', async () => {
    const order = ORDER();
    const dispute = disputeDoc(order);
    dispute.resolution = { outcome: 'full_refund_to_customer', moneyState: 'failed' };
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(dispute) });

    await run('full_refund_to_customer');

    expect(captured.error).toBeNull();
    expect(dispute.resolution.moneyState).toBe('settled');
  });

  it('refuses to resolve one that already settled', async () => {
    const order = ORDER();
    const dispute = disputeDoc(order);
    dispute.resolution = { outcome: 'release_to_provider', moneyState: 'settled' };
    Dispute.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(dispute) });

    await run('release_to_provider');

    expect(captured.error.status).toBe(409);
    expect(releasePayoutToProvider).not.toHaveBeenCalled();
  });
});
