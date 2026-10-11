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
const Order = require('../../models/Order');
const Dispute = require('../../models/Dispute');
const StripePaymentIncident = require('../../models/StripePaymentIncident');
const { getStripeForMode } = require('../../config/stripe');
const mongoose = require('mongoose');
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

function payoutError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function idOf(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

async function verifiedSourceCharge({
  stripe,
  order,
  payment,
  sessionId,
  paymentIntentId,
  maxTransferMinor,
}) {
  if (
    !payment ||
    !['completed', 'released'].includes(payment.status) ||
    !payment.stripeSessionId ||
    !payment.stripePaymentIntentId ||
    payment.stripeSessionId !== sessionId ||
    payment.stripePaymentIntentId !== paymentIntentId ||
    !['paid', 'released'].includes(order.paymentStatus) ||
    order.checkoutSessionId !== sessionId ||
    order.paymentIntentId !== paymentIntentId
  ) {
    throw payoutError('PAYOUT_SOURCE_PAYMENT_UNVERIFIED', 'Confirmed SafePay payment is required.');
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const expectedMode = order.checkoutMode;
  const expectedCustomer = order.checkoutCustomerId;
  const expectedMinor = order.checkoutAmountMinor;
  if (
    !['test', 'live'].includes(expectedMode) ||
    typeof session.livemode !== 'boolean' ||
    session.livemode !== (expectedMode === 'live') ||
    session.id !== sessionId ||
    session.mode !== 'payment' ||
    session.status !== 'complete' ||
    session.payment_status !== 'paid' ||
    idOf(session.payment_intent) !== paymentIntentId ||
    !expectedCustomer ||
    idOf(session.customer) !== expectedCustomer ||
    !Number.isSafeInteger(expectedMinor) ||
    session.amount_total !== expectedMinor ||
    session.currency?.toLowerCase() !== (order.checkoutCurrency || 'nok').toLowerCase() ||
    (payment.stripeLivemode !== null &&
      payment.stripeLivemode !== undefined &&
      payment.stripeLivemode !== session.livemode)
  ) {
    throw payoutError('PAYOUT_SOURCE_PAYMENT_MISMATCH', 'SafePay checkout does not match the order.');
  }

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
  const chargeId = idOf(intent.latest_charge);
  if (
    intent.id !== paymentIntentId ||
    intent.status !== 'succeeded' ||
    intent.amount_received !== expectedMinor ||
    intent.currency?.toLowerCase() !== session.currency.toLowerCase() ||
    idOf(intent.customer) !== expectedCustomer ||
    !chargeId
  ) {
    throw payoutError('PAYOUT_SOURCE_PAYMENT_INTENT_INVALID', 'PaymentIntent is not a matching captured payment.');
  }

  const charge = await stripe.charges.retrieve(chargeId);
  if (
    charge.id !== chargeId ||
    charge.paid !== true ||
    charge.captured !== true ||
    charge.amount !== expectedMinor ||
    charge.currency?.toLowerCase() !== session.currency.toLowerCase() ||
    idOf(charge.payment_intent) !== paymentIntentId ||
    idOf(charge.customer) !== expectedCustomer ||
    !Number.isSafeInteger(Number(charge.amount_refunded || 0)) ||
    Number(charge.amount_refunded || 0) < 0 ||
    Number(charge.amount_refunded || 0) > charge.amount ||
    charge.amount - Number(charge.amount_refunded || 0) < maxTransferMinor ||
    charge.disputed === true
  ) {
    throw payoutError('PAYOUT_SOURCE_CHARGE_INVALID', 'Source charge is refunded, disputed, or mismatched.');
  }
  return { chargeId, livemode: session.livemode };
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

  if (
    !Number.isSafeInteger(Math.round(grossAmount * 100)) ||
    !Number.isSafeInteger(Math.round(platformFee * 100)) ||
    platformFee < 0 ||
    platformFee >= grossAmount
  ) {
    throw payoutError('PAYOUT_AMOUNT_INVALID', 'Payout amount or platform fee is invalid.');
  }
  const netProviderAmount = grossAmount - platformFee;
  const idempotencyKey = `payout_order_${String(orderId)}`;
  const [order, payment] = await Promise.all([
    Order.findById(orderId).lean(),
    Payment.findOne({ orderId }).lean(),
  ]);
  if (
    !order ||
    String(order.providerId) !== String(providerId) ||
    String(order.customerId) !== String(customerId) ||
    String(order.serviceId) !== String(serviceId) ||
    !['ready_for_review', 'completed', 'disputed'].includes(order.status) ||
    !['paid', 'released'].includes(order.paymentStatus) ||
    grossAmount > Number(order.agreedPrice)
  ) {
    throw payoutError('PAYOUT_ORDER_INVALID', 'Order does not authorize this payout.');
  }
  const stripeChargeback = await StripePaymentIncident.findOne({
    orderId,
    kind: 'charge_dispute',
    status: 'manual_review',
  }).select('_id').lean();
  if (stripeChargeback) {
    throw payoutError('PAYOUT_STRIPE_CHARGEBACK_ACTIVE', 'Payout is blocked while a Stripe chargeback requires review.');
  }

  let dispute;
  if (releaseSource === 'dispute_release') {
    dispute = await Dispute.findById(disputeId).lean();
    if (
      !dispute ||
      String(dispute.orderId) !== String(orderId) ||
      !['open', 'under_review', 'waiting_for_customer', 'waiting_for_provider', 'evidence_submitted'].includes(dispute.status) ||
      !['release_to_provider', 'partial_refund', 'split_payment'].includes(dispute.resolution?.outcome) ||
      !['pending', 'failed'].includes(dispute.resolution?.moneyState) ||
      dispute.resolution.providerAmount !== grossAmount
    ) {
      throw payoutError('PAYOUT_DISPUTE_NOT_AUTHORIZED', 'Approved dispute resolution is required.');
    }
  } else {
    if (!['ready_for_review', 'completed'].includes(order.status)) {
      throw payoutError('PAYOUT_ORDER_NOT_APPROVED', 'Completed work is required before payout.');
    }
    const activeDispute = await Dispute.findOne({
      orderId,
      status: { $nin: ['resolved', 'closed', 'cancelled'] },
    }).select('_id').lean();
    if (activeDispute) {
      throw payoutError('PAYOUT_DISPUTE_ACTIVE', 'Payout is blocked while a dispute is active.');
    }
  }

  const storedMode = order.checkoutMode;
  if (!['test', 'live'].includes(storedMode)) {
    throw payoutError('PAYOUT_MODE_UNKNOWN', 'Payment mode is missing; manual reconciliation is required.');
  }
  if (
    (payment?.stripeLivemode !== null &&
      payment?.stripeLivemode !== undefined &&
      payment.stripeLivemode !== (storedMode === 'live')) ||
    (order.checkoutSessionId && stripeCheckoutSessionId !== order.checkoutSessionId) ||
    (order.paymentIntentId && stripePaymentIntentId !== order.paymentIntentId)
  ) {
    throw payoutError('PAYOUT_MODE_MISMATCH', 'Payment identifiers do not match the confirmed order.');
  }
  const stripe = await getStripeForMode(storedMode === 'test');
  let source;
  try {
    source = await verifiedSourceCharge({
      stripe,
      order,
      payment,
      sessionId: stripeCheckoutSessionId,
      paymentIntentId: stripePaymentIntentId,
      maxTransferMinor: Math.round(netProviderAmount * 100),
    });
  } catch (error) {
    const existing = await Payout.findOne({ orderId });
    if (existing?.status !== 'transferred') {
      await Payout.updateOne(
        { orderId, status: { $ne: 'transferred' } },
        {
          $set: {
            orderId,
            providerId,
            customerId,
            serviceId,
            grossAmount,
            platformFee,
            netProviderAmount,
            currency: 'NOK',
            stripePaymentIntentId,
            stripeCheckoutSessionId,
            stripeLivemode: storedMode === 'live',
            status: 'reconciliation_required',
            failureCode: error.code || 'PAYOUT_SOURCE_VERIFICATION_FAILED',
            failureReason: 'Source payment verification failed; no transfer was attempted.',
            idempotencyKey,
          },
          $setOnInsert: { releaseSource, releasedBy, disputeId },
        },
        { upsert: !existing }
      );
    }
    throw error;
  }

  // ── 1. Idempotency check ────────────────────────────────────────────────────
  // If a Payout record for this order already exists, return it without
  // creating a second transfer. Protects against double-pay on retries.
  let payout = await Payout.findOne({ idempotencyKey });

  if (payout) {
    if (payout.status === 'transferred') {
      // Already paid — return existing record as success.
      return { payout, transfer: null, alreadyPaid: true };
    }
    if (payout.status === 'processing') {
      const attemptedAt = payout.lastAttemptedAt ? new Date(payout.lastAttemptedAt).getTime() : NaN;
      if (Number.isFinite(attemptedAt) && Date.now() - attemptedAt < PROCESSING_LEASE_MS) {
        throw payoutError('PAYOUT_PROCESSING', 'Payout is already being processed.');
      }
    }
    if (payout.status === 'cancelled') {
      throw new Error(`Payout for order ${orderId} was cancelled and cannot be retried automatically.`);
    }
    if (
      payout.stripeLivemode !== null &&
      payout.stripeLivemode !== undefined &&
      payout.stripeLivemode !== source.livemode
    ) {
      const err = new Error('PAYOUT_MODE_MISMATCH: Existing payout belongs to another Stripe mode.');
      err.code = 'PAYOUT_MODE_MISMATCH';
      throw err;
    }
    if (
      payout.stripeLivemode === null &&
      (payout.stripeTransferId || ['processing', 'failed', 'transferred'].includes(payout.status))
    ) {
      const err = new Error('PAYOUT_MODE_UNKNOWN: Existing payout requires financial review.');
      err.code = 'PAYOUT_MODE_UNKNOWN';
      throw err;
    }
    // Only a known non-completed attempt can be acquired below.
  }

  // ── 2. Verify provider has a working Stripe Connect account ────────────────
  const testMode = !source.livemode;
  const connectAccountField = testMode
    ? 'stripeConnectAccountIdTest'
    : 'stripeConnectAccountId';
  const provider = await User.findById(providerId).select(
    `stripeConnectAccountId stripeConnectAccountIdTest payoutEnabled chargesEnabled detailsSubmitted payoutOnboardingStatus name email`
  );

  if (!provider) {
    throw payoutError('PAYOUT_PROVIDER_NOT_FOUND', 'Provider user was not found.');
  }

  const stripeConnectAccountId = provider[connectAccountField];
  if (!stripeConnectAccountId) {
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
      stripeConnectAccountId,
      stripeLivemode: source.livemode,
      safePayHistoryId:         safePayHistoryId || undefined,
      disputeId:                disputeId || undefined,
      idempotencyKey,
      status: 'pending',
    });
    try {
      await payout.save(saveOpts);
    } catch (error) {
      if (error?.code !== 11000) throw error;
      payout = await Payout.findOne({ orderId });
      if (!payout) throw error;
    }
  } else if (payout.status === 'pending' || payout.status === 'released_internal') {
    payout.stripeConnectAccountId = stripeConnectAccountId;
    payout.stripeLivemode = source.livemode;
    await payout.save(saveOpts);
  }

  const priorStatus = payout.status;
  const recoveringUnknownAttempt =
    priorStatus === 'processing' || priorStatus === 'reconciliation_required';
  if (recoveringUnknownAttempt) {
    const claimed = await Payout.findOneAndUpdate(
      {
        _id: payout._id,
        status: 'processing',
        lastAttemptedAt: payout.lastAttemptedAt,
      },
      {
        $set: { lastAttemptedAt: new Date() },
        $inc: { retryCount: 1 },
      },
      { new: true, ...saveOpts }
    );
    if (!claimed) {
      throw payoutError('PAYOUT_PROCESSING', 'Payout is already being reconciled.');
    }
    payout = claimed;
  }
  if (recoveringUnknownAttempt) {
    // The previous Stripe request may have succeeded even if its response or the
    // MongoDB write was lost. Never issue a second transfer until Stripe is checked.
    let startingAfter;
    let recovered;
    let hasMore = true;
    while (hasMore && !recovered) {
      const page = await stripe.transfers.list({
        destination: stripeConnectAccountId,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      recovered = (page.data || []).find(
        (candidate) => candidate.metadata?.payoutId === String(payout._id)
      );
      hasMore = Boolean(page.has_more);
      startingAfter = page.data?.[page.data.length - 1]?.id;
      if (hasMore && !startingAfter) {
        payout.failureCode = 'PAYOUT_TRANSFER_LOOKUP_INCOMPLETE';
        payout.failureReason = 'Stripe transfer history could not be fully checked.';
        await payout.save(saveOpts);
        throw payoutError('PAYOUT_RECONCILIATION_REQUIRED', 'Stripe transfer history could not be fully checked.');
      }
    }
    if (!recovered) {
      payout.status = 'reconciliation_required';
      payout.failureCode = 'PAYOUT_TRANSFER_NOT_FOUND';
      payout.failureReason = 'A previous transfer attempt is unresolved; no automatic retry was made.';
      await payout.save(saveOpts);
      throw payoutError('PAYOUT_RECONCILIATION_REQUIRED', 'Previous Stripe transfer attempt requires manual reconciliation.');
    }
    if (
      idOf(recovered.destination) !== stripeConnectAccountId ||
      idOf(recovered.source_transaction) !== source.chargeId ||
      recovered.amount !== Math.round(netProviderAmount * 100) ||
      recovered.currency?.toLowerCase() !== 'nok' ||
      recovered.livemode !== source.livemode
    ) {
      payout.status = 'reconciliation_required';
      payout.failureCode = 'PAYOUT_TRANSFER_MISMATCH';
      payout.failureReason = 'A transfer exists but does not match the authorized payout.';
      await payout.save(saveOpts);
      throw payoutError('PAYOUT_TRANSFER_MISMATCH', 'Existing Stripe transfer requires manual review.');
    }
    payout.status = 'transferred';
    payout.stripeTransferId = recovered.id;
    payout.transferInitiatedAt ||= new Date();
    payout.transferCompletedAt ||= new Date();
    payout.failureCode = null;
    payout.failureReason = null;
    await payout.save(saveOpts);
    await Payment.findOneAndUpdate({ orderId }, { $set: { status: 'released' } });
    try {
      const { recordStripeTransfer } = require('../stripe/financialHistory');
      await recordStripeTransfer(recovered, {
        livemode: source.livemode,
        source: 'reconciliation',
      });
    } catch (error) {
      console.error(
        'releasePayoutToProvider: recovered transfer history sync failed for payout %s: %s',
        String(payout._id),
        error.code || error.name || 'financial_history_sync_failed'
      );
    }
    return { payout, transfer: recovered, alreadyPaid: false, reconciled: true };
  } else {
  payout = await Payout.findOneAndUpdate(
    {
      _id: payout._id,
      status: { $in: ['pending', 'released_internal', 'failed'] },
      ...(payout.stripeLivemode === null || payout.stripeLivemode === undefined
        ? {}
        : { stripeLivemode: source.livemode }),
    },
    {
      $set: {
        status: 'processing',
        stripeConnectAccountId,
        stripeLivemode: source.livemode,
        lastAttemptedAt: new Date(),
        failureReason: null,
        failureCode: null,
      },
      $inc: { retryCount: 1 },
    },
    { new: true, ...saveOpts }
  );
  if (!payout) {
    throw payoutError('PAYOUT_PROCESSING', 'Payout is already being processed.');
  }
  }

  // ── 4. Create Stripe transfer ──────────────────────────────────────────────
  let account;
  try {
    account = await stripe.accounts.retrieve(stripeConnectAccountId);
  } catch (_error) {
    payout.status = 'failed';
    payout.failureCode = 'PAYOUT_CONNECT_ACCOUNT_LOOKUP_FAILED';
    payout.failureReason = 'Could not verify provider Connect account before transfer.';
    await payout.save(saveOpts);
    throw payoutError('PAYOUT_CONNECT_ACCOUNT_LOOKUP_FAILED', 'Provider payout account could not be verified.');
  }
  if (
    account.id !== stripeConnectAccountId ||
    account.deleted ||
    account.payouts_enabled !== true ||
    account.capabilities?.transfers !== 'active'
  ) {
    payout.status = 'failed';
    payout.failureCode = 'PAYOUT_CONNECT_ACCOUNT_UNVERIFIED';
    payout.failureReason = 'Provider Connect account is not payout-ready.';
    await payout.save(saveOpts);
    const err = payoutError('PAYOUT_CONNECT_ACCOUNT_UNVERIFIED', 'Provider Connect account is not payout-ready.');
    err.providerId = String(providerId);
    throw err;
  }

  if (priorStatus !== 'pending' && priorStatus !== 'released_internal') {
    let startingAfter;
    let recovered;
    let hasMore = true;
    while (hasMore && !recovered) {
      const existingTransfers = await stripe.transfers.list({
        destination: stripeConnectAccountId,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      recovered = (existingTransfers.data || []).find(
        (candidate) => candidate.metadata?.payoutId === String(payout._id)
      );
      hasMore = Boolean(existingTransfers.has_more);
      startingAfter = existingTransfers.data?.[existingTransfers.data.length - 1]?.id;
      if (hasMore && !startingAfter) {
        payout.status = 'reconciliation_required';
        payout.failureCode = 'PAYOUT_TRANSFER_LOOKUP_INCOMPLETE';
        payout.failureReason = 'Stripe transfer history could not be fully checked.';
        await payout.save(saveOpts);
        throw payoutError('PAYOUT_RECONCILIATION_REQUIRED', 'Stripe transfer history could not be fully checked.');
      }
    }
    if (recovered) {
      if (
        recovered.destination !== stripeConnectAccountId ||
        recovered.source_transaction !== source.chargeId ||
        recovered.amount !== Math.round(netProviderAmount * 100) ||
        recovered.currency?.toLowerCase() !== 'nok' ||
        recovered.livemode !== source.livemode
      ) {
        payout.status = 'reconciliation_required';
        payout.failureCode = 'PAYOUT_TRANSFER_MISMATCH';
        payout.failureReason = 'A transfer exists but does not match the authorized payout.';
        await payout.save(saveOpts);
        throw payoutError('PAYOUT_TRANSFER_MISMATCH', 'Existing Stripe transfer requires manual review.');
      }
      payout.status = 'transferred';
      payout.stripeTransferId = recovered.id;
      payout.transferInitiatedAt ||= new Date();
      await payout.save(saveOpts);
      return { payout, transfer: recovered, alreadyPaid: false, reconciled: true };
    }
  }

  let transfer;
  try {
    const transferParams = {
      amount:      Math.round(netProviderAmount * 100), // Stripe uses øre/cents
      currency:    'nok',
      destination: stripeConnectAccountId,
      source_transaction: source.chargeId,
      metadata: {
        orderId:       String(orderId),
        providerId:    String(providerId),
        customerId:    String(customerId),
        releaseSource,
        payoutId:      String(payout._id),
      },
    };

    transfer = await stripe.transfers.create(transferParams, {
      idempotencyKey: `transfer_${idempotencyKey}`,
    });
  } catch (stripeErr) {
    // Record failure without losing the Payout record (retryable)
    payout.status = 'reconciliation_required';
    payout.failureReason = 'Stripe transfer outcome is unknown; reconcile before retrying.';
    payout.failureCode = stripeErr.code || stripeErr.type || 'stripe_transfer_outcome_unknown';
    await payout.save(saveOpts);

    const err = payoutError('PAYOUT_RECONCILIATION_REQUIRED', 'Stripe transfer outcome is unknown; manual reconciliation is required.');
    err.stripeCode   = stripeErr.code || stripeErr.type;
    err.payoutId     = String(payout._id);
    err.retryable    = true;
    throw err;
  }

  // ── 5. Mark transfer as completed ─────────────────────────────────────────
  payout.transitionTo('transferred', {
    stripeTransferId:    transfer.id,
    transferInitiatedAt: new Date(),
    stripeLivemode: source.livemode,
  });
  await payout.save(saveOpts);

  try {
    const { recordStripeTransfer } = require('../stripe/financialHistory');
    await recordStripeTransfer(transfer, {
      livemode: source.livemode,
      source: 'reconciliation',
    });
    payout.financialSyncStatus = 'synced';
    payout.financialSyncError = undefined;
  } catch (syncErr) {
    payout.financialSyncStatus = 'failed';
    payout.financialSyncError = syncErr.code || syncErr.name || 'financial_history_sync_failed';
    console.error(
      'releasePayoutToProvider: transfer history sync failed for payout %s: %s',
      String(payout._id),
      payout.financialSyncError
    );
  }
  await payout.save(saveOpts);

  // ── 6. Update Payment record status to 'released' if it exists ────────────
  await Payment.findOneAndUpdate(
    { orderId },
    { $set: { status: 'released' } }
  );

  return { payout, transfer, alreadyPaid: false };
}

module.exports = releasePayoutToProvider;
