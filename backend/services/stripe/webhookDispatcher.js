const { getStripe, getStripeWebhookSecret } = require('../../config/stripe');
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
  'checkout.session.expired',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
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
        return { handled: 'subscription', result: await provisionSubscriptionFromSession(session) };
      }
      if (type === 'extra_contact') {
        return {
          handled: 'extra_contact',
          result: await provisionExtraContactFromSession(session),
        };
      }
      // Default is SafePay: the original behaviour of this endpoint, and the only
      // type whose sessions predate the metadata convention.
      return { handled: 'safepay', result: await confirmPaidSession(session, io) };
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

    default:
      return { handled: 'ignored_type' };
  }
}

/** Express handler. Requires req.body to be a raw Buffer. */
async function stripeWebhook(req, res) {
  let event;

  try {
    const stripe = await getStripe();
    const webhookSecret = await getStripeWebhookSecret();

    if (!webhookSecret) {
      const err = new Error(
        'Stripe webhook secret is not configured for the active mode — event rejected'
      );
      console.error(err.message);
      await logPaymentFailure({
        req,
        error: err,
        httpStatus: 500,
        errorCode: 'STRIPE_WEBHOOK_NOT_CONFIGURED',
        metadata: {},
      });
      return res.status(500).send('Webhook secret not configured');
    }

    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      webhookSecret
    );
  } catch (err) {
    // Signature mismatch or malformed payload — never process it. 400 tells Stripe
    // not to retry, which is correct: a bad signature will still be bad next time.
    console.error('Stripe webhook signature verification failed:', err.message);
    await logPaymentFailure({
      req,
      error: err,
      httpStatus: 400,
      errorCode: 'STRIPE_WEBHOOK_SIGNATURE_FAILED',
      metadata: {},
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Only claim ledger rows for events we actually act on, so an account-wide event
  // firehose does not fill the collection.
  if (!ORDER_EVENT_TYPES.has(event.type)) {
    return res.json({ received: true, ignored: true });
  }

  const claim = await claimEvent(event);
  if (!claim.claimed) {
    // Already done, or in flight elsewhere. Either way Stripe should stop asking.
    return res.json({ received: true, duplicate: true, reason: claim.reason });
  }

  try {
    const outcome = await handleEvent(event, { io: req.app?.get('io') });
    await markProcessed(event.id);
    return res.json({ received: true, handled: outcome.handled });
  } catch (err) {
    // Release first: a claim left behind would make Stripe's retry look like a
    // duplicate and the payment would be lost for good.
    await releaseClaim(event.id, err);
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
