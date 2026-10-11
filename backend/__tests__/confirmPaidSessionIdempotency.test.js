/**
 * The browser redirect and the Stripe webhook both call confirmPaidSession, by
 * design. They race. Exactly one Payment document and one set of notifications must
 * come out of that race.
 *
 * The old code did find-then-create guarded by a `catch (11000)` that relied on a
 * unique index the schema never declared, so both callers could win.
 */

jest.mock('../models/Order', () => ({ findById: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/Payment', () => ({ updateOne: jest.fn() }));
jest.mock('../models/User', () => ({ updateMany: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Notification', () => ({ create: jest.fn() }));
jest.mock('../models/ChatMessage', () => ({ findById: jest.fn() }));
jest.mock('../models/Service', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/SafePayHistory', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../models/Review', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/StripePaymentIncident', () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'incident_1' }),
}));
jest.mock('../utils/errorLogger', () => ({ logApplicationError: jest.fn() }));
jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));
jest.mock('../services/stripe/customers', () => ({ resolveStripeCustomer: jest.fn() }));

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Notification = require('../models/Notification');
const StripePaymentIncident = require('../models/StripePaymentIncident');
const Chat = require('../models/ChatMessage');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');
const { confirmPaidSession } = require('../controllers/SafePayCheckoutController');

const ORDER_ID = new mongoose.Types.ObjectId();
const CUSTOMER_ID = new mongoose.Types.ObjectId();
const PROVIDER_ID = new mongoose.Types.ObjectId();

function session(overrides = {}) {
  return {
    id: 'cs_test_1',
    status: 'complete',
    mode: 'payment',
    currency: 'nok',
    amount_total: 103000,
    customer: 'cus_test_1',
    livemode: false,
    payment_intent: 'pi_test_1',
    payment_status: 'paid',
    metadata: {
      orderId: String(ORDER_ID),
      userId: String(CUSTOMER_ID),
      checkoutAttemptId: 'attempt_current',
      stripeMode: 'test',
    },
    ...overrides,
  };
}

function order(status = 'awaiting_payment') {
  return {
    _id: ORDER_ID,
    status,
    customerId: CUSTOMER_ID,
    providerId: PROVIDER_ID,
    agreedPrice: 1000,
    checkoutSessionId: 'cs_test_1',
    checkoutSessionStatus: 'open',
    checkoutAttemptId: 'attempt_current',
    checkoutMode: 'test',
    checkoutAmountMinor: 103000,
    checkoutCurrency: 'nok',
    checkoutCustomerId: 'cus_test_1',
    paymentIntentId: status === 'paid' || status === 'in_progress' ? 'pi_test_1' : undefined,
    chatId: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Chat.findById.mockResolvedValue(null);
  User.updateMany.mockResolvedValue({});
  Notification.create.mockResolvedValue({});
  Payment.findOne = jest.fn().mockResolvedValue(null);
  getStripeConfiguration.mockResolvedValue({ mode: 'test', testMode: true });
  getStripeForMode.mockResolvedValue({
    paymentIntents: {
      retrieve: jest.fn(async (id) => ({
        id,
        status: 'succeeded',
        amount_received: 103000,
        currency: 'nok',
        customer: 'cus_test_1',
        latest_charge: id === 'pi_test_1' ? 'ch_test_1' : 'ch_test_2',
      })),
    },
    charges: {
      retrieve: jest.fn(async (id) => ({
        id,
        paid: true,
        captured: true,
        amount: 103000,
        currency: 'nok',
        payment_intent: id === 'ch_test_1' ? 'pi_test_1' : 'pi_test_2',
        customer: 'cus_test_1',
        livemode: false,
      })),
    },
  });
});

describe('confirmPaidSession', () => {
  it('marks the order paid and creates exactly one Payment on first confirmation', async () => {
    Order.findById.mockResolvedValue(order());
    Order.findOneAndUpdate.mockResolvedValue({ ...order('paid'), status: 'paid' });
    Payment.updateOne.mockResolvedValue({ upsertedCount: 1 });

    const result = await confirmPaidSession(session(), null);

    expect(result.ok).toBe(true);
    expect(result.alreadyConfirmed).toBe(false);
    expect(Payment.updateOne).toHaveBeenCalledTimes(1);
    // The write is an upsert, not a create — that is what makes the race safe.
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { orderId: String(ORDER_ID) },
      expect.objectContaining({ $setOnInsert: expect.any(Object) }),
      { upsert: true }
    );
    expect(Notification.create).toHaveBeenCalledTimes(2);
  });

  it('does NOT re-send notifications when the second caller loses the upsert race', async () => {
    Order.findById.mockResolvedValue(order());
    Order.findOneAndUpdate.mockResolvedValue({ ...order('paid'), status: 'paid' });
    // upsertedCount 0 => the document already existed; someone else inserted it.
    Payment.updateOne.mockResolvedValue({ upsertedCount: 0, matchedCount: 1 });

    await confirmPaidSession(session(), null);

    expect(Notification.create).not.toHaveBeenCalled();
    expect(User.updateMany).not.toHaveBeenCalled();
  });

  it('short-circuits when the order is already in a paid state', async () => {
    Order.findById.mockResolvedValue(order('in_progress'));
    Payment.findOne.mockResolvedValue({
      stripeSessionId: 'cs_test_1',
      stripePaymentIntentId: 'pi_test_1',
    });

    const result = await confirmPaidSession(session(), null);

    expect(result).toMatchObject({ ok: true, alreadyConfirmed: true });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { orderId: String(ORDER_ID) },
      expect.objectContaining({ $setOnInsert: expect.any(Object) }),
      { upsert: true }
    );
  });

  it('reports already-confirmed when the status CAS matched nothing', async () => {
    Order.findById.mockResolvedValueOnce(order()).mockResolvedValueOnce(order('paid'));
    Order.findOneAndUpdate.mockResolvedValue(null);

    const result = await confirmPaidSession(session(), null);

    expect(result).toMatchObject({ ok: true, alreadyConfirmed: true });
    expect(Payment.updateOne).toHaveBeenCalled();
  });

  it('only moves an order out of a pre-payment status', async () => {
    Order.findById.mockResolvedValue(order());
    Order.findOneAndUpdate.mockResolvedValue({ ...order('paid'), status: 'paid' });
    Payment.updateOne.mockResolvedValue({ upsertedCount: 1 });

    await confirmPaidSession(session(), null);

    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: ['awaiting_payment', 'pending', 'accepted'] },
      }),
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('refuses a session whose metadata points at a different customer', async () => {
    Order.findById.mockResolvedValue(order());

    const result = await confirmPaidSession(
      session({ metadata: { orderId: String(ORDER_ID), userId: String(new mongoose.Types.ObjectId()) } }),
      null
    );

    expect(result).toEqual({ ok: false, reason: 'session_customer_mismatch' });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses a session with no order metadata', async () => {
    const result = await confirmPaidSession(session({ metadata: {} }), null);
    expect(result).toEqual({ ok: false, reason: 'missing_order_metadata' });
  });

  it('reports a missing order rather than throwing', async () => {
    Order.findById.mockResolvedValue(null);
    const result = await confirmPaidSession(session(), null);
    expect(result).toEqual({ ok: false, reason: 'order_not_found' });
  });

  it('accepts a delayed first payment from a replaced checkout without losing the order', async () => {
    const orderDoc = order();
    Order.findById.mockResolvedValue(orderDoc);
    Order.findOneAndUpdate.mockResolvedValue({
      ...order('paid'),
      checkoutSessionId: 'cs_test_old',
      checkoutAttemptId: 'attempt_old',
      paymentIntentId: 'pi_test_2',
    });
    Payment.updateOne.mockResolvedValue({ upsertedCount: 1 });

    const result = await confirmPaidSession(
      session({
        id: 'cs_test_old',
        payment_intent: 'pi_test_2',
        metadata: {
          orderId: String(ORDER_ID),
          userId: String(CUSTOMER_ID),
          checkoutAttemptId: 'attempt_old',
          stripeMode: 'test',
        },
      }),
      null
    );

    expect(result).toMatchObject({ ok: true, alreadyConfirmed: false });
    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutSessionId: 'cs_test_1',
        checkoutAttemptId: 'attempt_current',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          checkoutSessionId: 'cs_test_old',
          checkoutAttemptId: 'attempt_old',
        }),
      }),
      { new: true }
    );
    expect(StripePaymentIncident.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Notification.create).toHaveBeenCalledTimes(2);
  });

  it('records a separately verified later payment as an incident without a second payout entitlement', async () => {
    const paidOrder = order('paid');
    paidOrder.checkoutSessionId = 'cs_test_1';
    Payment.findOne.mockResolvedValue({
      stripeSessionId: 'cs_test_1',
      stripePaymentIntentId: 'pi_test_1',
    });
    Order.findById.mockResolvedValue(paidOrder);

    const result = await confirmPaidSession(
      session({
        id: 'cs_test_2',
        payment_intent: 'pi_test_2',
        metadata: {
          orderId: String(ORDER_ID),
          userId: String(CUSTOMER_ID),
          checkoutAttemptId: 'attempt_old',
          stripeMode: 'test',
        },
      }),
      null
    );

    expect(result).toMatchObject({ ok: true, duplicatePayment: true, incidentId: 'incident_1' });
    expect(StripePaymentIncident.findOneAndUpdate).toHaveBeenCalledWith(
      { eventId: 'duplicate_payment:cs_test_2:pi_test_2' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          originalPaymentIntentId: 'pi_test_1',
          duplicatePaymentIntentId: 'pi_test_2',
          originalChargeId: 'ch_test_1',
          chargeId: 'ch_test_2',
        }),
      }),
      expect.any(Object)
    );
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Payment.updateOne).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it('records the losing captured payment when two successful attempts race before either Payment is stored', async () => {
    const orderThatLostTheRace = {
      ...order('paid'),
      checkoutSessionId: 'cs_test_old',
      checkoutAttemptId: 'attempt_old',
      paymentIntentId: 'pi_test_2',
    };
    Order.findById
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce(orderThatLostTheRace);
    Payment.findOne.mockResolvedValue(null);
    Order.findOneAndUpdate.mockResolvedValue(null);

    const result = await confirmPaidSession(session(), null);

    expect(result).toMatchObject({ ok: true, duplicatePayment: true });
    expect(StripePaymentIncident.findOneAndUpdate).toHaveBeenCalledWith(
      { eventId: 'duplicate_payment:cs_test_1:pi_test_1' },
      expect.objectContaining({
        $setOnInsert: expect.objectContaining({
          originalPaymentIntentId: 'pi_test_2',
          duplicatePaymentIntentId: 'pi_test_1',
          originalChargeId: 'ch_test_2',
          chargeId: 'ch_test_1',
        }),
      }),
      expect.any(Object)
    );
    expect(Payment.updateOne).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });
});
