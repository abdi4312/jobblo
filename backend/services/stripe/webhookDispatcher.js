const { getStripeConfiguration, getStripeForMode } = require('../../config/stripe');
const {
  recordVerifiedDelivery,
  recordDeliveryProblem,
} = require('./webhookReadiness');
const { claimEvent, markProcessed, releaseClaim } = require('./eventLedger');
const { logApplicationError } = require('../../utils/errorLogger');
const {
  provisionSubscriptionFromSession,
  provisionExtraContactFromSession,
  applyInvoicePaid,
  applyInvoicePaymentFailed,
  applySubscriptionUpdated,
  applySubscriptionDeleted,
} = require('./provisioning');

/**
 * The single verified ingress for Stripe events.
 *
 * There is one endpoint, not one per purchase type: a second endpoint would mean a
 * second raw-body mount, a second signing secret, a second dashboard registration
 * and a second thing to forget. This dispatches on the session's mode and on the
 * metadata we set ourselves when creating the session — never on anything the
 * client supplied.
 *
 * Mounted in app.js with express.raw BEFORE express.json(), because signature
 * verification needs the untouched body, and before the rate limiter, because
 * throttling Stripe's retry storm loses captured payments.
 */

const ORDER_EVENT_TYPES = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'transfer.created',
  'transfer.updated',
  'transfer.reversed',
  'payout.created',
  'payout.updated',
  'payout.paid',
  'payout.failed',
  'payout.canceled',
]);

/** Log a payment failure where an admin will actually see it, without leaking secrets. */
async function logPaymentFailure({ req, error, httpStatus, errorCode, metadata }) {
  await logApplicationError({
    error,
    requestPath: req.originalUrl || '/api/stripe/webhook',
    httpMethod: 'POST',
    httpStatus,
    ip: req.ip,
    userAgent: req.headers?.['user-agent'],
    // Required: the logger drops 4xx entries that carry no errorCode, and the
    // signature failure below is a 400 — the single most security-relevant event
    // this file can produce.
    errorCode,
    source: 'stripe_webhook',
    metadata,
  });
}

/**
 * Route one verified event. Throwing from here releases the claim and returns 500,
 * which is what asks Stripe to retry — so throw for transient faults, and return
 * normally for anything a retry cannot fix.
 */
async function handleEvent(event, { io } = {}) {
  // Required lazily: SafePayCheckoutController requires this module's siblings, and
  // a top-level import would close the cycle.
  const { confirmPaidSession } = require('../../controllers/SafePayCheckoutController');
  const Order = require('../../models/Order');
  const {
    recordStripeTransfer,
    recordStripeBankPayout,
  } = require('./financialHistory');

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const isMembership =
        session.mode === 'subscription' || session.metadata?.type === 'subscription';
      if (
        session.payment_status !== 'paid' &&
        !(isMembership && session.payment_status === 'no_payment_required')
      ) {
        return { handled: 'ignored_unpaid' };
      }

      const type = session.metadata?.type;

      if (isMembership) {
        const result = await provisionSubscriptionFromSession(session);
        if (!result.ok) throw new Error('Subscription checkout provisioning rejected');
        return { handled: 'subscription', result };
      }
      if (type === 'extra_contact') {
        const result = await provisionExtraContactFromSession(session);
        if (!result.ok) throw new Error('Extra-contact checkout provisioning rejected');
        return {
          handled: 'extra_contact',
          result,
        };
      }
      // Default is SafePay: the original behaviour of this endpoint, and the only
      // type whose sessions predate the metadata convention.
      const confirmation = await confirmPaidSession(session, io);
      if (!confirmation.ok) throw new Error('SafePay checkout confirmation rejected');
      return { handled: 'safepay', result: confirmation };
    }

    case 'checkout.session.async_payment_succeeded': {
      const confirmation = await confirmPaidSession(event.data.object, io);
      if (!confirmation.ok) throw new Error('SafePay checkout confirmation rejected');
      return { handled: 'safepay_async_payment_succeeded', result: confirmation };
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object;
      await Order.updateOne(
        { checkoutSessionId: session.id, paymentStatus: { $ne: 'paid' } },
        { $set: { checkoutSessionStatus: 'failed' } }
      );
      return { handled: 'safepay_async_payment_failed' };
    }

    case 'checkout.session.expired':
      // Clear the stale session so createSafePaySession stops trying to reuse it.
      await Order.updateOne(
        { checkoutSessionId: event.data.object.id },
        { $set: { checkoutSessionStatus: 'expired' } }
      );
      return { handled: 'session_expired' };

    case 'invoice.paid':
      return { handled: 'invoice_paid', result: await applyInvoicePaid(event.data.object) };

    case 'invoice.payment_failed':
      return {
        handled: 'invoice_failed',
        result: await applyInvoicePaymentFailed(event.data.object),
      };

    case 'customer.subscription.updated':
      return {
        handled: 'subscription_updated',
        result: await applySubscriptionUpdated(event.data.object),
      };

    case 'customer.subscription.deleted':
      return {
        handled: 'subscription_deleted',
        result: await applySubscriptionDeleted(event.data.object),
      };

    case 'transfer.created':
    case 'transfer.updated':
    case 'transfer.reversed':
      await recordStripeTransfer(event.data.object, {
        livemode: event.livemode,
        event,
      });
      return { handled: 'stripe_transfer' };

    case 'payout.created':
    case 'payout.updated':
    case 'payout.paid':
    case 'payout.failed':
    case 'payout.canceled':
      if (!event.account) return { handled: 'ignored_platform_bank_payout' };
      await recordStripeBankPayout(event.data.object, {
        stripeAccountId: event.account,
        livemode: event.livemode,
        event,
      });
      return { handled: 'stripe_connected_bank_payout' };

    default:
      return { handled: 'ignored_type' };
  }
}

/** Express handler. Requires req.body to be a raw Buffer. */
async function stripeWebhook(req, res) {
  let event;
  let stripeConfig;
  let stripe;

  try {
    stripeConfig = await getStripeConfiguration();
  } catch (err) {
    await logPaymentFailure({
      req,
      error: new Error('Stripe mode configuration unavailable'),
      httpStatus: 503,
      errorCode: 'STRIPE_MODE_CONFIGURATION_UNAVAILABLE',
      metadata: {},
    });
    return res.status(503).send('Webhook configuration unavailable');
  }

  if (!stripeConfig.secretKey || !stripeConfig.keyModeValid || !stripeConfig.webhookSecretValid) {
    const configurationCode = !stripeConfig.webhookSecret
      ? 'STRIPE_WEBHOOK_SECRET_MISSING'
      : 'STRIPE_WEBHOOK_CONFIGURATION_INVALID';
    await logPaymentFailure({
      req,
      error: new Error(configurationCode),
      httpStatus: 503,
      errorCode: configurationCode,
      metadata: {},
    });
    return res.status(503).send('Webhook configuration unavailable');
  }

  try {
    stripe = await getStripeForMode(stripeConfig.testMode);
  } catch (_err) {
    return res.status(503).send('Webhook configuration unavailable');
  }

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      stripeConfig.webhookSecret
    );
  } catch (err) {
    // Signature mismatch or malformed payload — never process it.
    await logPaymentFailure({
      req,
      error: err,
      httpStatus: 400,
      errorCode: 'STRIPE_WEBHOOK_SIGNATURE_FAILED',
      metadata: {},
    });
    return res.status(400).send('Webhook signature verification failed');
  }

  if (
    typeof event.livemode !== 'boolean' ||
    event.livemode !== (stripeConfig.mode === 'live')
  ) {
    await logPaymentFailure({
      req,
      error: new Error('Stripe event mode does not match the active mode'),
      httpStatus: 400,
      errorCode: 'STRIPE_WEBHOOK_MODE_MISMATCH',
      metadata: { eventId: event.id, eventType: event.type },
    });
    return res.status(400).send('Webhook event mode mismatch');
  }

  // Only claim ledger rows for events we actually act on, so an account-wide event
  // firehose does not fill the collection.
  if (!ORDER_EVENT_TYPES.has(event.type)) {
    try {
      await recordVerifiedDelivery(stripeConfig, event.id);
    } catch (_err) {
      return res.status(500).send('Webhook health update failed');
    }
    return res.json({ received: true, ignored: true });
  }

  const claim = await claimEvent(event);
  if (!claim.claimed) {
    if (claim.reason === 'duplicate') {
      await recordVerifiedDelivery(stripeConfig, event.id);
      return res.json({ received: true, duplicate: true, reason: claim.reason });
    }
    return res.status(503).send('Webhook event is still being processed');
  }

  try {
    const outcome = await handleEvent(event, { io: req.app?.get('io') });
    await markProcessed(event.id);
    await recordVerifiedDelivery(stripeConfig, event.id);
    return res.json({ received: true, handled: outcome.handled });
  } catch (err) {
    // Release first: a claim left behind would make Stripe's retry look like a
    // duplicate and the payment would be lost for good.
    await releaseClaim(event.id, err);
    try {
      await recordDeliveryProblem(stripeConfig, event.id, 'verified_event_processing_failed');
    } catch (_healthErr) {
      // The webhook request already returns 500; a later verified delivery repairs
      // readiness once the health store is available again.
    }
    await logPaymentFailure({
      req,
      error: err,
      httpStatus: 500,
      errorCode: 'STRIPE_WEBHOOK_HANDLER_FAILED',
      metadata: { eventId: event.id, eventType: event.type, objectId: event.data?.object?.id },
    });
    // 500 asks Stripe to retry — correct for transient database failures.
    return res.status(500).send('Webhook handler failed');
  }
}

module.exports = { stripeWebhook, handleEvent, ORDER_EVENT_TYPES };
