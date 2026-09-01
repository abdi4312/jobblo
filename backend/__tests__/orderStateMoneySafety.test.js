/**
 * "No order may enter a terminal state while money is held unless that money has a
 * recorded destination."
 *
 * The bug this replaces: a provider could PATCH a paid order straight to `completed`,
 * which skipped the payout release and left the customer's escrowed money unreachable
 * by any code path.
 */

jest.mock('../models/Order', () => ({ findById: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../models/Payment', () => ({ findOne: jest.fn() }));
jest.mock('../models/Payout', () => ({ findOne: jest.fn() }));
jest.mock('../models/Dispute', () => ({ findOne: jest.fn() }));

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const Dispute = require('../models/Dispute');
const {
  ORDER_TRANSITIONS,
  isValidTransition,
  assertTerminalIsMoneySafe,
  transitionOrder,
} = require('../services/order/orderState');

function paidOrder(status = 'ready_for_review') {
  return {
    _id: new mongoose.Types.ObjectId(),
    status,
    paymentStatus: 'paid',
    customerId: new mongoose.Types.ObjectId(),
    providerId: new mongoose.Types.ObjectId(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Dispute.findOne.mockResolvedValue(null);
  Payout.findOne.mockResolvedValue(null);
  Payment.findOne.mockResolvedValue(null);
});

describe('the transition table', () => {
  it('knows about ready_for_review, which the old table omitted entirely', () => {
    expect(ORDER_TRANSITIONS.ready_for_review).toBeDefined();
    expect(Object.values(ORDER_TRANSITIONS).flat()).toContain('ready_for_review');
  });

  it('models the real happy path', () => {
    expect(isValidTransition('awaiting_payment', 'paid')).toBe(true);
    expect(isValidTransition('paid', 'in_progress')).toBe(true);
    expect(isValidTransition('in_progress', 'ready_for_review')).toBe(true);
    expect(isValidTransition('ready_for_review', 'completed')).toBe(true);
  });

  it('does not let a paid order jump straight to completed', () => {
    // This exact transition is what the deleted PATCH endpoint permitted.
    expect(isValidTransition('paid', 'completed')).toBe(false);
  });

  it('treats cancelled and declined as terminal', () => {
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
    expect(ORDER_TRANSITIONS.declined).toEqual([]);
  });
});

describe('money invariant on completion', () => {
  it('refuses to complete a paid order with no payout', async () => {
    const order = paidOrder();
    Payment.findOne.mockResolvedValue({ status: 'completed' });
    Payout.findOne.mockResolvedValue(null);

    await expect(assertTerminalIsMoneySafe(order, 'completed')).rejects.toMatchObject({
      code: 'payout_required_before_completion',
    });
  });

  it('allows completion once a payout has been released', async () => {
    const order = paidOrder();
    Payment.findOne.mockResolvedValue({ status: 'completed' });
    Payout.findOne.mockResolvedValue({ status: 'transferred' });

    await expect(assertTerminalIsMoneySafe(order, 'completed')).resolves.toBeUndefined();
  });

  it('allows completion when the caller is performing the payout in the same operation', async () => {
    const order = paidOrder();
    Payment.findOne.mockResolvedValue({ status: 'completed' });

    await expect(
      assertTerminalIsMoneySafe(order, 'completed', { resolution: 'payout_released' })
    ).resolves.toBeUndefined();
  });
});

describe('money invariant on cancellation', () => {
  it('refuses to cancel a paid order that has not been refunded', async () => {
    const order = paidOrder('paid');
    Payment.findOne.mockResolvedValue({ status: 'completed' });

    await expect(assertTerminalIsMoneySafe(order, 'cancelled')).rejects.toMatchObject({
      code: 'refund_required_before_cancellation',
    });
  });

  it('allows cancellation once the payment is refunded', async () => {
    const order = paidOrder('paid');
    Payment.findOne.mockResolvedValue({ status: 'refunded' });

    await expect(assertTerminalIsMoneySafe(order, 'cancelled')).resolves.toBeUndefined();
  });

  it('allows cancellation as part of a recorded dispute resolution', async () => {
    const order = paidOrder('disputed');
    Payment.findOne.mockResolvedValue({ status: 'completed' });

    await expect(
      assertTerminalIsMoneySafe(order, 'cancelled', { resolution: 'dispute_resolution' })
    ).resolves.toBeUndefined();
  });

  it('leaves unpaid orders alone — nothing is held, so nothing to settle', async () => {
    const order = { _id: new mongoose.Types.ObjectId(), status: 'awaiting_payment', paymentStatus: 'unpaid' };
    Payment.findOne.mockResolvedValue(null);

    await expect(assertTerminalIsMoneySafe(order, 'cancelled')).resolves.toBeUndefined();
  });
});

describe('transitionOrder', () => {
  it('writes with a compare-and-swap on the source status', async () => {
    const order = paidOrder('paid');
    Order.findById.mockResolvedValue(order);
    Order.findOneAndUpdate.mockResolvedValue({ ...order, status: 'in_progress' });

    const result = await transitionOrder({ orderId: order._id, to: 'in_progress' });

    expect(result.changed).toBe(true);
    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: order._id, status: { $in: ['paid'] } }),
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('reports no change rather than double-applying when another writer won the race', async () => {
    const order = paidOrder('paid');
    Order.findById.mockResolvedValueOnce(order).mockResolvedValueOnce({ ...order, status: 'in_progress' });
    Order.findOneAndUpdate.mockResolvedValue(null); // CAS matched nothing

    const result = await transitionOrder({ orderId: order._id, to: 'in_progress' });

    expect(result.changed).toBe(false);
  });

  it('refuses any transition while a dispute is open', async () => {
    const order = paidOrder('paid');
    Order.findById.mockResolvedValue(order);
    Dispute.findOne.mockResolvedValue({ _id: 'dispute_1' });

    await expect(transitionOrder({ orderId: order._id, to: 'in_progress' })).rejects.toMatchObject({
      code: 'order_disputed',
    });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a transition the table does not allow', async () => {
    const order = paidOrder('paid');
    Order.findById.mockResolvedValue(order);

    await expect(transitionOrder({ orderId: order._id, to: 'completed' })).rejects.toMatchObject({
      code: 'invalid_transition',
    });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('is a no-op when the order is already in the target state', async () => {
    const order = paidOrder('completed');
    Order.findById.mockResolvedValue(order);

    const result = await transitionOrder({ orderId: order._id, to: 'completed' });

    expect(result).toMatchObject({ changed: false, alreadyThere: true });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
