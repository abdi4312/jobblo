const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const StripeTransferRecord = require('../../models/StripeTransferRecord');
const StripePaymentIncident = require('../../models/StripePaymentIncident');
const { getStripeForMode } = require('../../config/stripe');
const {
  executeRefund,
  executeTransferReversal,
} = require('../../services/stripe/financialOperations');
const { logActivity } = require('../../services/admin/activityService');

function idOf(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

function destinationAccountForRecovery(payout, transferRecord) {
  return payout?.stripeConnectAccountId || transferRecord?.stripeAccountId || null;
}

exports.list = async (req, res) => {
  try {
    const page = Math.max(1, Math.min(1000, Number(req.query.page) || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const query = req.query.status
      ? { status: req.query.status }
      : { status: 'manual_review' };
    const [items, total] = await Promise.all([
      StripePaymentIncident.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('orderId', 'status paymentStatus agreedPrice')
        .lean(),
      StripePaymentIncident.countDocuments(query),
    ]);
    return res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (_error) {
    return res.status(500).json({ message: 'Kunne ikke hente finansielle avvik.' });
  }
};

exports.refundDuplicatePayment = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ code: 'invalid_incident_id' });
    }
    const incident = await StripePaymentIncident.findById(req.params.id);
    if (!incident || incident.kind !== 'duplicate_payment') {
      return res.status(404).json({ code: 'incident_not_found' });
    }
    if (incident.status === 'reconciled') {
      return res.status(409).json({ code: 'incident_already_reconciled' });
    }
    const order = await Order.findById(incident.orderId);
    const payment = await Payment.findOne({ orderId: incident.orderId });
    if (
      !order ||
      !payment ||
      String(payment.stripePaymentIntentId) !== String(incident.originalPaymentIntentId) ||
      incident.duplicatePaymentIntentId === incident.originalPaymentIntentId ||
      order.checkoutMode !== (incident.livemode ? 'live' : 'test') ||
      payment.stripeLivemode !== incident.livemode ||
      (order.checkoutCustomerId || payment.stripeCustomerId) !== incident.stripeCustomerId
    ) {
      return res.status(409).json({ code: 'incident_payment_mismatch' });
    }

    const stripe = await getStripeForMode(incident.livemode === false);
    const originalSession = await stripe.checkout.sessions.retrieve(incident.originalCheckoutSessionId);
    const originalIntent = await stripe.paymentIntents.retrieve(incident.originalPaymentIntentId);
    const originalChargeId = idOf(originalIntent.latest_charge);
    const originalCharge = originalChargeId
      ? await stripe.charges.retrieve(originalChargeId)
      : null;
    const session = await stripe.checkout.sessions.retrieve(incident.duplicateCheckoutSessionId);
    const intent = await stripe.paymentIntents.retrieve(incident.duplicatePaymentIntentId);
    const chargeId = idOf(intent.latest_charge);
    if (!chargeId) return res.status(409).json({ code: 'duplicate_charge_missing' });
    const charge = await stripe.charges.retrieve(chargeId);
    if (
      originalSession.id !== incident.originalCheckoutSessionId ||
      originalSession.livemode !== incident.livemode ||
      originalSession.status !== 'complete' ||
      originalSession.payment_status !== 'paid' ||
      idOf(originalSession.payment_intent) !== incident.originalPaymentIntentId ||
      idOf(originalSession.customer) !== incident.stripeCustomerId ||
      String(originalSession.metadata?.orderId) !== String(order._id) ||
      String(originalSession.metadata?.userId) !== String(order.customerId) ||
      originalSession.amount_total !== order.checkoutAmountMinor ||
      String(originalSession.currency).toUpperCase() !== String(order.checkoutCurrency).toUpperCase() ||
      originalIntent.status !== 'succeeded' ||
      originalIntent.livemode !== incident.livemode ||
      originalIntent.amount_received !== order.checkoutAmountMinor ||
      idOf(originalIntent.customer) !== incident.stripeCustomerId ||
      !originalCharge ||
      originalCharge.id !== incident.originalChargeId ||
      originalCharge.paid !== true ||
      originalCharge.captured !== true ||
      originalCharge.amount !== order.checkoutAmountMinor ||
      String(originalCharge.currency).toUpperCase() !== String(order.checkoutCurrency).toUpperCase() ||
      idOf(originalCharge.payment_intent) !== incident.originalPaymentIntentId ||
      idOf(originalCharge.customer) !== incident.stripeCustomerId ||
      originalCharge.livemode !== incident.livemode ||
      session.id !== incident.duplicateCheckoutSessionId ||
      session.livemode !== incident.livemode ||
      session.mode !== 'payment' ||
      session.status !== 'complete' ||
      session.payment_status !== 'paid' ||
      idOf(session.payment_intent) !== incident.duplicatePaymentIntentId ||
      idOf(session.customer) !== incident.stripeCustomerId ||
      String(session.metadata?.orderId) !== String(order._id) ||
      String(session.metadata?.userId) !== String(order.customerId) ||
      session.amount_total !== incident.amount ||
      intent.id !== incident.duplicatePaymentIntentId ||
      intent.status !== 'succeeded' ||
      intent.livemode !== incident.livemode ||
      intent.amount_received !== incident.amount ||
      String(intent.currency).toUpperCase() !== String(incident.currency).toUpperCase() ||
      idOf(intent.customer) !== incident.stripeCustomerId ||
      charge.id !== incident.chargeId ||
      charge.paid !== true ||
      charge.captured !== true ||
      charge.livemode !== incident.livemode ||
      charge.disputed === true ||
      idOf(charge.payment_intent) !== incident.duplicatePaymentIntentId ||
      String(charge.currency).toUpperCase() !== String(incident.currency).toUpperCase()
    ) {
      return res.status(409).json({ code: 'duplicate_charge_verification_failed' });
    }

    const result = await executeRefund(stripe, {
      operationKey: `duplicate-payment:${incident._id}:refund:${incident.duplicatePaymentIntentId}`,
      orderId: order._id,
      paymentId: payment._id,
      incidentId: incident._id,
      stripeMode: incident.livemode ? 'live' : 'test',
      paymentIntentId: incident.duplicatePaymentIntentId,
      chargeId,
      amount: incident.amount,
      currency: incident.currency,
    });
    incident.chargeId = chargeId;
    incident.resolutionOperationId = result.operation._id;
    incident.lastError = null;
    await logActivity({
      adminId: req.user._id,
      action: 'duplicate_payment_refund',
      targetModel: 'StripePaymentIncident',
      targetId: incident._id,
      description: 'Admin approved recovery refund for a verified duplicate SafePay payment.',
      metadata: {
        orderId: String(order._id),
        duplicatePaymentIntentId: incident.duplicatePaymentIntentId,
        refundId: result.refund.id,
        operationId: String(result.operation._id),
        status: result.status,
      },
      ip: req.ip,
      userAgent: req.get?.('user-agent') || 'unknown',
    });
    if (result.status === 'succeeded') {
      incident.status = 'reconciled';
      incident.reason = 'The separately verified duplicate SafePay charge was refunded after administrator approval.';
      await incident.save();
      return res.json({
        status: 'refunded',
        refundId: result.refund.id,
      });
    }
    await incident.save();
    return res.status(202).json({
      status: 'pending',
      refundId: result.refund.id,
    });
  } catch (error) {
    if (req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
      await StripePaymentIncident.updateOne(
        { _id: req.params.id, status: 'manual_review' },
        { $set: { lastError: error?.code || error?.type || 'financial_recovery_unresolved' } }
      );
    }
    return res.status(503).json({
      code: error?.code || 'financial_recovery_unresolved',
      message: 'Finansiell gjenoppretting krever ny avstemming eller manuell kontroll.',
    });
  }
};

exports.reverseChargebackTransfer = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ code: 'invalid_incident_id' });
    }
    const amount = req.body?.amountMinor;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!Number.isSafeInteger(amount) || amount <= 0 || reason.length < 8) {
      return res.status(400).json({
        code: 'invalid_recovery_request',
        message: 'Angi et positivt beløp i minor units og en begrunnelse på minst 8 tegn.',
      });
    }

    const incident = await StripePaymentIncident.findById(req.params.id);
    if (
      !incident ||
      incident.kind !== 'charge_dispute' ||
      incident.status !== 'manual_review' ||
      !incident.stripeDisputeId
    ) {
      return res.status(409).json({ code: 'chargeback_not_recoverable' });
    }
    const order = await Order.findById(incident.orderId);
    const payment = await Payment.findOne({ orderId: incident.orderId });
    const payout = await Payout.findOne({ orderId: incident.orderId }).lean();
    const transferRecord = await StripeTransferRecord.findOne({
      orderId: incident.orderId,
      livemode: incident.livemode,
    }).lean();
    if (
      !order ||
      !payment ||
      payment.stripePaymentIntentId !== incident.paymentIntentId ||
      payment.stripeSessionId !== incident.checkoutSessionId ||
      payment.stripeLivemode !== incident.livemode ||
      order.checkoutMode !== (incident.livemode ? 'live' : 'test') ||
      order.checkoutSessionId !== incident.checkoutSessionId ||
      order.paymentIntentId !== incident.paymentIntentId ||
      order.checkoutCustomerId !== incident.stripeCustomerId
    ) {
      return res.status(409).json({ code: 'chargeback_payment_mismatch' });
    }

    const stripe = await getStripeForMode(incident.livemode === false);
    const dispute = await stripe.disputes.retrieve(incident.stripeDisputeId);
    if (
      dispute.id !== incident.stripeDisputeId ||
      dispute.livemode !== incident.livemode ||
      dispute.status !== 'lost' ||
      idOf(dispute.charge) !== incident.chargeId ||
      idOf(dispute.payment_intent) !== incident.paymentIntentId ||
      Number(dispute.amount) !== incident.amount ||
      String(dispute.currency).toUpperCase() !== String(incident.currency).toUpperCase()
    ) {
      return res.status(409).json({ code: 'chargeback_not_final_or_mismatched' });
    }

    const session = await stripe.checkout.sessions.retrieve(incident.checkoutSessionId);
    const intent = await stripe.paymentIntents.retrieve(incident.paymentIntentId);
    const chargeId = idOf(intent.latest_charge);
    const charge = chargeId ? await stripe.charges.retrieve(chargeId) : null;
    if (
      !charge ||
      !Number.isSafeInteger(dispute.amount) ||
      dispute.amount <= 0 ||
      dispute.amount > charge.amount ||
      charge.id !== incident.chargeId ||
      session.id !== incident.checkoutSessionId ||
      session.status !== 'complete' ||
      session.payment_status !== 'paid' ||
      session.livemode !== incident.livemode ||
      session.mode !== 'payment' ||
      idOf(session.payment_intent) !== incident.paymentIntentId ||
      idOf(session.customer) !== incident.stripeCustomerId ||
      String(session.metadata?.orderId) !== String(order._id) ||
      String(session.metadata?.userId) !== String(order.customerId) ||
      session.amount_total !== order.checkoutAmountMinor ||
      String(session.currency).toUpperCase() !== String(order.checkoutCurrency).toUpperCase() ||
      intent.status !== 'succeeded' ||
      intent.livemode !== incident.livemode ||
      intent.amount_received !== order.checkoutAmountMinor ||
      idOf(intent.customer) !== incident.stripeCustomerId ||
      charge.paid !== true ||
      charge.captured !== true ||
      charge.livemode !== incident.livemode ||
      idOf(charge.payment_intent) !== incident.paymentIntentId ||
      idOf(charge.customer) !== incident.stripeCustomerId ||
      String(charge.currency).toUpperCase() !== String(incident.currency).toUpperCase()
    ) {
      return res.status(409).json({ code: 'chargeback_payment_verification_failed' });
    }

    const transferId = payout?.stripeTransferId || transferRecord?.stripeObjectId;
    if (
      !transferId ||
      !destinationAccountForRecovery(payout, transferRecord) ||
      (payout?.stripeLivemode !== null &&
        payout?.stripeLivemode !== undefined &&
        payout.stripeLivemode !== incident.livemode) ||
      (incident.providerTransferId && incident.providerTransferId !== transferId)
    ) {
      return res.status(409).json({ code: 'chargeback_transfer_not_found' });
    }
    const transfer = await stripe.transfers.retrieve(transferId);
    const expectedTransferAmount = payout?.netProviderAmount == null
      ? transferRecord?.amount
      : Math.round(Number(payout.netProviderAmount) * 100);
    const reversedAmount = transfer.amount_reversed === undefined ? 0 : transfer.amount_reversed;
    const remainingAmount = transfer.amount - reversedAmount;
    const destinationAccount = destinationAccountForRecovery(payout, transferRecord);
    if (
      transfer.id !== transferId ||
      transfer.livemode !== incident.livemode ||
      idOf(transfer.source_transaction) !== incident.chargeId ||
      idOf(transfer.destination) !== destinationAccount ||
      transfer.amount !== expectedTransferAmount ||
      String(transfer.currency).toUpperCase() !== String(incident.currency).toUpperCase() ||
      !Number.isSafeInteger(reversedAmount) ||
      !Number.isSafeInteger(remainingAmount) ||
      remainingAmount <= 0 ||
      amount > remainingAmount ||
      amount > incident.amount
    ) {
      return res.status(409).json({ code: 'chargeback_transfer_mismatch' });
    }

    const result = await executeTransferReversal(stripe, {
      operationKey: `chargeback:${incident._id}:reversal:${transferId}:${amount}`,
      orderId: order._id,
      paymentId: payment._id,
      incidentId: incident._id,
      stripeMode: incident.livemode ? 'live' : 'test',
      paymentIntentId: incident.paymentIntentId,
      chargeId: incident.chargeId,
      transferId,
      amount,
      currency: incident.currency,
    });
    incident.providerTransferId = transferId;
    incident.resolutionOperationId = result.operation._id;
    incident.lastError = null;
    if (result.status === 'succeeded') {
      const updatedTransfer = await stripe.transfers.retrieve(transferId);
      if (
        updatedTransfer.id !== transferId ||
        updatedTransfer.livemode !== incident.livemode ||
        idOf(updatedTransfer.source_transaction) !== incident.chargeId ||
        !Number.isSafeInteger(updatedTransfer.amount_reversed)
      ) {
        return res.status(202).json({ status: 'reconciliation_required' });
      }
      incident.transferReversedAmount = updatedTransfer.amount_reversed;
      if (updatedTransfer.amount_reversed >= incident.amount) {
        incident.status = 'reconciled';
        incident.reason = 'Stripe confirmed transfer recovery for the recorded chargeback amount.';
      }
    }
    await incident.save();
    await logActivity({
      adminId: req.user._id,
      action: 'stripe_chargeback_transfer_reversal',
      targetModel: 'StripePaymentIncident',
      targetId: incident._id,
      description: `Admin approved transfer recovery for Stripe chargeback: ${reason}`,
      metadata: {
        orderId: String(order._id),
        disputeId: incident.stripeDisputeId,
        transferId,
        amountMinor: amount,
        operationId: String(result.operation._id),
        status: result.status,
      },
      ip: req.ip,
      userAgent: req.get?.('user-agent') || 'unknown',
    });
    return res.status(result.status === 'succeeded' ? 200 : 202).json({
      status: result.status === 'succeeded' ? incident.status : 'pending',
      transferReversedAmount: incident.transferReversedAmount || 0,
    });
  } catch (error) {
    return res.status(503).json({
      code: error?.code || 'chargeback_recovery_unresolved',
      message: 'Gjenoppretting av overføringen krever ny avstemming eller manuell kontroll.',
    });
  }
};
