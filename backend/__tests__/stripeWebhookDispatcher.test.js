/**
 * The webhook is the source of truth for Stripe money events. These cover the three
 * things that has to mean in practice: unverified events never reach a handler,
 * replays never re-run side effects, and a genuine failure stays retryable.
 */

jest.mock('../config/stripe', () => ({
  getStripe: jest.fn(),
  getStripeWebhookSecret: jest.fn(),
}));
jest.mock('../services/stripe/eventLedger', () => ({
  claimEvent: jest.fn(),
  markProcessed: jest.fn(),
  releaseClaim: jest.fn(),
}));
jest.mock('../services/stripe/provisioning', () => ({
  provisionSubscriptionFromSession: jest.fn(),
  provisionExtraContactFromSession: jest.fn(),
  applyInvoicePaid: jest.fn(),
  applyInvoicePaymentFailed: jest.fn(),
  applySubscriptionUpdated: jest.fn(),
  applySubscriptionDeleted: jest.fn(),
}));
jest.mock('../controllers/SafePayCheckoutController', () => ({
  confirmPaidSession: jest.fn(),
}));
jest.mock('../models/Order', () => ({ updateOne: jest.fn() }));
jest.mock('../utils/errorLogger', () => ({ logApplicationError: jest.fn() }));

const { getStripe, getStripeWebhookSecret } = require('../config/stripe');
const ledger = require('../services/stripe/eventLedger');
const provisioning = require('../services/stripe/provisioning');
const { confirmPaidSession } = require('../controllers/SafePayCheckoutController');
const Order = require('../models/Order');
const { logApplicationError } = require('../utils/errorLogger');
const { stripeWebhook } = require('../services/stripe/webhookDispatcher');

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function makeReq(overrides = {}) {
  return {
    body: Buffer.from('{}'),
    headers: { 'stripe-signature': 'sig_test' },
    originalUrl: '/api/stripe/webhook',
    ip: '127.0.0.1',
    app: { get: () => null },
    ...overrides,
  };
}

function mockStripeConstructing(event) {
  getStripe.mockResolvedValue({
    webhooks: {
      constructEvent: jest.fn(() => event),
    },
  });
}

const paidSafePaySession = {
  id: 'cs_safepay_1',
  mode: 'payment',
  payment_status: 'paid',
  metadata: { orderId: 'order_1', userId: 'user_1', type: 'safepay_payment' },
};

beforeEach(() => {
  jest.clearAllMocks();
  getStripeWebhookSecret.mockResolvedValue('whsec_test');
  ledger.claimEvent.mockResolvedValue({ claimed: true });
  ledger.markProcessed.mockResolvedValue();
  ledger.releaseClaim.mockResolvedValue();
  confirmPaidSession.mockResolvedValue({ ok: true });
});

describe('signature verification', () => {
  it('rejects an event whose signature does not verify, and never claims it', async () => {
    getStripe.mockResolvedValue({
      webhooks: {
        constructEvent: jest.fn(() => {
          throw new Error('No signatures found matching the expected signature');
        }),
      },
    });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(res.statusCode).toBe(400);
    expect(ledger.claimEvent).not.toHaveBeenCalled();
    expect(confirmPaidSession).not.toHaveBeenCalled();
  });

  it('logs the signature failure with an errorCode, since the logger drops 4xx without one', async () => {
    getStripe.mockResolvedValue({
      webhooks: {
        constructEvent: jest.fn(() => {
          throw new Error('bad signature');
        }),
      },
    });

    await stripeWebhook(makeReq(), makeRes());

    expect(logApplicationError).toHaveBeenCalledWith(
      expect.objectContaining({
        httpStatus: 400,
        errorCode: 'STRIPE_WEBHOOK_SIGNATURE_FAILED',
      })
    );
  });

  it('refuses to process anything when no signing secret is configured', async () => {
    getStripeWebhookSecret.mockResolvedValue(null);
    mockStripeConstructing({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(res.statusCode).toBe(500);
    expect(ledger.claimEvent).not.toHaveBeenCalled();
    expect(logApplicationError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'STRIPE_WEBHOOK_NOT_CONFIGURED' })
    );
  });
});

describe('event-level idempotency', () => {
  it('runs the handler once for a first delivery', async () => {
    mockStripeConstructing({
      id: 'evt_safepay',
      type: 'checkout.session.completed',
      data: { object: paidSafePaySession },
    });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(confirmPaidSession).toHaveBeenCalledTimes(1);
    expect(ledger.markProcessed).toHaveBeenCalledWith('evt_safepay');
    expect(res.statusCode).toBe(200);
  });

  it('does not re-run side effects when Stripe replays the same event', async () => {
    ledger.claimEvent.mockResolvedValue({ claimed: false, reason: 'duplicate' });
    mockStripeConstructing({
      id: 'evt_safepay',
      type: 'checkout.session.completed',
      data: { object: paidSafePaySession },
    });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(confirmPaidSession).not.toHaveBeenCalled();
    expect(res.body).toEqual(expect.objectContaining({ duplicate: true }));
    expect(res.statusCode).toBe(200); // 200 so Stripe stops retrying
  });

  it('releases the claim and asks Stripe to retry when the handler genuinely fails', async () => {
    confirmPaidSession.mockRejectedValue(new Error('mongo is down'));
    mockStripeConstructing({
      id: 'evt_safepay',
      type: 'checkout.session.completed',
      data: { object: paidSafePaySession },
    });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    // Releasing is what keeps the retry from being mistaken for a duplicate.
    expect(ledger.releaseClaim).toHaveBeenCalledWith('evt_safepay', expect.any(Error));
    expect(ledger.markProcessed).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(logApplicationError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'STRIPE_WEBHOOK_HANDLER_FAILED' })
    );
  });
});

describe('routing by session type — the tab-close path', () => {
  it('provisions a SUBSCRIPTION from the webhook alone', async () => {
    provisioning.provisionSubscriptionFromSession.mockResolvedValue({ ok: true });
    mockStripeConstructing({
      id: 'evt_sub',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_sub',
          mode: 'subscription',
          payment_status: 'paid',
          metadata: { userId: 'u1', type: 'subscription' },
        },
      },
    });

    await stripeWebhook(makeReq(), makeRes());

    expect(provisioning.provisionSubscriptionFromSession).toHaveBeenCalledTimes(1);
    expect(confirmPaidSession).not.toHaveBeenCalled();
  });

  it('provisions an EXTRA CONTACT from the webhook alone', async () => {
    provisioning.provisionExtraContactFromSession.mockResolvedValue({ ok: true });
    mockStripeConstructing({
      id: 'evt_extra',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_extra',
          mode: 'payment',
          payment_status: 'paid',
          metadata: { userId: 'u1', serviceId: 's1', type: 'extra_contact' },
        },
      },
    });

    await stripeWebhook(makeReq(), makeRes());

    expect(provisioning.provisionExtraContactFromSession).toHaveBeenCalledTimes(1);
    expect(confirmPaidSession).not.toHaveBeenCalled();
  });

  it('routes a SafePay session to confirmPaidSession', async () => {
    mockStripeConstructing({
      id: 'evt_sp',
      type: 'checkout.session.completed',
      data: { object: paidSafePaySession },
    });

    await stripeWebhook(makeReq(), makeRes());

    expect(confirmPaidSession).toHaveBeenCalledWith(paidSafePaySession, null);
  });

  it('ignores a completed session that was never actually paid', async () => {
    mockStripeConstructing({
      id: 'evt_unpaid',
      type: 'checkout.session.completed',
      data: { object: { ...paidSafePaySession, payment_status: 'unpaid' } },
    });

    await stripeWebhook(makeReq(), makeRes());

    expect(confirmPaidSession).not.toHaveBeenCalled();
  });

  it('routes a zero-due membership session to provisioning', async () => {
    provisioning.provisionSubscriptionFromSession.mockResolvedValue({ ok: true });
    mockStripeConstructing({
      id: 'evt_free_sub',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_free_sub',
          mode: 'subscription',
          payment_status: 'no_payment_required',
          metadata: { userId: 'u1', type: 'subscription' },
        },
      },
    });

    await stripeWebhook(makeReq(), makeRes());

    expect(provisioning.provisionSubscriptionFromSession).toHaveBeenCalledTimes(1);
    expect(confirmPaidSession).not.toHaveBeenCalled();
  });
});

describe('subscription lifecycle events', () => {
  const cases = [
    ['invoice.paid', 'applyInvoicePaid'],
    ['invoice.payment_failed', 'applyInvoicePaymentFailed'],
    ['customer.subscription.updated', 'applySubscriptionUpdated'],
    ['customer.subscription.deleted', 'applySubscriptionDeleted'],
  ];

  it.each(cases)('handles %s', async (type, handlerName) => {
    provisioning[handlerName].mockResolvedValue({ ok: true });
    mockStripeConstructing({ id: `evt_${type}`, type, data: { object: { id: 'obj_1' } } });

    await stripeWebhook(makeReq(), makeRes());

    expect(provisioning[handlerName]).toHaveBeenCalledTimes(1);
  });

  it('marks the order expired on checkout.session.expired', async () => {
    Order.updateOne.mockResolvedValue({});
    mockStripeConstructing({
      id: 'evt_exp',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_gone' } },
    });

    await stripeWebhook(makeReq(), makeRes());

    expect(Order.updateOne).toHaveBeenCalledWith(
      { checkoutSessionId: 'cs_gone' },
      { $set: { checkoutSessionStatus: 'expired' } }
    );
  });

  it('acks an event type it does not handle without claiming a ledger row', async () => {
    mockStripeConstructing({ id: 'evt_other', type: 'charge.succeeded', data: { object: {} } });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(ledger.claimEvent).not.toHaveBeenCalled();
    expect(res.body).toEqual(expect.objectContaining({ ignored: true }));
  });
});
