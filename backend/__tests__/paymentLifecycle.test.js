jest.mock('../models/Order', () => ({
  findById: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/Payment', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/Payout', () => ({
  findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
}));
jest.mock('../models/StripeTransferRecord', () => ({
  findOne: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(null) })),
}));
jest.mock('../models/StripePaymentIncident', () => ({
  findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'incident_1' }),
  findOne: jest.fn(() => ({ sort: () => ({ lean: jest.fn().mockResolvedValue(null) }) })),
  updateMany: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/StripeFinancialOperation', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../config/stripe', () => ({ getStripeForMode: jest.fn() }));
jest.mock('../utils/errorLogger', () => ({ logApplicationError: jest.fn() }));

const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const StripePaymentIncident = require('../models/StripePaymentIncident');
const StripeFinancialOperation = require('../models/StripeFinancialOperation');
const { getStripeForMode } = require('../config/stripe');
const { recordStripePaymentLifecycle } = require('../services/stripe/paymentLifecycle');

const order = {
  _id: 'order_1',
  customerId: 'customer_1',
  status: 'ready_for_review',
  checkoutMode: 'test',
  checkoutSessionId: 'cs_test_1',
  checkoutCustomerId: 'cus_test_1',
  checkoutAmountMinor: 103000,
  checkoutCurrency: 'nok',
};
const payment = {
  _id: 'payment_1',
  orderId: 'order_1',
  stripePaymentIntentId: 'pi_test_1',
  stripeSessionId: 'cs_test_1',
  stripeLivemode: false,
  status: 'completed',
};

let stripe;
let dispute;
let charge;

beforeEach(() => {
  jest.clearAllMocks();
  dispute = {
    id: 'dp_test_1',
    charge: 'ch_test_1',
    payment_intent: 'pi_test_1',
    amount: 103000,
    currency: 'nok',
    status: 'needs_response',
    reason: 'fraudulent',
    evidence_details: { due_by: 1_800_000_000 },
  };
  charge = {
    id: 'ch_test_1',
    payment_intent: 'pi_test_1',
    customer: 'cus_test_1',
    amount: 103000,
    amount_refunded: 0,
    currency: 'nok',
    livemode: false,
    paid: true,
    captured: true,
  };
  stripe = {
    paymentIntents: {
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_test_1',
        status: 'succeeded',
        amount_received: 103000,
        customer: 'cus_test_1',
        latest_charge: 'ch_test_1',
      }),
    },
    disputes: { retrieve: jest.fn().mockResolvedValue(dispute) },
    charges: { retrieve: jest.fn().mockResolvedValue(charge) },
    checkout: {
      sessions: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'cs_test_1',
          livemode: false,
          payment_intent: 'pi_test_1',
          customer: 'cus_test_1',
          metadata: { orderId: 'order_1', userId: 'customer_1' },
          amount_total: 103000,
          currency: 'nok',
        }),
      },
    },
    refunds: { retrieve: jest.fn() },
  };
  getStripeForMode.mockResolvedValue(stripe);
  Payment.findOne.mockResolvedValue(payment);
  Order.findById.mockResolvedValue(order);
  Order.updateOne.mockResolvedValue({ modifiedCount: 1 });
  Payment.updateOne.mockResolvedValue({ modifiedCount: 1 });
});

it('freezes a matched order for a verified Stripe chargeback without automatically reversing a transfer', async () => {
  const result = await recordStripePaymentLifecycle({
    id: 'evt_dispute_1',
    type: 'charge.dispute.created',
    livemode: false,
    data: { object: dispute },
  });

  expect(result).toMatchObject({ handled: 'charge_dispute', orderId: 'order_1' });
  expect(StripePaymentIncident.findOneAndUpdate).toHaveBeenCalledWith(
    { eventId: 'evt_dispute_1' },
    expect.objectContaining({
      $setOnInsert: expect.objectContaining({
        kind: 'charge_dispute',
        status: 'manual_review',
        stripeDisputeId: 'dp_test_1',
        previousOrderStatus: 'ready_for_review',
      }),
    }),
    expect.any(Object)
  );
  expect(Payment.updateOne).toHaveBeenCalledWith(
    { _id: 'payment_1', status: { $in: ['completed', 'released'] } },
    { $set: { status: 'disputed' } }
  );
  expect(Order.updateOne).toHaveBeenCalledWith(
    { _id: 'order_1', status: { $in: ['paid', 'in_progress', 'ready_for_review', 'completed'] } },
    { $set: { status: 'disputed' } }
  );
  expect(stripe.transfers).toBeUndefined();
});

it('leaves mismatched Stripe events visible as unmatched and does not mutate payment state', async () => {
  stripe.checkout.sessions.retrieve.mockResolvedValue({
    id: 'cs_test_1',
    livemode: false,
    payment_intent: 'pi_test_1',
    customer: 'cus_other',
    metadata: { orderId: 'order_1', userId: 'customer_1' },
    amount_total: 103000,
    currency: 'nok',
  });

  const result = await recordStripePaymentLifecycle({
    id: 'evt_dispute_bad',
    type: 'charge.dispute.created',
    livemode: false,
    data: { object: dispute },
  });

  expect(result).toEqual({ handled: 'unmatched_payment_event' });
  expect(StripePaymentIncident.findOneAndUpdate).toHaveBeenCalledWith(
    { eventId: 'evt_dispute_bad' },
    expect.objectContaining({
      $setOnInsert: expect.objectContaining({ kind: 'unmatched' }),
    }),
    expect.any(Object)
  );
  expect(Payment.updateOne).not.toHaveBeenCalled();
  expect(Order.updateOne).not.toHaveBeenCalled();
});

it('restores a frozen order only after Stripe reports a favorable dispute outcome', async () => {
  dispute.status = 'won';
  Order.findById.mockResolvedValue({ ...order, status: 'disputed' });
  Payment.findOne.mockResolvedValue({ ...payment, status: 'disputed' });
  StripePaymentIncident.findOne.mockReturnValue({
    sort: () => ({
      lean: jest.fn().mockResolvedValue({ previousOrderStatus: 'ready_for_review' }),
    }),
  });

  await recordStripePaymentLifecycle({
    id: 'evt_dispute_won',
    type: 'charge.dispute.closed',
    livemode: false,
    data: { object: dispute },
  });

  expect(StripePaymentIncident.updateMany).toHaveBeenCalledWith(
    { stripeDisputeId: 'dp_test_1' },
    { $set: { status: 'reconciled', disputeStatus: 'won' } }
  );
  expect(Payment.updateOne).toHaveBeenCalledWith(
    { _id: 'payment_1', status: 'disputed' },
    { $set: { status: 'completed' } }
  );
  expect(Order.updateOne).toHaveBeenCalledWith(
    { _id: 'order_1', status: 'disputed' },
    { $set: { status: 'ready_for_review' } }
  );
});

it('reconciles a successful internally approved refund from its signed Stripe refund event', async () => {
  const refund = {
    id: 're_test_1',
    charge: 'ch_test_1',
    payment_intent: 'pi_test_1',
    amount: 20000,
    currency: 'nok',
    status: 'succeeded',
    metadata: { jobbloOperationKey: 'dispute:one:refund' },
  };
  stripe.refunds.retrieve.mockResolvedValue(refund);
  charge.amount_refunded = 20000;
  StripeFinancialOperation.findOne.mockResolvedValue({
    _id: 'financial_operation_1',
    type: 'refund',
    paymentIntentId: 'pi_test_1',
    amount: 20000,
    currency: 'NOK',
    stripeMode: 'test',
    incidentId: 'incident_1',
  });
  Order.findById.mockResolvedValue({ ...order, status: 'paid' });

  const result = await recordStripePaymentLifecycle({
    id: 'evt_refund_1',
    type: 'refund.updated',
    livemode: false,
    data: { object: refund },
  });

  expect(result.handled).toBe('refund');
  expect(StripeFinancialOperation.updateOne).toHaveBeenCalledWith(
    { _id: 'financial_operation_1' },
    expect.objectContaining({
      $set: expect.objectContaining({ status: 'succeeded', stripeObjectId: 're_test_1' }),
    })
  );
  expect(StripePaymentIncident.updateOne).toHaveBeenCalledWith(
    { _id: 'incident_1', kind: 'duplicate_payment', status: 'manual_review' },
    expect.objectContaining({
      $set: expect.objectContaining({ status: 'reconciled', stripeObjectId: 're_test_1' }),
    })
  );
  expect(Payment.updateOne).toHaveBeenCalledWith(
    { _id: 'payment_1', status: { $nin: ['disputed', 'refunded'] } },
    { $set: { status: 'partially_refunded' } }
  );
});

it('records internal duplicate-payment recovery as an incident only after Stripe confirms both captures', async () => {
  const { recordDuplicateSafePayPayment } = require('../services/stripe/paymentLifecycle');
  const result = await recordDuplicateSafePayPayment({
    order,
    originalPayment: payment,
    session: {
      id: 'cs_test_duplicate',
      livemode: false,
      amount_total: 103000,
      currency: 'nok',
      customer: 'cus_test_1',
    },
    paymentIntentId: 'pi_test_duplicate',
    chargeId: 'ch_test_duplicate',
  });

  expect(result).toMatchObject({ _id: 'incident_1' });
  expect(StripePaymentIncident.findOneAndUpdate).toHaveBeenCalledWith(
    { eventId: 'duplicate_payment:cs_test_duplicate:pi_test_duplicate' },
    expect.objectContaining({
      $setOnInsert: expect.objectContaining({
        kind: 'duplicate_payment',
        originalPaymentIntentId: 'pi_test_1',
        duplicatePaymentIntentId: 'pi_test_duplicate',
      }),
    }),
    expect.any(Object)
  );
});
