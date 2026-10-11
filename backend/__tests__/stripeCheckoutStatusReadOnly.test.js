jest.mock('../models/Transaction', () => ({ findOne: jest.fn() }));
jest.mock('../config/stripe', () => ({ getStripe: jest.fn() }));
jest.mock('../services/stripe/provisioning', () => ({
  provisionSubscriptionFromSession: jest.fn(),
  provisionExtraContactFromSession: jest.fn(),
  subscriptionPeriodEnd: jest.fn(),
}));

const Transaction = require('../models/Transaction');
const { getStripe } = require('../config/stripe');
const {
  provisionSubscriptionFromSession,
  provisionExtraContactFromSession,
} = require('../services/stripe/provisioning');
const {
  checkoutSessionStatus,
  extraContactPaymentStatus,
} = require('../controllers/stripeController');

const USER_ID = '507f1f77bcf86cd799439011';

function response() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((status) => {
    res.statusCode = status;
    return res;
  });
  res.json = jest.fn((body) => {
    res.body = body;
    return res;
  });
  return res;
}

function transaction(value) {
  Transaction.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(value) });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Stripe checkout status endpoints are read-only', () => {
  it('reports a subscription only after the webhook recorded its succeeded transaction', async () => {
    transaction({
      userId: USER_ID,
      stripeSessionId: 'cs_confirmed',
      type: 'subscription',
      status: 'succeeded',
      planName: 'Pro',
      planType: 'private',
      amount: 299,
      currency: 'nok',
      discountAmount: 0,
      discountCoupon: null,
    });
    const res = response();

    await checkoutSessionStatus(
      { params: { sessionId: 'cs_confirmed' }, userId: USER_ID },
      res
    );

    expect(res.body).toMatchObject({ payment_status: 'paid', plan: 'Pro', amount: 299 });
    expect(getStripe).not.toHaveBeenCalled();
    expect(provisionSubscriptionFromSession).not.toHaveBeenCalled();
  });

  it('does not provision a subscription from an unconfirmed browser return', async () => {
    transaction(null);
    const res = response();

    await checkoutSessionStatus(
      { params: { sessionId: 'cs_unconfirmed' }, userId: USER_ID },
      res
    );

    expect(res.body).toEqual({ payment_status: 'unpaid' });
    expect(getStripe).not.toHaveBeenCalled();
    expect(provisionSubscriptionFromSession).not.toHaveBeenCalled();
  });

  it('reports an extra-contact purchase only after the webhook recorded it', async () => {
    transaction({
      userId: USER_ID,
      stripeSessionId: 'cs_contact',
      type: 'extra_contact',
      status: 'succeeded',
      serviceId: '507f1f77bcf86cd799439022',
    });
    const res = response();

    await extraContactPaymentStatus(
      { params: { sessionId: 'cs_contact' }, userId: USER_ID },
      res
    );

    expect(res.body).toEqual({
      payment_status: 'paid',
      serviceId: '507f1f77bcf86cd799439022',
    });
    expect(getStripe).not.toHaveBeenCalled();
    expect(provisionExtraContactFromSession).not.toHaveBeenCalled();
  });

  it('does not disclose a transaction owned by a different user', async () => {
    transaction({ userId: '507f1f77bcf86cd799439099', status: 'succeeded' });
    const res = response();

    await extraContactPaymentStatus(
      { params: { sessionId: 'cs_someone_elses' }, userId: USER_ID },
      res
    );

    expect(res.statusCode).toBe(403);
    expect(getStripe).not.toHaveBeenCalled();
    expect(provisionExtraContactFromSession).not.toHaveBeenCalled();
  });
});
