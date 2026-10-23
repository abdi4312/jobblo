jest.mock('../models/Order', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(() => ({ select: () => ({ lean: async () => null }) })),
}));
jest.mock('../models/Payment', () => ({ findOne: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/Payout', () => ({ findOne: jest.fn() }));
jest.mock('../models/StripeTransferRecord', () => ({ findOne: jest.fn() }));
jest.mock('../models/StripeFinancialOperation', () => ({ findOne: jest.fn() }));
jest.mock('../models/Dispute', () => ({ findOne: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/Service', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/ChatMessage', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../models/JobRequest', () => ({ updateMany: jest.fn() }));
jest.mock('../models/SafePayHistory', () => ({ updateOne: jest.fn() }));
jest.mock('../config/stripe', () => ({ getStripeForMode: jest.fn() }));
jest.mock('../services/stripe/financialOperations', () => ({ executeRefund: jest.fn() }));
jest.mock('../services/notifications', () => ({ notify: jest.fn() }));
jest.mock('../utils/errorLogger', () => ({ logApplicationError: jest.fn() }));

const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const StripeTransferRecord = require('../models/StripeTransferRecord');
const StripeFinancialOperation = require('../models/StripeFinancialOperation');
const Dispute = require('../models/Dispute');
const User = require('../models/User');
const Service = require('../models/Service');
const SafePayHistory = require('../models/SafePayHistory');
const { getStripeForMode } = require('../config/stripe');
const { executeRefund } = require('../services/stripe/financialOperations');
const { notify } = require('../services/notifications');
const { logApplicationError } = require('../utils/errorLogger');
const {
  processOrder,
  recordReadyProvidersBeforeDeadline,
  applyTimeoutRefundResult,
} = require('../services/safepay/providerConnectTimeout');

const now = new Date('2025-02-01T00:00:00.000Z');
const order = {
  _id: 'order_1',
  status: 'paid',
  paymentStatus: 'paid',
  startedAt: null,
  serviceId: 'service_1',
  customerId: 'customer_1',
  providerId: 'provider_1',
  chatId: null,
  agreedPrice: 1000,
  checkoutMode: 'test',
  checkoutSessionId: 'cs_test_1',
  checkoutAmountMinor: 103000,
  checkoutCurrency: 'nok',
  checkoutCustomerId: 'cus_test_1',
  paymentIntentId: 'pi_test_1',
  providerConnectDeadlineAt: new Date(now.getTime() - 1),
  providerConnectDeadlineDays: 3,
};
const payment = {
  _id: 'payment_1',
  orderId: order._id,
  status: 'completed',
  stripeLivemode: false,
  stripeSessionId: order.checkoutSessionId,
  stripePaymentIntentId: order.paymentIntentId,
};

function makeStripe({ payoutReady = false, accountError } = {}) {
  return {
    checkout: {
      sessions: {
        retrieve: jest.fn().mockResolvedValue({
          id: order.checkoutSessionId,
          mode: 'payment',
          status: 'complete',
          payment_status: 'paid',
          livemode: false,
          payment_intent: order.paymentIntentId,
          customer: 'cus_test_1',
          metadata: { orderId: order._id, userId: order.customerId },
          amount_total: order.checkoutAmountMinor,
          currency: 'nok',
        }),
      },
    },
    paymentIntents: {
      retrieve: jest.fn().mockResolvedValue({
        id: order.paymentIntentId,
        livemode: false,
        status: 'succeeded',
        amount: order.checkoutAmountMinor,
        amount_received: order.checkoutAmountMinor,
        customer: 'cus_test_1',
        latest_charge: 'ch_test_1',
        currency: 'nok',
      }),
    },
    charges: {
      retrieve: jest.fn().mockResolvedValue({
        id: 'ch_test_1',
        livemode: false,
        paid: true,
        captured: true,
        amount: order.checkoutAmountMinor,
        amount_refunded: 0,
        payment_intent: order.paymentIntentId,
        customer: 'cus_test_1',
        currency: 'nok',
      }),
    },
    accounts: {
      retrieve: jest.fn(async () => {
        if (accountError) throw accountError;
        return {
          id: 'acct_test_1',
          payouts_enabled: payoutReady,
          details_submitted: payoutReady,
          capabilities: { transfers: payoutReady ? 'active' : 'pending' },
        };
      }),
    },
  };
}

function configure({ stripe = makeStripe(), serviceStatus = 'awaiting_payment' } = {}) {
  Payment.findOne.mockResolvedValue(payment);
  Order.findOneAndUpdate.mockResolvedValue({});
  Payout.findOne.mockResolvedValue(null);
  StripeTransferRecord.findOne.mockResolvedValue(null);
  StripeFinancialOperation.findOne.mockResolvedValue(null);
  Dispute.findOne.mockResolvedValue(null);
  User.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ stripeConnectAccountIdTest: 'acct_test_1' }),
  });
  Service.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ status: serviceStatus }),
  });
  Service.findByIdAndUpdate.mockResolvedValue({});
  SafePayHistory.updateOne.mockResolvedValue({});
  getStripeForMode.mockResolvedValue(stripe);
  return stripe;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SafePay provider Connect timeout processor', () => {
  it('refunds an unstarted job even when the provider is Stripe Connect-ready', async () => {
    const stripe = configure({ stripe: makeStripe({ payoutReady: true }) });
    executeRefund.mockResolvedValue({
      operation: {
        operationKey: `safepay-connect-timeout:${order._id}:${payment.stripePaymentIntentId}`,
        orderId: order._id,
        paymentIntentId: payment.stripePaymentIntentId,
        amount: order.checkoutAmountMinor,
      },
      refund: { id: 're_test_ready', status: 'succeeded' },
      status: 'succeeded',
    });

    await expect(processOrder({ ...order, providerConnectTimeout: { status: 'provider_ready' } }, now))
      .resolves.toBe('refunded');

    expect(stripe.accounts.retrieve).not.toHaveBeenCalled();
    expect(executeRefund).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ amount: 103000 }));
    // An order already marked provider_ready is still claimable; only a started job is excluded.
    const claimFilter = Order.findOneAndUpdate.mock.calls[0][0];
    expect(claimFilter).toMatchObject({ startedAt: null });
    expect(claimFilter.$or).toContainEqual({ 'providerConnectTimeout.status': { $in: [null, 'provider_ready'] } });
  });

  it('stops the countdown when Stripe confirms readiness before the deadline', async () => {
    configure({ stripe: makeStripe({ payoutReady: true }) });
    const beforeDeadlineOrder = {
      ...order,
      providerConnectDeadlineAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    };
    Order.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([beforeDeadlineOrder]),
    });

    await expect(recordReadyProvidersBeforeDeadline(now)).resolves.toEqual({
      scanned: 1,
      ready: 1,
      retry: 0,
    });
    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        providerConnectDeadlineAt: { $gt: now },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          'providerConnectTimeout.status': 'provider_ready',
        }),
      }),
      { new: true }
    );
    expect(SafePayHistory.updateOne).toHaveBeenCalledWith(
      { orderId: order._id },
      { $set: { providerConnectStatus: 'ready' } }
    );
  });

  it('marks a Connect lookup uncertain and retries without assuming the provider is unready', async () => {
    configure({ stripe: makeStripe({ accountError: new Error('temporary outage') }) });
    const beforeDeadlineOrder = {
      ...order,
      providerConnectDeadlineAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    };
    Order.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([beforeDeadlineOrder]),
    });

    await expect(recordReadyProvidersBeforeDeadline(now)).resolves.toMatchObject({ retry: 1 });
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(SafePayHistory.updateOne).toHaveBeenCalledWith(
      { orderId: order._id, status: 'payment_received' },
      { $set: { providerConnectStatus: 'verification_retry' } }
    );
  });

  it('refunds the complete verified capture, including the SafePay fee', async () => {
    configure();
    const operation = {
      operationKey: `safepay-connect-timeout:${order._id}:${payment.stripePaymentIntentId}`,
      orderId: order._id,
      paymentIntentId: payment.stripePaymentIntentId,
      amount: order.checkoutAmountMinor,
      currency: 'NOK',
    };
    executeRefund.mockResolvedValue({
      operation,
      refund: { id: 're_test_1', status: 'succeeded' },
      status: 'succeeded',
    });

    await expect(processOrder(order, now)).resolves.toBe('refunded');

    expect(executeRefund).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ amount: 103000, currency: 'nok' })
    );
    expect(Payment.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({ refundedAmountMinor: 103000, refundStatus: 'succeeded' }),
      })
    );
  });

  it('keeps a pending refund unfinalized, cancels the job and notifies once', async () => {
    configure();
    const operation = {
      operationKey: `safepay-connect-timeout:${order._id}:${payment.stripePaymentIntentId}`,
      orderId: order._id,
      paymentIntentId: payment.stripePaymentIntentId,
      amount: 103000,
      currency: 'NOK',
    };
    executeRefund.mockResolvedValue({
      operation,
      refund: { id: 're_pending', status: 'pending' },
      status: 'pending',
    });

    await expect(processOrder(order, now)).resolves.toBe('pending');

    expect(Order.findOneAndUpdate).toHaveBeenCalledTimes(3);
    expect(Payment.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        $set: expect.objectContaining({
          refundStatus: 'pending',
          refundAmountMinor: 103000,
          refundedAmountMinor: 0,
        }),
      })
    );
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('records a definitive Stripe refund failure without marking the payment refunded', async () => {
    configure();
    executeRefund.mockResolvedValue({
      operation: {
        operationKey: `safepay-connect-timeout:${order._id}:${payment.stripePaymentIntentId}`,
        orderId: order._id,
        paymentIntentId: payment.stripePaymentIntentId,
        amount: 103000,
        currency: 'NOK',
      },
      refund: { id: 're_failed', status: 'failed' },
      status: 'failed',
    });

    await expect(processOrder(order, now)).resolves.toBe('failed');

    const paymentUpdate = Payment.updateOne.mock.calls[0][1].$set;
    expect(paymentUpdate).toMatchObject({
      refundStatus: 'failed',
      refundAmountMinor: 103000,
      refundedAmountMinor: 0,
    });
    expect(paymentUpdate.status).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({
      userId: order.providerId,
      event: 'provider_connect_refund_failed',
    }));
  });

  it('cancels and flags an ambiguous refund for reconciliation without claiming success', async () => {
    configure();
    const operation = {
      operationKey: `safepay-connect-timeout:${order._id}:${payment.stripePaymentIntentId}`,
      orderId: order._id,
      paymentIntentId: payment.stripePaymentIntentId,
      amount: 103000,
      currency: 'NOK',
      status: 'reconciliation_required',
    };
    StripeFinancialOperation.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(operation);
    executeRefund.mockRejectedValue({
      code: 'STRIPE_REFUND_RECONCILIATION_REQUIRED',
      message: 'Stripe outcome is uncertain',
    });

    await expect(processOrder(order, now)).resolves.toBe('reconciliation_required');

    const paymentUpdate = Payment.updateOne.mock.calls[0][1].$set;
    expect(paymentUpdate).toMatchObject({
      refundStatus: 'reconciliation_required',
      refundAmountMinor: 103000,
      refundedAmountMinor: 0,
    });
    expect(paymentUpdate.status).toBeUndefined();
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('routes active disputes, existing transfers and started work to manual review', async () => {
    configure();
    Dispute.findOne.mockResolvedValueOnce({ _id: 'dispute_1' });
    await expect(processOrder(order, now)).resolves.toBe('manual_review');
    expect(executeRefund).not.toHaveBeenCalled();

    jest.clearAllMocks();
    configure({ serviceStatus: 'in_progress' });
    await expect(processOrder(order, now)).resolves.toBe('manual_review');
    expect(executeRefund).not.toHaveBeenCalled();

    jest.clearAllMocks();
    configure();
    StripeTransferRecord.findOne.mockResolvedValue({ _id: 'transfer_1' });
    await expect(processOrder(order, now)).resolves.toBe('manual_review');
    expect(executeRefund).not.toHaveBeenCalled();
  });

  it('does not proceed if another worker already claimed the order', async () => {
    configure();
    Order.findOneAndUpdate.mockResolvedValue(null);

    await expect(processOrder(order, now)).resolves.toBe('skipped');

    expect(getStripeForMode).not.toHaveBeenCalled();
    expect(executeRefund).not.toHaveBeenCalled();
  });

  it('finalizes a succeeded refund webhook only once', async () => {
    configure();
    Order.findOneAndUpdate
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce(null);
    const operation = {
      operationKey: `safepay-connect-timeout:${order._id}:${payment.stripePaymentIntentId}`,
      orderId: order._id,
      paymentIntentId: payment.stripePaymentIntentId,
      amount: 103000,
      currency: 'NOK',
      chargeId: 'ch_test_1',
    };
    const refund = {
      id: 're_test_1',
      amount: 103000,
      currency: 'nok',
      payment_intent: payment.stripePaymentIntentId,
      charge: 'ch_test_1',
      status: 'succeeded',
      metadata: { jobbloOperationKey: operation.operationKey },
    };

    await expect(applyTimeoutRefundResult(order, payment, operation, refund, 'succeeded'))
      .resolves.toBe(true);
    // The second finalizer (scheduler vs webhook) sees the same refund already recorded.
    Order.findById.mockReturnValueOnce({
      select: () => ({ lean: async () => ({ providerConnectTimeout: { status: 'succeeded', stripeRefundId: 're_test_1' } }) }),
    });
    await expect(applyTimeoutRefundResult(order, payment, operation, refund, 'succeeded'))
      .resolves.toBe(false);

    expect(notify).toHaveBeenCalledTimes(2);
    expect(Payment.updateOne).toHaveBeenCalledTimes(1);
    expect(logApplicationError).not.toHaveBeenCalled();
  });

  it('still flags a real finalization conflict for review', async () => {
    configure();
    Order.findOneAndUpdate.mockResolvedValue(null);
    const operation = {
      operationKey: `safepay-connect-timeout:${order._id}:${payment.stripePaymentIntentId}`,
      orderId: order._id,
      paymentIntentId: payment.stripePaymentIntentId,
      amount: 103000,
    };
    const refund = { id: 're_test_2', status: 'succeeded', metadata: { jobbloOperationKey: operation.operationKey } };

    await expect(applyTimeoutRefundResult(order, payment, operation, refund, 'succeeded')).resolves.toBe(false);
    expect(logApplicationError).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'SAFEPAY_CONNECT_TIMEOUT_FINALIZATION_CONFLICT',
    }));
  });
});
