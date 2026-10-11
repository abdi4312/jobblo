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
  const stripeDisputeId = kind === 'charge_dispute' ? object.id : undefined;
  const disputeWon = kind === 'charge_dispute' &&
    ['won', 'warning_closed'].includes(object.status);

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

  if (kind === 'refund') {
    const operationKey = object.metadata?.jobbloOperationKey;
    if (operationKey) {
      const operation = await StripeFinancialOperation.findOne({ operationKey });
      if (
        operation &&
        operation.type === 'refund' &&
        operation.paymentIntentId === paymentIntentId &&
        operation.amount === object.amount &&
        operation.currency === String(object.currency || '').toUpperCase() &&
        operation.stripeMode === (event.livemode ? 'live' : 'test')
      ) {
        const status = object.status === 'succeeded'
          ? 'succeeded'
          : object.status === 'failed' || object.status === 'canceled'
            ? 'failed'
            : 'pending';
        await StripeFinancialOperation.updateOne(
          { _id: operation._id },
          { $set: { status, stripeObjectId: object.id, lastErrorCode: status === 'failed' ? 'stripe_refund_failed' : null } }
        );
        if (status === 'succeeded' && operation.incidentId) {
          await StripePaymentIncident.updateOne(
            { _id: operation.incidentId, kind: 'duplicate_payment', status: 'manual_review' },
            {
              $set: {
                status: 'reconciled',
                stripeObjectId: object.id,
                resolutionOperationId: operation._id,
                lastError: null,
                reason: 'The verified duplicate SafePay payment was refunded and confirmed by Stripe.',
              },
            }
          );
        }
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

  if (kind === 'charge_refund' && object.amount_refunded >= object.amount) {
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

module.exports = { recordStripePaymentLifecycle, recordDuplicateSafePayPayment };
