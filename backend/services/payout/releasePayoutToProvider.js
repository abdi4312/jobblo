/**
 * releasePayoutToProvider — single shared payout service.
 *
 * ALL release paths must call this and ONLY this to release funds:
 *  - SafePayCheckoutController.approveAndPayout   (customer approves)
 *  - disputesAdminController resolveDispute       (dispute release_to_provider)
 *
 * (safepayController.completeJobAndPayout was the legacy complete path. Removed in
 * F-32: it released funds without checking paymentStatus, order state or disputes.)
 *
 * Contract:
 *  - Returns { payout, transfer } on success.
 *  - Throws on fatal errors so callers can roll back their own DB writes.
 *  - Idempotent: a second call for the same orderId with a transferred Payout
 *    returns the existing Payout without creating a second transfer.
 */

const Payout  = require('../../models/Payout');
const User    = require('../../models/User');
const Payment = require('../../models/Payment');
const { getStripe } = require('../../config/stripe');
const mongoose = require('mongoose');

/**
 * The charge behind a PaymentIntent, for `source_transaction`.
 *
 * Accepts an id of either shape so a caller that already holds a charge id (or a future
 * Payment record that stores one) needs no special case. Returns null rather than
 * throwing: a transfer that cannot be tied to its charge is still worth attempting
 * against the platform balance, and losing the payout is worse than losing the linkage.
 */
async function resolveChargeId(stripe, paymentIntentId) {
  if (!paymentIntentId) return null;
  if (/^(ch|py)_/.test(paymentIntentId)) return paymentIntentId;

  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const charge = intent?.latest_charge;
    return typeof charge === 'string' ? charge : charge?.id || null;
  } catch (err) {
    console.error(
      'releasePayoutToProvider: could not resolve a charge for %s — transferring from balance instead: %s',
      paymentIntentId,
      err.message
    );
    return null;
  }
}

/**
 * @param {object} opts
 * @param {string|ObjectId} opts.orderId
 * @param {string|ObjectId} opts.providerId
 * @param {string|ObjectId} opts.customerId
 * @param {string|ObjectId} opts.serviceId
 * @param {number}          opts.grossAmount        — agreedPrice (NOK, integer øre-safe)
 * @param {number}          opts.platformFee        — Math.round(grossAmount * 0.03)
 * @param {string}          opts.releaseSource      — 'customer_approve' | 'legacy_complete' | 'dispute_release' | 'admin_override'
 * @param {string|ObjectId} opts.releasedBy         — userId who triggered the release
 * @param {string}         [opts.stripePaymentIntentId]
 * @param {string}         [opts.stripeCheckoutSessionId]
 * @param {string|ObjectId}[opts.safePayHistoryId]
 * @param {string|ObjectId}[opts.disputeId]
 * @param {mongoose.ClientSession} [opts.session]   — pass an open Mongoose session for transactional callers
 */
async function releasePayoutToProvider(opts) {
  const {
    orderId,
    providerId,
    customerId,
    serviceId,
    grossAmount,
    platformFee,
    releaseSource,
    releasedBy,
    stripePaymentIntentId,
    stripeCheckoutSessionId,
    safePayHistoryId,
    disputeId,
    session,
  } = opts;

  if (!orderId || !providerId || !customerId || !serviceId) {
    throw new Error('releasePayoutToProvider: orderId, providerId, customerId, serviceId are required');
  }
  if (typeof grossAmount !== 'number' || grossAmount <= 0) {
    throw new Error('releasePayoutToProvider: grossAmount must be a positive number');
  }
  if (!['customer_approve', 'legacy_complete', 'dispute_release', 'admin_override'].includes(releaseSource)) {
    throw new Error(`releasePayoutToProvider: unknown releaseSource "${releaseSource}"`);
  }

  const netProviderAmount = grossAmount - platformFee;
  const idempotencyKey = `payout_order_${String(orderId)}`;

  // ── 1. Idempotency check ────────────────────────────────────────────────────
  // If a Payout record for this order already exists, return it without
  // creating a second transfer. Protects against double-pay on retries.
  let payout = await Payout.findOne({ idempotencyKey });

  if (payout) {
    if (payout.status === 'transferred') {
      // Already paid — return existing record as success.
      return { payout, transfer: null, alreadyPaid: true };
    }
    if (payout.status === 'cancelled') {
      throw new Error(`Payout for order ${orderId} was cancelled and cannot be retried automatically.`);
    }
    // status is 'pending', 'released_internal', 'processing', or 'failed' — retry below.
  }

  // ── 2. Verify provider has a working Stripe Connect account ────────────────
  const provider = await User.findById(providerId).select(
    'stripeConnectAccountId payoutEnabled chargesEnabled detailsSubmitted payoutOnboardingStatus name email'
  );

  if (!provider) {
    throw new Error(`Provider user not found: ${providerId}`);
  }

  if (!provider.stripeConnectAccountId) {
    const err = new Error('PAYOUT_SETUP_REQUIRED: Provider has not connected a Stripe payout account.');
    err.code = 'PAYOUT_SETUP_REQUIRED';
    err.providerId = String(providerId);
    throw err;
  }

  if (!provider.payoutEnabled) {
    const err = new Error('PAYOUT_NOT_ENABLED: Provider\'s Stripe Connect account is not yet enabled for payouts.');
    err.code = 'PAYOUT_NOT_ENABLED';
    err.providerId = String(providerId);
    throw err;
  }

  // ── 3. Upsert Payout record ────────────────────────────────────────────────
  const saveOpts = session ? { session } : {};

  if (!payout) {
    payout = new Payout({
      orderId,
      providerId,
      customerId,
      serviceId,
      grossAmount,
      platformFee,
      taxAmount:         0,
      netProviderAmount,
      currency:          'NOK',
      releaseSource,
      releasedBy,
      stripePaymentIntentId:    stripePaymentIntentId || undefined,
      stripeCheckoutSessionId:  stripeCheckoutSessionId || undefined,
      stripeConnectAccountId:   provider.stripeConnectAccountId,
      safePayHistoryId:         safePayHistoryId || undefined,
      disputeId:                disputeId || undefined,
      idempotencyKey,
      status: 'pending',
    });
    await payout.save(saveOpts);
  }

  // Transition to released_internal (funds earmarked)
  if (payout.status === 'pending') {
    payout.transitionTo('released_internal');
    await payout.save(saveOpts);
  }

  // ── 4. Create Stripe transfer ──────────────────────────────────────────────
  payout.transitionTo('processing');
  await payout.save(saveOpts);

  const stripe = await getStripe();

  let transfer;
  try {
    const transferParams = {
      amount:      Math.round(netProviderAmount * 100), // Stripe uses øre/cents
      currency:    'nok',
      destination: provider.stripeConnectAccountId,
      metadata: {
        orderId:       String(orderId),
        providerId:    String(providerId),
        customerId:    String(customerId),
        releaseSource,
        payoutId:      String(payout._id),
      },
    };

    // Attach to the source charge for better reconciliation when available.
    //
    // `source_transaction` takes a CHARGE id, but the id carried through this system is
    // the PaymentIntent's — and Stripe rejects `pi_…` here with
    // "No such charge: 'pi_…'" (resource_missing). Every release therefore threw, the
    // caller reported "utbetalingen mislyktes midlertidig", and no provider was ever
    // actually paid. The PaymentIntent is resolved to its charge first; if that lookup
    // fails the parameter is simply omitted and the transfer draws on the platform's
    // available balance instead of failing outright.
    const chargeId = await resolveChargeId(stripe, stripePaymentIntentId);
    if (chargeId) {
      transferParams.source_transaction = chargeId;
    }

    transfer = await stripe.transfers.create(transferParams, {
      idempotencyKey: `transfer_${idempotencyKey}`,
    });
  } catch (stripeErr) {
    // Record failure without losing the Payout record (retryable)
    payout.transitionTo('failed', {
      failureReason: stripeErr.message || 'Stripe transfer failed',
      failureCode:   stripeErr.code   || 'stripe_error',
    });
    await payout.save(saveOpts);

    const err = new Error(`TRANSFER_FAILED: Stripe transfer failed — ${stripeErr.message}`);
    err.code         = 'TRANSFER_FAILED';
    err.stripeCode   = stripeErr.code;
    err.payoutId     = String(payout._id);
    err.retryable    = true;
    throw err;
  }

  // ── 5. Mark transfer as completed ─────────────────────────────────────────
  payout.transitionTo('transferred', {
    stripeTransferId:    transfer.id,
    transferInitiatedAt: new Date(),
  });
  await payout.save(saveOpts);

  // ── 6. Update Payment record status to 'released' if it exists ────────────
  await Payment.findOneAndUpdate(
    { orderId },
    { $set: { status: 'released' } }
  );

  return { payout, transfer, alreadyPaid: false };
}

module.exports = releasePayoutToProvider;
