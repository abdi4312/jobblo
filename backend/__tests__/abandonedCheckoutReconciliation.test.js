jest.mock('../models/Order', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../models/Payment', () => ({}));
jest.mock('../models/Payout', () => ({}));
jest.mock('../models/Dispute', () => ({}));
jest.mock('../models/Notification', () => ({}));
jest.mock('../models/Service', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../models/JobRequest', () => ({ updateMany: jest.fn() }));
jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));
jest.mock('../services/stripe/financialHistory', () => ({
  reconcileConnectedAccountsBatch: jest.fn(),
}));
jest.mock('../utils/errorLogger', () => ({ logApplicationError: jest.fn() }));
jest.mock('../services/notifications', () => ({ notify: jest.fn() }));
jest.mock('../controllers/SafePayCheckoutController', () => ({
  confirmPaidSession: jest.fn(),
}));

const Order = require('../models/Order');
const { getStripeForMode } = require('../config/stripe');
const { confirmPaidSession } = require('../controllers/SafePayCheckoutController');
const { cleanupAbandonedOrders } = require('../services/scheduler/jobs');

const checkoutOrder = {
  _id: 'order_1',
  serviceId: 'service_1',
  checkoutSessionId: 'cs_test_1',
  checkoutSessionStatus: 'open',
  checkoutAttemptId: 'attempt_1',
  checkoutMode: 'test',
};

function setupOrder(order = checkoutOrder) {
  Order.find.mockReturnValue({
    select: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([order]) }),
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  Order.findOneAndUpdate.mockResolvedValue(null);
});

describe('abandoned SafePay checkout reconciliation', () => {
  it('does not cancel an open Stripe Checkout Session', async () => {
    setupOrder();
    const stripe = {
      checkout: { sessions: { retrieve: jest.fn().mockResolvedValue({
        id: 'cs_test_1',
        livemode: false,
        status: 'open',
        payment_status: 'unpaid',
      }) } },
    };
    getStripeForMode.mockResolvedValue(stripe);

    await cleanupAbandonedOrders();

    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('reconciles a paid session and never cancels it', async () => {
    setupOrder();
    getStripeForMode.mockResolvedValue({
      checkout: { sessions: { retrieve: jest.fn().mockResolvedValue({
        id: 'cs_test_1',
        livemode: false,
        status: 'complete',
        payment_status: 'paid',
      }) } },
    });
    confirmPaidSession.mockResolvedValue({ ok: true });

    await cleanupAbandonedOrders();

    expect(confirmPaidSession).toHaveBeenCalled();
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('cancels only after Stripe confirms the matching session expired and unpaid', async () => {
    setupOrder();
    const stripe = {
      checkout: { sessions: { retrieve: jest.fn().mockResolvedValue({
        id: 'cs_test_1',
        livemode: false,
        status: 'expired',
        payment_status: 'unpaid',
      }) } },
    };
    getStripeForMode.mockResolvedValue(stripe);
    Order.findOneAndUpdate.mockResolvedValue({ ...checkoutOrder, chatId: null });
    Order.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    await cleanupAbandonedOrders();

    expect(Order.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        checkoutSessionId: 'cs_test_1',
        status: 'awaiting_payment',
        paymentStatus: { $ne: 'paid' },
      }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'cancelled' }) })
    );
  });
});
