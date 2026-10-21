const { getStripeConfiguration, getStripeForMode } = require('../../config/stripe');
const {
  recordVerifiedDelivery,
  recordDeliveryProblem,
} = require('./webhookReadiness');
const { claimEvent, markProcessed, releaseClaim } = require('./eventLedger');
const { logApplicationError } = require('../../utils/errorLogger');
const {
  recordStripePaymentLifecycle,
  recordRejectedSafePayPayment,
} = require('./paymentLifecycle');

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
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'subscription_schedule.created',
  'subscription_schedule.updated',
  'subscription_schedule.canceled',
  'subscription_schedule.released',
  'subscription_schedule.aborted',
  'transfer.created',
  'transfer.updated',
  'transfer.reversed',
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.funds_reinstated',
  'charge.refunded',
  'charge.refund.updated',
  'refund.created',
  'refund.updated',
  'refund.failed',
  'payout.created',
  'payout.updated',
  'payout.paid',
  'payout.failed',
  'payout.canceled',
]);

const PERMANENT_SAFEPAY_REJECTION_REASONS = new Set([
  'missing_order_metadata',
  'order_not_found',
  'session_customer_mismatch',
  'session_details_mismatch',
  'session_mode_missing',
  'stripe_mode_mismatch',
  'amount_mismatch',
  'currency_mismatch',
  'customer_mismatch',
  'checkout_attempt_mismatch',
  'checkout_session_mismatch',
  'payment_intent_mismatch',
  'charge_missing',
  'charge_mismatch',
  'duplicate_successful_payment',
  'order_state_conflict',
]);

function isLegacySubscriptionSession(session) {
  return (
    session?.mode === 'subscription' ||
    session?.metadata?.type === 'subscription'
  );
}

/** Paid extra contact (services/subscriptions/v2ExtraContacts.js). */
function isExtraContactSession(session) {
  return session?.metadata?.type === 'extra_contact';
}

function isV2SubscriptionEvent(event) {
  const object = event?.data?.object;
  if (event?.type === 'subscription_schedule.created') return true;
  if (event?.type?.startsWith('checkout.session.')) {
    return object?.mode === 'subscription' && object?.metadata?.subscriptionV2 === 'true';
  }
  if (event?.type?.startsWith('customer.subscription.')) {
    return object?.metadata?.subscriptionV2 === 'true';
  }
  if (event?.type?.startsWith('subscription_schedule.')) {
    return object?.metadata?.subscriptionV2 === 'true';
  }
  if (
    event?.type === 'invoice.paid' ||
    event?.type === 'invoice.payment_failed' ||
    event?.type === 'invoice.payment_action_required'
  ) {
    return object?.parent?.subscription_details?.metadata?.subscriptionV2 === 'true';
  }
  return false;
}

async function handleV2SubscriptionEvent(event, stripe) {
  const { processVerifiedEvent } = require('../subscriptions/v2WebhookProcessor');
  const mode = event.livemode ? 'live' : 'test';
  return processVerifiedEvent(event, mode, stripe);
}

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
async function handleEvent(event, { io, stripe } = {}) {
  // Required lazily: SafePayCheckoutController requires this module's siblings, and
  // a top-level import would close the cycle.
  const { confirmPaidSession } = require('../../controllers/SafePayCheckoutController');
  const Order = require('../../models/Order');
  const {
    recordStripeTransfer,
    recordStripeBankPayout,
  } = require('./financialHistory');
  const confirmSafePay = async (session) => {
    const confirmation = await confirmPaidSession(session, io);
    if (confirmation.ok) return { handled: 'safepay', result: confirmation };
    if (!PERMANENT_SAFEPAY_REJECTION_REASONS.has(confirmation.reason)) {
      throw new Error('SafePay checkout confirmation returned an unknown result');
    }
    await recordRejectedSafePayPayment({ event, session, reason: confirmation.reason });
    return { handled: 'safepay_manual_review' };
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (isV2SubscriptionEvent(event)) {
        const result = await handleV2SubscriptionEvent(event, stripe);
        return result;
      }
      if (isExtraContactSession(session)) {
        return require('../subscriptions/v2ExtraContacts').confirmExtraContactSession(session);
      }
      if (isLegacySubscriptionSession(session)) {
        return { handled: 'subscription_rebuild_in_progress' };
      }
      if (session.payment_status !== 'paid') {
        return { handled: 'ignored_unpaid' };
      }

      // Default is SafePay: the original behaviour of this endpoint, and the only
      // type whose sessions predate the metadata convention.
      return confirmSafePay(session);
    }

    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object;
      if (isV2SubscriptionEvent(event)) {
        return handleV2SubscriptionEvent(event, stripe);
      }
      if (isExtraContactSession(session)) {
        return require('../subscriptions/v2ExtraContacts').confirmExtraContactSession(session);
      }
      if (isLegacySubscriptionSession(session)) {
        return { handled: 'subscription_rebuild_in_progress' };
      }
      const outcome = await confirmSafePay(session);
      return outcome.handled === 'safepay'
        ? { ...outcome, handled: 'safepay_async_payment_succeeded' }
        : outcome;
    }

    case 'checkout.session.async_payment_failed': {
      const session = event.data.object;
      if (isV2SubscriptionEvent(event)) {
        return handleV2SubscriptionEvent(event, stripe);
      }
      if (isExtraContactSession(session)) {
        return require('../subscriptions/v2ExtraContacts').expireExtraContactSession(session);
      }
      if (isLegacySubscriptionSession(session)) {
        return { handled: 'subscription_rebuild_in_progress' };
      }
      await Order.updateOne(
        { checkoutSessionId: session.id, paymentStatus: { $ne: 'paid' } },
        { $set: { checkoutSessionStatus: 'failed' } }
      );
      return { handled: 'safepay_async_payment_failed' };
    }

    case 'checkout.session.expired':
      if (isV2SubscriptionEvent(event)) {
        return handleV2SubscriptionEvent(event, stripe);
      }
      if (isExtraContactSession(event.data.object)) {
        return require('../subscriptions/v2ExtraContacts').expireExtraContactSession(event.data.object);
      }
      if (isLegacySubscriptionSession(event.data.object)) {
        return { handled: 'subscription_rebuild_in_progress' };
      }
      // Clear the stale session so createSafePaySession stops trying to reuse it.
      await Order.updateOne(
        { checkoutSessionId: event.data.object.id },
        { $set: { checkoutSessionStatus: 'expired' } }
      );
      return { handled: 'session_expired' };

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.payment_action_required':
      if (isV2SubscriptionEvent(event)) {
        return handleV2SubscriptionEvent(event, stripe);
      }
      return { handled: 'subscription_rebuild_in_progress' };

    case 'subscription_schedule.created':
      if (isV2SubscriptionEvent(event)) {
        return handleV2SubscriptionEvent(event, stripe);
      }
      return { handled: 'subscription_event_ignored' };

    case 'subscription_schedule.updated':
    case 'subscription_schedule.canceled':
    case 'subscription_schedule.released':
    case 'subscription_schedule.aborted':
      if (isV2SubscriptionEvent(event)) {
        return handleV2SubscriptionEvent(event, stripe);
      }
      return { handled: 'subscription_event_ignored' };

    case 'charge.dispute.created':
    case 'charge.dispute.updated':
    case 'charge.dispute.funds_withdrawn':
    case 'charge.dispute.funds_reinstated':
    case 'charge.dispute.closed':
    case 'charge.refunded':
    case 'charge.refund.updated':
    case 'refund.created':
    case 'refund.updated':
    case 'refund.failed':
      await recordStripePaymentLifecycle(event);
      return { handled: 'stripe_payment_incident' };

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
    const outcome = await handleEvent(event, { io: req.app?.get('io'), stripe });
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
