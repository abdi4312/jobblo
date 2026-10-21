const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const StripeTransferRecord = require('../../models/StripeTransferRecord');
const StripePaymentIncident = require('../../models/StripePaymentIncident');
const StripeFinancialOperation = require('../../models/StripeFinancialOperation');
const { getStripeForMode } = require('../../config/stripe');
const { logApplicationError } = require('../../utils/errorLogger');

function idOf(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

function lifecycleKind(type) {
  if (type.startsWith('charge.dispute.')) return 'charge_dispute';
  if (type === 'charge.refunded') return 'charge_refund';
  if (type === 'charge.refund.updated') return 'refund';
  if (type.startsWith('refund.')) return 'refund';
  return null;
}

/** The internal refund operation this Stripe refund belongs to, if every field agrees. */
async function findVerifiedRefundOperation(refund, paymentIntentId, livemode) {
  const operationKey = refund.metadata?.jobbloOperationKey;
  if (!operationKey) return null;
  const operation = await StripeFinancialOperation.findOne({ operationKey });
  const verified =
    operation &&
    operation.type === 'refund' &&
    operation.paymentIntentId === paymentIntentId &&
    operation.amount === refund.amount &&
    operation.currency === String(refund.currency || '').toUpperCase() &&
    operation.stripeMode === (livemode ? 'live' : 'test') &&
    (!operation.chargeId || idOf(refund.charge) === operation.chargeId) &&
    refund.livemode === livemode;
  return verified ? operation : null;
}

/** Record the refund's Stripe status on its operation (and its duplicate-payment incident). */
async function applyRefundOperationResult(operation, refund) {
  const status = refund.status === 'succeeded'
    ? 'succeeded'
    : refund.status === 'failed' || refund.status === 'canceled'
      ? 'failed'
      : 'pending';
  const changes = {
    status,
    stripeObjectId: refund.id,
    lastErrorCode: status === 'failed' ? 'stripe_refund_failed' : null,
    ...(status === 'succeeded' ? { completedAt: new Date(), failedAt: null } : {}),
    ...(status === 'failed' ? { failedAt: new Date() } : {}),
  };
  await StripeFinancialOperation.updateOne({ _id: operation._id }, { $set: changes });
  Object.assign(operation, changes);
  if (status === 'succeeded' && operation.incidentId) {
    await StripePaymentIncident.updateOne(
      { _id: operation.incidentId, kind: 'duplicate_payment', status: 'manual_review' },
      {
        $set: {
          status: 'reconciled',
          stripeObjectId: refund.id,
          resolutionOperationId: operation._id,
          lastError: null,
          reason: 'The verified duplicate SafePay payment was refunded and confirmed by Stripe.',
        },
      }
    );
  }
  return status;
}

async function recordStripePaymentLifecycle(event) {
  let object = event.data?.object || {};
  const kind = lifecycleKind(event.type);
  if (!kind || typeof event.livemode !== 'boolean') {
    throw new Error('Stripe payment lifecycle event is missing type or mode');
  }

  const stripe = await getStripeForMode(event.livemode === false);
  if (kind === 'charge_dispute') {
    object = await stripe.disputes.retrieve(object.id);
  } else if (kind === 'charge_refund') {
    object = await stripe.charges.retrieve(object.id);
  } else {
    object = await stripe.refunds.retrieve(object.id);
  }
  const chargeId = kind === 'charge_refund' ? object.id : idOf(object.charge);
  const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null;
  const paymentIntentId = idOf(object.payment_intent) || idOf(charge?.payment_intent);
  const payment = paymentIntentId
    ? await Payment.findOne({ stripePaymentIntentId: paymentIntentId })
    : null;
  const order = payment ? await Order.findById(payment.orderId) : null;
  const payout = order ? await Payout.findOne({ orderId: order._id }).lean() : null;
  const transferRecord = order
    ? await StripeTransferRecord.findOne({ orderId: order._id, livemode: event.livemode }).lean()
    : null;
  const payoutSourceMatches = Boolean(
    payout &&
    payout.stripeLivemode === event.livemode &&
    payout.stripePaymentIntentId === paymentIntentId &&
    String(payout.currency || '').toLowerCase() === String(charge?.currency || '').toLowerCase()
  );
  const transferRecordMatches = Boolean(
    transferRecord &&
    (transferRecord.sourceTransactionId === chargeId ||
      (payoutSourceMatches && payout.stripeTransferId === transferRecord.stripeObjectId)) &&
    String(transferRecord.currency).toLowerCase() === String(charge?.currency).toLowerCase() &&
    (!payout ||
      (transferRecord.stripeAccountId === payout.stripeConnectAccountId &&
        transferRecord.amount === Math.round(Number(payout.netProviderAmount) * 100)))
  );
  const transferMatches = Boolean(
    (payout?.stripeTransferId &&
      payoutSourceMatches &&
      (!transferRecord ||
        (transferRecord.stripeObjectId === payout.stripeTransferId && transferRecordMatches))) ||
    transferRecordMatches
  );
  const modeMatches =
    payment &&
    order &&
    charge &&
    (payment.stripeLivemode === null ||
      payment.stripeLivemode === undefined ||
      payment.stripeLivemode === event.livemode) &&
    order.checkoutMode === (event.livemode ? 'live' : 'test') &&
    payment.stripeSessionId === order.checkoutSessionId &&
    charge.id === chargeId &&
    idOf(charge.payment_intent) === paymentIntentId &&
    idOf(charge.customer) === order.checkoutCustomerId &&
    charge.livemode === event.livemode &&
    charge.paid === true &&
    charge.captured === true;

  let verifiedSession;
  if (modeMatches) {
    verifiedSession = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
  }
  const checkoutMatches =
    modeMatches &&
    verifiedSession?.id === order.checkoutSessionId &&
    verifiedSession?.livemode === event.livemode &&
    idOf(verifiedSession.payment_intent) === paymentIntentId &&
    idOf(verifiedSession.customer) === order.checkoutCustomerId &&
    String(verifiedSession.metadata?.orderId) === String(order._id) &&
    String(verifiedSession.metadata?.userId) === String(order.customerId) &&
    verifiedSession.amount_total === order.checkoutAmountMinor &&
    String(verifiedSession.currency || '').toLowerCase() ===
      String(order.checkoutCurrency || 'nok').toLowerCase();
  const matched = Boolean(checkoutMatches);
  // A refund Jobblo itself issued, verified against its own operation record. The
  // duplicate-payment refund is for the DUPLICATE PaymentIntent, which has no Payment
  // row, so it never "matches" the order above — and a refund that was still pending
  // when the admin approved it (202) was never reconciled: the operation stayed
  // pending, the incident stayed in manual review, and every refund event added a new
  // unmatched incident.
  const refundOperation = kind === 'refund'
    ? await findVerifiedRefundOperation(object, paymentIntentId, event.livemode)
    : null;
  const operationKey = String(object.metadata?.jobbloOperationKey || '');
  const ownDuplicateRefund = !matched && refundOperation && operationKey.startsWith('duplicate-payment:');
  const stripeDisputeId = kind === 'charge_dispute' ? object.id : undefined;
  const disputeWon = kind === 'charge_dispute' &&
    ['won', 'warning_closed'].includes(object.status);

  if (ownDuplicateRefund) {
    await applyRefundOperationResult(refundOperation, object);
    return { handled: 'duplicate_payment_refund_reconciled' };
  }

  await StripePaymentIncident.findOneAndUpdate(
    { eventId: event.id },
    {
      $setOnInsert: {
        eventId: event.id,
        eventType: event.type,
        kind: matched ? kind : 'unmatched',
        status: matched && disputeWon ? 'reconciled' : 'manual_review',
        orderId: matched ? order._id : undefined,
        paymentIntentId: paymentIntentId || undefined,
        checkoutSessionId: payment?.stripeSessionId || undefined,
        chargeId: chargeId || undefined,
        originalChargeId: chargeId || undefined,
        providerTransferId: transferMatches
          ? payout?.stripeTransferId || transferRecord?.stripeObjectId
          : undefined,
        stripeDisputeId,
        disputeStatus: kind === 'charge_dispute' ? object.status : undefined,
        disputeReason: kind === 'charge_dispute' ? object.reason : undefined,
        evidenceDueAt:
          kind === 'charge_dispute' && Number.isFinite(object.evidence_details?.due_by)
            ? new Date(object.evidence_details.due_by * 1000)
            : undefined,
        previousOrderStatus: matched && kind === 'charge_dispute' ? order.status : undefined,
        stripeObjectId: object.id,
        livemode: event.livemode,
        amount: Number.isSafeInteger(object.amount) ? object.amount : charge?.amount,
        amountRefunded: Number.isSafeInteger(charge?.amount_refunded)
          ? charge.amount_refunded
          : undefined,
        currency: typeof object.currency === 'string'
          ? object.currency.toUpperCase()
          : charge?.currency?.toUpperCase(),
        reason: matched
          ? kind === 'charge_dispute'
            ? `Stripe chargeback status ${object.status}; provider payout remains frozen until review or a verified favorable resolution.`
            : `Stripe refund status ${object.status}; any provider transfer recovery requires approved review.`
          : 'Stripe payment event could not be matched to a verified SafePay order, payment, charge, customer and mode.',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (!matched) return { handled: 'unmatched_payment_event' };

  if (refundOperation) {
    const status = await applyRefundOperationResult(refundOperation, object);
    if (operationKey.startsWith('safepay-connect-timeout:')) {
      const { applyTimeoutRefundResult } = require('../safepay/providerConnectTimeout');
      await applyTimeoutRefundResult(order, payment, refundOperation, object, status);
    }
  }

  const isConnectTimeoutRefund = Boolean(
    order?.providerConnectTimeout?.operationKey?.startsWith('safepay-connect-timeout:')
  );
  if (kind === 'charge_refund' && isConnectTimeoutRefund) {
    const operationKey = order.providerConnectTimeout.operationKey;
    const operation = await StripeFinancialOperation.findOne({ operationKey });
    if (
      operation &&
      operation.type === 'refund' &&
      operation.paymentIntentId === paymentIntentId &&
      operation.stripeMode === (event.livemode ? 'live' : 'test')
    ) {
      const refunds = await stripe.refunds.list({ charge: object.id, limit: 100 });
      const timeoutRefund = (refunds.data || []).find(
        (refund) =>
          refund.metadata?.jobbloOperationKey === operationKey &&
          refund.amount === operation.amount &&
          String(refund.currency || '').toUpperCase() === operation.currency &&
          (!operation.chargeId || idOf(refund.charge) === operation.chargeId) &&
          object.livemode === event.livemode
      );
      if (timeoutRefund) {
        const status = timeoutRefund.status === 'succeeded'
          ? 'succeeded'
          : timeoutRefund.status === 'failed' || timeoutRefund.status === 'canceled'
            ? 'failed'
            : 'pending';
        await StripeFinancialOperation.updateOne(
          { _id: operation._id },
          {
            $set: {
              status,
              stripeObjectId: timeoutRefund.id,
              lastErrorCode: status === 'failed' ? 'stripe_refund_failed' : null,
              ...(status === 'succeeded' ? { completedAt: new Date(), failedAt: null } : {}),
              ...(status === 'failed' ? { failedAt: new Date() } : {}),
            },
          }
        );
        Object.assign(operation, {
          status,
          stripeObjectId: timeoutRefund.id,
          lastErrorCode: status === 'failed' ? 'stripe_refund_failed' : null,
          ...(status === 'succeeded' ? { completedAt: new Date(), failedAt: null } : {}),
          ...(status === 'failed' ? { failedAt: new Date() } : {}),
        });
        const { applyTimeoutRefundResult } = require('../safepay/providerConnectTimeout');
        await applyTimeoutRefundResult(order, payment, operation, timeoutRefund, status);
      }
    }
  }

  if (kind === 'charge_dispute' &&
      !disputeWon) {
    await Payment.updateOne(
      { _id: payment._id, status: { $in: ['completed', 'released'] } },
      { $set: { status: 'disputed' } }
    );
    if (order.status !== 'cancelled') {
      await Order.updateOne(
        { _id: order._id, status: { $in: ['paid', 'in_progress', 'ready_for_review', 'completed'] } },
        { $set: { status: 'disputed' } }
      );
    }
  }

  if (kind === 'charge_dispute' && disputeWon) {
    const firstIncident = await StripePaymentIncident.findOne({ stripeDisputeId }).sort({ createdAt: 1 }).lean();
    const restoredStatus = firstIncident?.previousOrderStatus ||
      (payout?.status === 'transferred' ? 'completed' : 'paid');
    await StripePaymentIncident.updateMany(
      { stripeDisputeId },
      { $set: { status: 'reconciled', disputeStatus: object.status } }
    );
    await Payment.updateOne(
      { _id: payment._id, status: 'disputed' },
      { $set: { status: payout?.status === 'transferred' ? 'released' : 'completed' } }
    );
    await Order.updateOne(
      { _id: order._id, status: 'disputed' },
      { $set: { status: restoredStatus } }
    );
  }

  if (isConnectTimeoutRefund) {
    // The timeout refund service keeps the order paid until its exact refund is confirmed.
  } else if (kind === 'charge_refund' && object.amount_refunded >= object.amount) {
    await Payment.updateOne(
      { _id: payment._id, status: { $ne: 'disputed' } },
      { $set: { status: 'refunded' } }
    );
    await Order.updateOne(
      { _id: order._id, paymentStatus: { $in: ['paid', 'partially_refunded'] } },
      { $set: { paymentStatus: 'refunded' } }
    );
  } else if (
    (kind === 'charge_refund' && object.amount_refunded > 0) ||
    (kind === 'refund' && object.status === 'succeeded' && object.amount < charge.amount)
  ) {
    await Payment.updateOne(
      { _id: payment._id, status: { $nin: ['disputed', 'refunded'] } },
      { $set: { status: 'partially_refunded' } }
    );
    await Order.updateOne(
      { _id: order._id, paymentStatus: 'paid' },
      { $set: { paymentStatus: 'partially_refunded' } }
    );
  }

  // Keep the lookup explicit: chargeback and refund events never trigger an
  // unapproved transfer reversal.
  return { handled: kind, orderId: String(order._id) };
}

async function recordDuplicateSafePayPayment({
  order,
  originalPayment,
  session,
  paymentIntentId,
  chargeId,
}) {
  const duplicateSessionId = session.id;
  const eventId = `duplicate_payment:${duplicateSessionId}:${paymentIntentId}`;
  const originalPaymentIntentId =
    originalPayment?.stripePaymentIntentId || order.paymentIntentId || undefined;
  const originalCheckoutSessionId =
    originalPayment?.stripeSessionId || order.checkoutSessionId || undefined;
  let originalChargeId;
  if (originalPaymentIntentId) {
    const stripe = await getStripeForMode(session.livemode === false);
    const originalIntent = await stripe.paymentIntents.retrieve(originalPaymentIntentId);
    const candidateChargeId = idOf(originalIntent.latest_charge);
    if (candidateChargeId) {
      const originalCharge = await stripe.charges.retrieve(candidateChargeId);
      if (
        originalIntent.status === 'succeeded' &&
        originalIntent.amount_received === order.checkoutAmountMinor &&
        idOf(originalIntent.customer) === order.checkoutCustomerId &&
        originalCharge.paid === true &&
        originalCharge.captured === true &&
        originalCharge.amount === order.checkoutAmountMinor &&
        String(originalCharge.currency).toLowerCase() === String(order.checkoutCurrency).toLowerCase() &&
        idOf(originalCharge.payment_intent) === originalPaymentIntentId &&
        idOf(originalCharge.customer) === order.checkoutCustomerId &&
        originalCharge.livemode === session.livemode
      ) {
        originalChargeId = candidateChargeId;
      }
    }
  }
  const incident = await StripePaymentIncident.findOneAndUpdate(
    { eventId },
    {
      $setOnInsert: {
        eventId,
        eventType: 'safepay.duplicate_payment_detected',
        kind: 'duplicate_payment',
        status: 'manual_review',
        orderId: order._id,
        paymentIntentId,
        originalPaymentIntentId,
        duplicatePaymentIntentId: paymentIntentId,
        checkoutSessionId: duplicateSessionId,
        originalCheckoutSessionId,
        duplicateCheckoutSessionId: duplicateSessionId,
        stripeCustomerId: idOf(session.customer),
        chargeId,
        originalChargeId,
        livemode: session.livemode,
        amount: session.amount_total,
        currency: String(session.currency || '').toUpperCase(),
        reason: 'A second independently verified SafePay payment exists for an already-paid order; no second entitlement or provider transfer was created. Manual refund review is required.',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  try {
    await logApplicationError({
      error: new Error('Duplicate successful SafePay payment requires manual refund review'),
      requestPath: '/api/stripe/webhook',
      httpMethod: 'POST',
      httpStatus: 409,
      errorCode: 'SAFEPAY_DUPLICATE_SUCCESSFUL_PAYMENT',
      source: 'stripe_payment_incident',
      metadata: {
        incidentId: String(incident._id),
        orderId: String(order._id),
        originalPaymentIntentId: originalPayment?.stripePaymentIntentId || null,
        duplicatePaymentIntentId: paymentIntentId,
        stripeMode: session.livemode ? 'live' : 'test',
      },
    });
  } catch (error) {
    console.error('Could not create admin alert for Stripe incident %s', eventId);
  }
  return incident;
}

async function recordRejectedSafePayPayment({ event, session, reason }) {
  if (
    !event?.id ||
    !event.type ||
    typeof event.livemode !== 'boolean' ||
    !session?.id ||
    !reason
  ) {
    throw new Error('Rejected SafePay payment incident is missing required identifiers');
  }

  const metadataOrderId = session.metadata?.orderId;
  const orderId = mongoose.Types.ObjectId.isValid(metadataOrderId)
    ? metadataOrderId
    : undefined;
  const paymentIntentId = idOf(session.payment_intent);
  const incident = await StripePaymentIncident.findOneAndUpdate(
    { eventId: event.id },
    {
      $setOnInsert: {
        eventId: event.id,
        eventType: event.type,
        kind: 'unmatched',
        status: 'manual_review',
        orderId,
        paymentIntentId: paymentIntentId || undefined,
        checkoutSessionId: session.id,
        stripeCustomerId: idOf(session.customer) || undefined,
        stripeObjectId: session.id,
        livemode: event.livemode,
        amount: Number.isSafeInteger(session.amount_total) ? session.amount_total : undefined,
        currency: typeof session.currency === 'string'
          ? session.currency.toUpperCase()
          : undefined,
        reason: `Paid SafePay checkout failed canonical verification (${reason}). No order payment state was confirmed; manual review is required.`,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    await logApplicationError({
      error: new Error('Paid SafePay checkout requires manual verification'),
      requestPath: '/api/stripe/webhook',
      httpMethod: 'POST',
      httpStatus: 409,
      errorCode: 'SAFEPAY_CONFIRMATION_REJECTED',
      source: 'stripe_payment_incident',
      metadata: {
        incidentId: String(incident._id),
        eventId: event.id,
        orderId: orderId ? String(orderId) : null,
        checkoutSessionId: session.id,
        reason,
        stripeMode: event.livemode ? 'live' : 'test',
      },
    });
  } catch (error) {
    console.error('Could not create admin alert for rejected SafePay payment %s', event.id);
  }

  return incident;
}

module.exports = {
  recordStripePaymentLifecycle,
  recordDuplicateSafePayPayment,
  recordRejectedSafePayPayment,
};
