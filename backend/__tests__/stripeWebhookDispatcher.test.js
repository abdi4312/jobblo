/**
 * The webhook is the source of truth for Stripe money events. These cover the three
 * things that has to mean in practice: unverified events never reach a handler,
 * replays never re-run side effects, and a genuine failure stays retryable.
 */

jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));
jest.mock('../services/stripe/webhookReadiness', () => ({
  recordVerifiedDelivery: jest.fn(),
  recordDeliveryProblem: jest.fn(),
}));
jest.mock('../services/stripe/eventLedger', () => ({
  claimEvent: jest.fn(),
  markProcessed: jest.fn(),
  releaseClaim: jest.fn(),
}));
jest.mock('../controllers/SafePayCheckoutController', () => ({
  confirmPaidSession: jest.fn(),
}));
jest.mock('../models/Order', () => ({ updateOne: jest.fn() }));
jest.mock('../utils/errorLogger', () => ({ logApplicationError: jest.fn() }));
jest.mock('../services/stripe/paymentLifecycle', () => ({
  recordStripePaymentLifecycle: jest.fn(),
  recordRejectedSafePayPayment: jest.fn(),
}));
jest.mock('../services/subscriptions/v2WebhookProcessor', () => ({
  processVerifiedEvent: jest.fn(),
}));

const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');
const webhookReadiness = require('../services/stripe/webhookReadiness');
const ledger = require('../services/stripe/eventLedger');
const { confirmPaidSession } = require('../controllers/SafePayCheckoutController');
const Order = require('../models/Order');
const { logApplicationError } = require('../utils/errorLogger');
const paymentLifecycle = require('../services/stripe/paymentLifecycle');
const { stripeWebhook, ORDER_EVENT_TYPES } = require('../services/stripe/webhookDispatcher');
const { processVerifiedEvent } = require('../services/subscriptions/v2WebhookProcessor');
const Stripe = require('stripe');

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
  getStripeForMode.mockResolvedValue({
    webhooks: {
      constructEvent: jest.fn(() => ({ livemode: false, ...event })),
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
  getStripeConfiguration.mockResolvedValue({
    testMode: true,
    mode: 'test',
    secretKey: 'sk_test_fake',
    webhookSecret: 'whsec_test',
    keyModeValid: true,
    webhookSecretValid: true,
    fingerprint: 'fingerprint_test',
  });
  webhookReadiness.recordVerifiedDelivery.mockResolvedValue();
  webhookReadiness.recordDeliveryProblem.mockResolvedValue();
  ledger.claimEvent.mockResolvedValue({ claimed: true });
  ledger.markProcessed.mockResolvedValue();
  ledger.releaseClaim.mockResolvedValue();
  paymentLifecycle.recordRejectedSafePayPayment.mockResolvedValue({ _id: 'incident_1' });
  confirmPaidSession.mockResolvedValue({ ok: true });
  processVerifiedEvent.mockResolvedValue({ handled: 'subscription_activated' });
});

describe('signature verification', () => {
  it('accepts a valid Stripe SDK-signed event and records readiness only after verification', async () => {
    const signingSecret = 'whsec_test_fixture';
    const stripe = Stripe('sk_test_fixture');
    getStripeForMode.mockResolvedValue(stripe);
    const payload = JSON.stringify({
      id: 'evt_signed_fixture',
      object: 'event',
      type: 'account.updated',
      livemode: false,
      data: { object: { id: 'acct_test' } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: signingSecret,
    });
    getStripeConfiguration.mockResolvedValue({
      testMode: true,
      mode: 'test',
      secretKey: 'sk_test_fixture',
      webhookSecret: signingSecret,
      keyModeValid: true,
      webhookSecretValid: true,
      fingerprint: 'fingerprint_test',
    });

    const res = makeRes();
    await stripeWebhook(
      makeReq({ body: Buffer.from(payload), headers: { 'stripe-signature': signature } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(webhookReadiness.recordVerifiedDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'test' }),
      'evt_signed_fixture'
    );
  });

  it('rejects an event whose signature does not verify, and never claims it', async () => {
    getStripeForMode.mockResolvedValue({
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
    getStripeForMode.mockResolvedValue({
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
    getStripeConfiguration.mockResolvedValue({
      testMode: true,
      mode: 'test',
      secretKey: 'sk_test_fake',
      webhookSecret: null,
      keyModeValid: true,
      webhookSecretValid: false,
      fingerprint: null,
    });
    mockStripeConstructing({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(res.statusCode).toBe(503);
    expect(ledger.claimEvent).not.toHaveBeenCalled();
    expect(logApplicationError).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: 'STRIPE_WEBHOOK_SECRET_MISSING' })
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

  it('acknowledges a permanent verification failure only after recording manual review', async () => {
    confirmPaidSession.mockResolvedValue({ ok: false, reason: 'amount_mismatch' });
    const session = { ...paidSafePaySession, amount_total: 5000 };
    mockStripeConstructing({
      id: 'evt_rejected_safepay',
      type: 'checkout.session.completed',
      data: { object: session },
    });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(paymentLifecycle.recordRejectedSafePayPayment).toHaveBeenCalledWith({
      event: expect.objectContaining({ id: 'evt_rejected_safepay' }),
      session,
      reason: 'amount_mismatch',
    });
    expect(ledger.markProcessed).toHaveBeenCalledWith('evt_rejected_safepay');
    expect(ledger.releaseClaim).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      received: true,
      handled: 'safepay_manual_review',
    });
  });

  it('keeps the event retryable if manual-review incident persistence fails', async () => {
    confirmPaidSession.mockResolvedValue({ ok: false, reason: 'amount_mismatch' });
    paymentLifecycle.recordRejectedSafePayPayment.mockRejectedValue(new Error('mongo is down'));
    mockStripeConstructing({
      id: 'evt_rejected_safepay',
      type: 'checkout.session.completed',
      data: { object: paidSafePaySession },
    });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(ledger.markProcessed).not.toHaveBeenCalled();
    expect(ledger.releaseClaim).toHaveBeenCalledWith('evt_rejected_safepay', expect.any(Error));
    expect(res.statusCode).toBe(500);
  });

  it('retries an unknown confirmation result instead of acknowledging it', async () => {
    confirmPaidSession.mockResolvedValue({ ok: false, reason: 'unexpected_result' });
    mockStripeConstructing({
      id: 'evt_unknown_safepay',
      type: 'checkout.session.completed',
      data: { object: paidSafePaySession },
    });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(paymentLifecycle.recordRejectedSafePayPayment).not.toHaveBeenCalled();
    expect(ledger.markProcessed).not.toHaveBeenCalled();
    expect(ledger.releaseClaim).toHaveBeenCalledWith('evt_unknown_safepay', expect.any(Error));
    expect(res.statusCode).toBe(500);
  });
});

describe('routing by session type', () => {
  it('acknowledges a legacy subscription checkout without provisioning it', async () => {
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

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, handled: 'subscription_rebuild_in_progress' });
    expect(confirmPaidSession).not.toHaveBeenCalled();
    expect(ledger.markProcessed).toHaveBeenCalledWith('evt_sub');
  });

  it('routes an extra-contact checkout to the extra-contact handler, never to SafePay', async () => {
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

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(res.statusCode).toBe(200);
    // No purchaseId in this metadata: the handler refuses it instead of confirming anything.
    expect(res.body).toEqual({ received: true, handled: 'extra_contact_invalid_metadata' });
    expect(confirmPaidSession).not.toHaveBeenCalled();
  });

  it.each([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
  ])('does not process a legacy subscription %s event', async (type) => {
    const session = {
      id: `cs_${type}`,
      mode: 'subscription',
      payment_status: 'paid',
      metadata: { userId: 'u1', type: 'subscription' },
    };
    mockStripeConstructing({
      id: `evt_${type}`,
      type,
      data: { object: session },
    });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, handled: 'subscription_rebuild_in_progress' });
    expect(confirmPaidSession).not.toHaveBeenCalled();
    expect(Order.updateOne).not.toHaveBeenCalled();
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

});

describe('legacy subscription webhook events', () => {
  it.each([
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ])('does not claim or reconcile %s', async (type) => {
    expect(ORDER_EVENT_TYPES.has(type)).toBe(true);
    mockStripeConstructing({ id: `evt_${type}`, type, data: { object: { id: 'sub_1' } } });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(ledger.claimEvent).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ received: true, handled: 'subscription_rebuild_in_progress' });
  });
});

describe('Subscription V2 webhook routing', () => {
  it('routes only V2-marked subscription checkout events to the V2 processor', async () => {
    const session = {
      id: 'cs_v2',
      mode: 'subscription',
      status: 'complete',
      payment_status: 'paid',
      metadata: { subscriptionV2: 'true', userId: 'u1', planId: 'p1', operationId: 'op1' },
    };
    mockStripeConstructing({
      id: 'evt_v2',
      type: 'checkout.session.completed',
      data: { object: session },
    });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(processVerifiedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt_v2' }),
      'test',
      expect.objectContaining({ webhooks: expect.any(Object) })
    );
    expect(res.body).toEqual({ received: true, handled: 'subscription_activated' });
    expect(confirmPaidSession).not.toHaveBeenCalled();
  });

  it('routes V2 invoice events while safely ignoring V1 invoice events', async () => {
    mockStripeConstructing({
      id: 'evt_invoice_v2',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_v2',
          parent: {
            subscription_details: {
              metadata: { subscriptionV2: 'true' },
            },
          },
        },
      },
    });
    await stripeWebhook(makeReq(), makeRes());
    expect(processVerifiedEvent).toHaveBeenCalledTimes(1);

    processVerifiedEvent.mockClear();
    mockStripeConstructing({
      id: 'evt_invoice_v1',
      type: 'invoice.paid',
      data: { object: { id: 'in_v1', parent: { subscription_details: { metadata: {} } } } },
    });
    const res = makeRes();
    await stripeWebhook(makeReq(), res);
    expect(processVerifiedEvent).not.toHaveBeenCalled();
    expect(res.body).toEqual({
      received: true,
      handled: 'subscription_rebuild_in_progress',
    });
  });

  it.each([
    'subscription_schedule.created',
    'subscription_schedule.updated',
    'subscription_schedule.canceled',
    'subscription_schedule.released',
    'subscription_schedule.aborted',
  ])('routes V2 %s events and ignores unmarked schedules', async (type) => {
    const schedule = {
      id: 'sub_sched_v2',
      metadata: { subscriptionV2: 'true' },
    };
    mockStripeConstructing({
      id: `evt_${type}_v2`,
      type,
      data: { object: schedule },
    });

    const v2Response = makeRes();
    await stripeWebhook(makeReq(), v2Response);
    expect(ORDER_EVENT_TYPES.has(type)).toBe(true);
    expect(processVerifiedEvent).toHaveBeenCalledTimes(1);

    processVerifiedEvent.mockClear();
    mockStripeConstructing({
      id: `evt_${type}_legacy`,
      type,
      data: { object: { id: 'sub_sched_legacy', metadata: {} } },
    });
    const legacyResponse = makeRes();
    await stripeWebhook(makeReq(), legacyResponse);
    if (type === 'subscription_schedule.created') {
      expect(processVerifiedEvent).toHaveBeenCalledTimes(1);
    } else {
      expect(processVerifiedEvent).not.toHaveBeenCalled();
      expect(legacyResponse.body).toEqual({
        received: true,
        handled: 'subscription_event_ignored',
      });
    }
  });
});

describe('SafePay event routing', () => {
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

  it('marks a failed delayed SafePay payment as failed, never as paid', async () => {
    Order.updateOne.mockResolvedValue({});
    mockStripeConstructing({
      id: 'evt_async_failed',
      type: 'checkout.session.async_payment_failed',
      data: { object: { id: 'cs_async', metadata: { type: 'safepay_payment', orderId: 'o1' } } },
    });

    await stripeWebhook(makeReq(), makeRes());

    expect(Order.updateOne).toHaveBeenCalledTimes(1);
    const [filter, update] = Order.updateOne.mock.calls[0];
    expect(filter).toEqual(expect.objectContaining({ checkoutSessionId: 'cs_async', paymentStatus: { $ne: 'paid' } }));
    expect(update).toEqual({ $set: { checkoutSessionStatus: 'failed' } });
    expect(JSON.stringify(update)).not.toMatch(/"paid"/);
  });

  it.each(['invoice.voided', 'invoice.updated'])(
    'acks %s for a V2 subscription invoice without processing it (no paid entitlement)',
    async (type) => {
      mockStripeConstructing({
        id: `evt_${type}`,
        type,
        data: { object: { id: 'in_g', status: 'void', parent: { subscription_details: { subscription: 'sub_g', metadata: { subscriptionV2: 'true' } } } } },
      });
      const res = makeRes();
      await stripeWebhook(makeReq(), res);
      expect(ledger.claimEvent).not.toHaveBeenCalled();
      expect(res.body).toEqual(expect.objectContaining({ ignored: true }));
    }
  );

  it('acks an event type it does not handle without claiming a ledger row', async () => {
    mockStripeConstructing({ id: 'evt_other', type: 'charge.succeeded', data: { object: {} } });

    const res = makeRes();
    await stripeWebhook(makeReq(), res);

    expect(ledger.claimEvent).not.toHaveBeenCalled();
    expect(res.body).toEqual(expect.objectContaining({ ignored: true }));
  });
});
