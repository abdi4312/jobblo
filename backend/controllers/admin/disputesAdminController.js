const Dispute = require('../../models/Dispute');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Payout = require('../../models/Payout');
const SafePayHistory = require('../../models/SafePayHistory');
const Chat = require('../../models/ChatMessage');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { logApplicationError } = require('../../utils/errorLogger');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId, parseSort, parseDate } = require('../../utils/pagination');
const { logActivity } = require('../../services/admin/activityService');
const { notify } = require('../../services/notifications');
const { getStripeForMode } = require('../../config/stripe');
const { executeRefund, executeTransferReversal } = require('../../services/stripe/financialOperations');

const SORT_FIELDS = ['createdAt', 'updatedAt', 'openedAt'];
const VALID_STATUSES = ['open','under_review','waiting_for_customer','waiting_for_provider','evidence_submitted','resolved','closed','cancelled'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

function stripeId(value) {
  return typeof value === 'string' ? value : value?.id || null;
}

async function verifyDisputePayment(stripe, order, payment) {
  const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
  const intent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
  const chargeId = stripeId(intent.latest_charge);
  if (!chargeId) throw new Error('Verified SafePay charge is unavailable for this dispute.');
  const charge = await stripe.charges.retrieve(chargeId);
  const expectedAmount = order.checkoutAmountMinor;
  const customerId = order.checkoutCustomerId;
  if (
    !expectedAmount ||
    !customerId ||
    session.id !== order.checkoutSessionId ||
    session.id !== payment.stripeSessionId ||
    session.livemode !== (order.checkoutMode === 'live') ||
    session.status !== 'complete' ||
    session.payment_status !== 'paid' ||
    session.mode !== 'payment' ||
    stripeId(session.payment_intent) !== payment.stripePaymentIntentId ||
    stripeId(session.customer) !== customerId ||
    String(session.metadata?.orderId) !== String(order._id) ||
    String(session.metadata?.userId) !== String(order.customerId) ||
    session.amount_total !== expectedAmount ||
    String(session.currency).toLowerCase() !== String(order.checkoutCurrency || 'nok').toLowerCase() ||
    intent.id !== payment.stripePaymentIntentId ||
    intent.status !== 'succeeded' ||
    intent.amount_received !== expectedAmount ||
    stripeId(intent.customer) !== customerId ||
    charge.id !== chargeId ||
    charge.paid !== true ||
    charge.captured !== true ||
    charge.amount !== expectedAmount ||
    charge.currency !== session.currency ||
    stripeId(charge.payment_intent) !== payment.stripePaymentIntentId ||
    stripeId(charge.customer) !== customerId ||
    charge.disputed === true
  ) {
    throw new Error('SafePay payment does not match the order; manual reconciliation is required.');
  }
  return { session, intent, charge, chargeId };
}

// ── Disputes list ─────────────────────────────────────────────────────────────
const getDisputes = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sortBy, req.query.sortOrder, SORT_FIELDS, 'createdAt');

  const query = {};

  if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
    query.status = req.query.status;
  }
  if (req.query.priority && VALID_PRIORITIES.includes(req.query.priority)) {
    query.priority = req.query.priority;
  }
  if (req.query.assignedToMe === 'true') {
    query.assignedAdminId = req.user._id;
  }
  if (req.query.unassigned === 'true') {
    query.assignedAdminId = null;
  }

  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = new Date(dateTo.setHours(23, 59, 59, 999));
  }

  const [total, disputes] = await Promise.all([
    Dispute.countDocuments(query),
    Dispute.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-messages -evidence -timeline')
      .populate('orderId', 'agreedPrice status paymentStatus')
      .populate('openedBy', 'name email role')
      .populate('openedAgainst', 'name email role')
      .populate('serviceId', 'title')
      .populate('assignedAdminId', 'name email')
      .lean(),
  ]);

  return sendSuccess(res, { disputes }, 'Tvister hentet.', buildPagination(total, page, limit));
});

// ── Disputes summary ──────────────────────────────────────────────────────────
const getDisputesSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [statusCounts, priorityCounts] = await Promise.all([
    Dispute.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Dispute.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
  ]);

  const byStatus = {};
  statusCounts.forEach((s) => { byStatus[s._id] = s.count; });
  const byPriority = {};
  priorityCounts.forEach((p) => { byPriority[p._id] = p.count; });

  const resolvedThisMonth = await Dispute.countDocuments({
    status: 'resolved',
    updatedAt: { $gte: startOfMonth },
  });
  const unassigned = await Dispute.countDocuments({ assignedAdminId: null, status: { $in: ['open', 'under_review'] } });

  return sendSuccess(res, {
    open: byStatus['open'] ?? 0,
    under_review: byStatus['under_review'] ?? 0,
    waiting_for_customer: byStatus['waiting_for_customer'] ?? 0,
    waiting_for_provider: byStatus['waiting_for_provider'] ?? 0,
    resolved: byStatus['resolved'] ?? 0,
    closed: byStatus['closed'] ?? 0,
    resolvedThisMonth,
    unassigned,
    high_priority: (byPriority['high'] ?? 0) + (byPriority['critical'] ?? 0),
  });
});

// ── Dispute detail ────────────────────────────────────────────────────────────
const getDisputeById = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.disputeId);
  if (!id) return sendError(res, 'Ugyldig tvist-ID.', 400);

  const dispute = await Dispute.findById(id)
    .populate('orderId', 'status paymentStatus agreedPrice createdAt serviceId customerId providerId')
    .populate('openedBy', 'name email role avatarUrl accountStatus verified')
    .populate('openedAgainst', 'name email role avatarUrl accountStatus verified')
    .populate('serviceId', 'title price status categories')
    .populate('assignedAdminId', 'name email')
    .populate('resolution.resolvedBy', 'name email')
    .populate('messages.senderId', 'name email role')
    .populate('timeline.actorId', 'name email')
    .lean();

  if (!dispute) return sendError(res, 'Tvist ikke funnet.', 404);

  // Filter out internal messages for response (admin sees all, but mark them clearly)
  return sendSuccess(res, { dispute });
});

// ── Assign ────────────────────────────────────────────────────────────────────
const assignDispute = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.disputeId);
  if (!id) return sendError(res, 'Ugyldig tvist-ID.', 400);

  const dispute = await Dispute.findById(id);
  if (!dispute) return sendError(res, 'Tvist ikke funnet.', 404);
  if (['resolved', 'closed', 'cancelled'].includes(dispute.status)) {
    return sendError(res, 'Kan ikke tildele en lukket tvist.', 400);
  }

  dispute.assignedAdminId = req.user._id;
  if (dispute.status === 'open') dispute.status = 'under_review';

  dispute.timeline.push({
    action: 'assigned',
    actorId: req.user._id,
    note: `Tvist tildelt til ${req.user.name}`,
  });
  await dispute.save();

  await logActivity({
    adminId: req.user._id,
    action: 'other',
    targetModel: 'other',
    targetId: id,
    description: `Tvist tildelt til admin: ${req.user.name}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { dispute }, 'Tvist tildelt.');
});

// ── Status update ─────────────────────────────────────────────────────────────
const updateDisputeStatus = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.disputeId);
  if (!id) return sendError(res, 'Ugyldig tvist-ID.', 400);

  const { status, note } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return sendError(res, `Ugyldig status. Tillatte: ${VALID_STATUSES.join(', ')}.`, 400);
  }

  const TERMINAL = ['resolved', 'closed', 'cancelled'];
  const dispute = await Dispute.findById(id);
  if (!dispute) return sendError(res, 'Tvist ikke funnet.', 404);
  if (TERMINAL.includes(dispute.status)) {
    return sendError(res, 'Kan ikke endre status på en avsluttet tvist.', 400);
  }

  dispute.status = status;
  dispute.timeline.push({
    action: `status_changed_to_${status}`,
    actorId: req.user._id,
    note: note ?? `Status endret til ${status}`,
  });
  if (TERMINAL.includes(status)) dispute.closedAt = new Date();
  await dispute.save();

  return sendSuccess(res, { dispute }, 'Tviststatus oppdatert.');
});

// ── Request information ───────────────────────────────────────────────────────
const requestInformation = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.disputeId);
  if (!id) return sendError(res, 'Ugyldig tvist-ID.', 400);

  const { from, message } = req.body;
  if (!from || !['customer', 'provider'].includes(from)) {
    return sendError(res, 'Spesifiser "from": customer eller provider.', 400);
  }
  if (!message?.trim()) return sendError(res, 'Melding er påkrevd.', 400);

  const dispute = await Dispute.findById(id)
    .populate('openedBy', '_id')
    .populate('openedAgainst', '_id');
  if (!dispute) return sendError(res, 'Tvist ikke funnet.', 404);
  if (['resolved', 'closed', 'cancelled'].includes(dispute.status)) {
    return sendError(res, 'Tvisten er avsluttet.', 400);
  }

  // Add official dispute message (visible to parties)
  dispute.messages.push({
    senderId: req.user._id,
    senderRole: 'admin',
    message: message.trim(),
    isInternal: false,
  });
  dispute.status = from === 'customer' ? 'waiting_for_customer' : 'waiting_for_provider';
  dispute.timeline.push({
    action: `information_requested_from_${from}`,
    actorId: req.user._id,
    note: `Admin ba om informasjon fra ${from}`,
  });
  await dispute.save();

  // Notify the relevant party
  const order = await Order.findById(dispute.orderId).select('customerId providerId').lean();
  if (order) {
    const notifyUserId = from === 'customer' ? order.customerId : order.providerId;
    await notify({
      userId: notifyUserId,
      type: 'alert',
      content: 'Support ber om mer informasjon om tvisten din.',
      orderId: dispute.orderId,
      event: 'dispute_updated',
      payload: { disputeId: String(dispute._id) },
    });
  }

  return sendSuccess(res, { dispute }, 'Informasjonsforespørsel sendt.');
});

// ── Add dispute message (official, visible to parties) ────────────────────────
const addDisputeMessage = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.disputeId);
  if (!id) return sendError(res, 'Ugyldig tvist-ID.', 400);

  const { message } = req.body;
  if (!message?.trim()) return sendError(res, 'Melding er påkrevd.', 400);

  const dispute = await Dispute.findById(id);
  if (!dispute) return sendError(res, 'Tvist ikke funnet.', 404);
  if (['resolved', 'closed', 'cancelled'].includes(dispute.status)) {
    return sendError(res, 'Tvisten er avsluttet.', 400);
  }

  dispute.messages.push({
    senderId: req.user._id,
    senderRole: 'admin',
    message: message.trim(),
    isInternal: false,
  });
  await dispute.save();

  return sendSuccess(res, {}, 'Melding sendt.');
});

// ── Internal note (never visible to parties) ──────────────────────────────────
const addInternalNote = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.disputeId);
  if (!id) return sendError(res, 'Ugyldig tvist-ID.', 400);

  const { note } = req.body;
  if (!note?.trim()) return sendError(res, 'Notat er påkrevd.', 400);

  const dispute = await Dispute.findById(id);
  if (!dispute) return sendError(res, 'Tvist ikke funnet.', 404);

  dispute.messages.push({
    senderId: req.user._id,
    senderRole: 'admin',
    message: note.trim(),
    isInternal: true,
  });
  dispute.timeline.push({
    action: 'internal_note_added',
    actorId: req.user._id,
    note: 'Internt notat lagt til',
  });
  await dispute.save();

  return sendSuccess(res, {}, 'Internt notat lagret.');
});

// ── Resolve dispute ────────────────────────────────────────────────────────────
/**
 * POST /api/admin/disputes/:disputeId/resolve
 * Controlled resolution — validates all amounts before writing.
 * For refunds, calls Stripe API. Does NOT fake payment success.
 */
const resolveDispute = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.disputeId);
  if (!id) return sendError(res, 'Ugyldig tvist-ID.', 400);

  const { outcome, reason, customerAmount, providerAmount } = req.body;

  const VALID_OUTCOMES = ['release_to_provider','full_refund_to_customer','partial_refund','split_payment','cancel_without_payment','no_action'];
  if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
    return sendError(res, `Ugyldig utfall. Tillatte: ${VALID_OUTCOMES.join(', ')}.`, 400);
  }
  if (!reason?.trim()) return sendError(res, 'Begrunnelse er påkrevd.', 400);

  const dispute = await Dispute.findById(id).populate('orderId');
  if (!dispute) return sendError(res, 'Tvist ikke funnet.', 404);

  const ACTIVE_STATUSES = ['open', 'under_review', 'waiting_for_customer', 'waiting_for_provider', 'evidence_submitted'];
  if (!ACTIVE_STATUSES.includes(dispute.status)) {
    return sendError(res, 'Tvisten er ikke aktiv og kan ikke løses.', 400);
  }

  // Prevent duplicate resolution. A resolution whose money movement FAILED is the
  // one case worth retrying — the Stripe calls below are all idempotent, so a retry
  // re-attempts the transfer/refund without duplicating it.
  if (
    dispute.resolution?.outcome &&
    !['failed', 'reconciliation_required'].includes(dispute.resolution?.moneyState)
  ) {
    return sendError(res, 'Tvisten er allerede løst.', 409);
  }

  const order = dispute.orderId;
  if (!order) return sendError(res, 'Ordre ikke funnet.', 404);

  const payment = await Payment.findOne({ orderId: order._id });
  if (!payment && outcome !== 'cancel_without_payment') {
    return sendError(res, 'Betaling ikke funnet. Kan ikke behandle utbetaling.', 400);
  }

  const securedAmount = order.agreedPrice ?? 0;
  const fee = Math.round(securedAmount * 0.03);
  const cust = customerAmount ?? 0;
  const prov = providerAmount ?? 0;

  // Validate amounts don't exceed what was secured
  if (cust + prov > securedAmount + fee) {
    return sendError(
      res,
      `Sum av beløp (${cust + prov}) overstiger sikret beløp (${securedAmount + fee}).`,
      400
    );
  }

  // ── Decide where the money goes, for every outcome ──────────────────────────
  //
  // Three outcomes previously recorded amounts that nothing ever moved:
  //   partial_refund          refunded the customer but never paid the provider's share
  //   split_payment           made NO Stripe call at all, yet cancelled the order
  //   cancel_without_payment  refunded nobody, so the platform simply kept the money
  // and `no_action` — documented as "no action" — cancelled the order.
  //
  // Every branch below names both a refund and a payout amount, and the order status
  // follows from what actually moved.
  const plan = (() => {
    switch (outcome) {
      case 'release_to_provider':
        return { refund: 0, payout: securedAmount, payoutFee: fee, payment: 'released', order: 'completed' };
      case 'full_refund_to_customer':
        return { refund: securedAmount, payout: 0, payoutFee: 0, payment: 'refunded', order: 'cancelled' };
      case 'partial_refund':
      case 'split_payment':
        return {
          refund: cust,
          payout: prov,
          payoutFee: 0, // `prov` is already the provider's net share
          payment: cust > 0 && prov === 0 ? 'refunded' : cust > 0 ? 'partially_refunded' : 'completed',
          order: prov > 0 ? 'completed' : 'cancelled',
        };
      case 'cancel_without_payment':
        return {
          refund: payment && ['completed', 'released', 'disputed'].includes(payment.status)
            ? securedAmount
            : 0,
          payout: 0,
          payoutFee: 0,
          payment: payment ? 'refunded' : 'pending',
          order: 'cancelled',
        };
      case 'no_action':
      default:
        // Genuinely no action: the order returns to where the dispute found it.
        return {
          refund: 0,
          payout: 0,
          payoutFee: 0,
          payment: 'completed',
          order: dispute.previousOrderStatus || 'ready_for_review',
        };
    }
  })();

  if (plan.refund > 0 && !payment?.stripePaymentIntentId) {
    return sendError(
      res,
      'Ingen Stripe Payment Intent ID funnet. Manuell handling i Stripe-dashboard kreves.',
      400
    );
  }

  const movesMoney = plan.refund > 0 || plan.payout > 0;

  // ── Record the intent BEFORE calling Stripe ─────────────────────────────────
  //
  // The refund used to run inside a MongoDB transaction. Stripe is not part of that
  // transaction, so an abort after a successful refund left the customer refunded and
  // the database certain it had never happened — irreversible and invisible. MongoDB
  // and Stripe cannot be made atomic, so instead: write the intent, act, write the
  // result. A crash in between leaves `moneyState: 'pending'` for a reconciliation
  // sweep to find, and every Stripe call below is idempotent.
  dispute.resolution = {
    outcome,
    reason: reason.trim(),
    customerAmount: cust,
    providerAmount: prov,
    platformFee: fee,
    resolvedBy: req.user._id,
    resolvedAt: new Date(),
    moneyState: movesMoney ? 'pending' : 'settled',
  };
  await dispute.save();

  let stripeRefundId = null;
  let stripeRefundStatus = null;
  let payoutResult = null;
  let stripeTransferId = null;
  let stripeReversalId = null;
  let existingPayout = null;

  try {
    let stripe;
    let charge;
    if (movesMoney || plan.refund > 0) {
      existingPayout = await Payout.findOne({ orderId: order._id }).lean();
      if (
        ['processing', 'reconciliation_required'].includes(existingPayout?.status) &&
        !existingPayout.stripeTransferId
      ) {
        const error = new Error('A prior transfer attempt must be reconciled before dispute money can move.');
        error.code = 'PAYOUT_RECONCILIATION_REQUIRED';
        throw error;
      }
      if (!['test', 'live'].includes(order.checkoutMode)) {
        throw new Error('Payment mode is missing; financial recovery requires manual reconciliation.');
      }
      stripe = await getStripeForMode(order.checkoutMode === 'test');
      if (payment) {
        const source = await verifyDisputePayment(stripe, order, payment);
        charge = source.charge;
      }
    }

    if (plan.refund > 0) {
      const refundResult = await executeRefund(stripe, {
        operationKey: `dispute:${dispute._id}:refund:${payment.stripePaymentIntentId}:${Math.round(plan.refund * 100)}`,
        orderId: order._id,
        paymentId: payment._id,
        disputeId: dispute._id,
        stripeMode: order.checkoutMode,
        paymentIntentId: payment.stripePaymentIntentId,
        chargeId: charge.id,
        amount: Math.round(plan.refund * 100),
        currency: charge.currency,
      });
      stripeRefundId = refundResult.refund.id;
      stripeRefundStatus = refundResult.refund.status;
      dispute.resolution.stripeRefundId = stripeRefundId;
      dispute.resolution.stripeRefundStatus = stripeRefundStatus;
      await dispute.save();
      if (refundResult.status !== 'succeeded') {
        return res.status(202).json({
          message: 'Refunderingen behandles fortsatt av Stripe. Tvisten forblir åpen til betalingen er bekreftet.',
          code: 'refund_pending',
          stripeRefundId,
          stripeRefundStatus,
        });
      }
    }

    if (plan.payout > 0) {
      const releasePayoutToProvider = require('../../services/payout/releasePayoutToProvider');
      if (
        ['transferred', 'processing', 'reconciliation_required'].includes(existingPayout?.status) &&
        existingPayout.stripeTransferId
      ) {
        const transfer = await stripe.transfers.retrieve(existingPayout.stripeTransferId);
        const targetAmount = Math.round((plan.payout - plan.payoutFee) * 100);
        const remainingAmount = Number(transfer.amount) - Number(transfer.amount_reversed || 0);
        if (
          transfer.id !== existingPayout.stripeTransferId ||
          transfer.livemode !== (order.checkoutMode === 'live') ||
          stripeId(transfer.destination) !== existingPayout.stripeConnectAccountId ||
          stripeId(transfer.source_transaction) !== charge.id ||
          transfer.amount !== Math.round(Number(existingPayout.netProviderAmount) * 100) ||
          String(transfer.currency).toUpperCase() !== String(charge.currency).toUpperCase() ||
          !Number.isSafeInteger(remainingAmount) ||
          remainingAmount < targetAmount
        ) {
          throw new Error('Existing provider transfer cannot safely satisfy the approved dispute outcome.');
        }
        stripeTransferId = transfer.id;
        const reversalAmount = remainingAmount - targetAmount;
        if (reversalAmount > 0) {
          const reversal = await executeTransferReversal(stripe, {
            operationKey: `dispute:${dispute._id}:reversal:${transfer.id}:${reversalAmount}`,
            orderId: order._id,
            paymentId: payment._id,
            disputeId: dispute._id,
            stripeMode: order.checkoutMode,
            paymentIntentId: payment.stripePaymentIntentId,
            chargeId: charge.id,
            transferId: transfer.id,
            amount: reversalAmount,
            currency: transfer.currency,
          });
          stripeReversalId = reversal.reversal.id;
        }
        payoutResult = { payout: existingPayout, alreadyPaid: true };
      } else {
        payoutResult = await releasePayoutToProvider({
          orderId: order._id,
          providerId: order.providerId,
          customerId: order.customerId,
          serviceId: order.serviceId,
          grossAmount: plan.payout,
          platformFee: plan.payoutFee,
          releaseSource: 'dispute_release',
          releasedBy: req.user._id,
          stripePaymentIntentId: payment?.stripePaymentIntentId,
          stripeCheckoutSessionId: payment?.stripeSessionId,
          disputeId: dispute._id,
        });
        stripeTransferId = payoutResult?.payout?.stripeTransferId || null;
        if (!payoutResult.alreadyPaid) {
          await User.findByIdAndUpdate(order.providerId, {
            $inc: { earnings: plan.payout - plan.payoutFee },
          });
        }
      }
    }

    if (plan.refund > 0 && plan.payout === 0) {
      if (
        ['transferred', 'processing', 'reconciliation_required'].includes(existingPayout?.status) &&
        existingPayout.stripeTransferId
      ) {
        const transfer = await stripe.transfers.retrieve(existingPayout.stripeTransferId);
        const remainingAmount = Number(transfer.amount) - Number(transfer.amount_reversed || 0);
        if (
          transfer.id !== existingPayout.stripeTransferId ||
          transfer.livemode !== (order.checkoutMode === 'live') ||
          stripeId(transfer.destination) !== existingPayout.stripeConnectAccountId ||
          stripeId(transfer.source_transaction) !== charge.id ||
          String(transfer.currency).toUpperCase() !== String(charge.currency).toUpperCase() ||
          !Number.isSafeInteger(remainingAmount)
        ) {
          throw new Error('Existing provider transfer cannot be verified for the approved refund.');
        }
        if (remainingAmount > 0) {
          const reversal = await executeTransferReversal(stripe, {
            operationKey: `dispute:${dispute._id}:reversal:${transfer.id}:${remainingAmount}`,
            orderId: order._id,
            paymentId: payment._id,
            disputeId: dispute._id,
            stripeMode: order.checkoutMode,
            paymentIntentId: payment.stripePaymentIntentId,
            chargeId: charge.id,
            transferId: transfer.id,
            amount: remainingAmount,
            currency: transfer.currency,
          });
          stripeReversalId = reversal.reversal.id;
        }
        stripeTransferId = transfer.id;
      }
    }
  } catch (moneyErr) {
    // Leave the dispute unresolved and retryable, and say so loudly. The previous code
    // returned 502 for a refund failure and merely console.error'd a failed transfer,
    // so a provider could be left unpaid with the dispute marked resolved.
    dispute.resolution.moneyState = String(moneyErr.code || '').includes('RECONCILIATION_REQUIRED')
      ? 'reconciliation_required'
      : 'failed';
    dispute.resolution.moneyError = moneyErr.message?.slice(0, 500);
    dispute.resolution.stripeRefundId = stripeRefundId;
    dispute.resolution.stripeRefundStatus = stripeRefundStatus;
    dispute.resolution.stripeReversalId = stripeReversalId;
    await dispute.save();

    await logApplicationError({
      error: moneyErr,
      requestPath: req.originalUrl,
      httpMethod: 'POST',
      httpStatus: 502,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?._id,
      errorCode: dispute.resolution.moneyState === 'reconciliation_required'
        ? 'DISPUTE_RESOLUTION_RECONCILIATION_REQUIRED'
        : 'DISPUTE_RESOLUTION_MONEY_FAILED',
      source: 'dispute_resolution',
      metadata: {
        disputeId: String(dispute._id),
        orderId: String(order._id),
        outcome,
        refundPlanned: plan.refund,
        payoutPlanned: plan.payout,
        stripeRefundId,
      },
    });

    return sendError(
      res,
      `Pengeoverføringen mislyktes: ${moneyErr.message}. Tvisten er ikke lukket — prøv igjen.`,
      502
    );
  }

  // ── Money has moved. Now record the outcome. ────────────────────────────────
  dispute.status = 'resolved';
  dispute.payoutFrozen = false;
  dispute.closedAt = new Date();
  dispute.resolution.stripeRefundId = stripeRefundId;
  dispute.resolution.stripeRefundStatus = stripeRefundStatus;
  dispute.resolution.stripeTransferId = stripeTransferId;
  dispute.resolution.stripeReversalId = stripeReversalId;
  dispute.resolution.moneyState = 'settled';
  dispute.timeline.push({
    action: 'dispute_resolved',
    actorId: req.user._id,
    note: `Tvist løst: ${outcome}. ${reason.trim()}`,
    metadata: { customerAmount: cust, providerAmount: prov, stripeRefundId, stripeTransferId },
  });
  await dispute.save();

  if (payment) {
    payment.status = plan.payment;
    await payment.save();
  }

  const orderStatus = plan.order;
  order.status = orderStatus;
  order.history.push({
    action: 'dispute_resolved',
    userId: req.user._id,
    timestamp: new Date(),
    data: { outcome, reason: reason.trim(), refunded: plan.refund, paidOut: plan.payout },
  });
  await order.save();

  if (order.chatId) {
    await Chat.findByIdAndUpdate(order.chatId, {
      status:
        orderStatus === 'completed' ? 'completed' : orderStatus === 'cancelled' ? 'cancelled' : 'paid',
    });
  }

  await SafePayHistory.findOneAndUpdate(
    { orderId: order._id },
    {
      status:
        orderStatus === 'completed'
          ? 'completed'
          : orderStatus === 'cancelled'
            ? 'refunded'
            : 'in_progress',
    }
  );

  // Notifications are best-effort and must never fail the resolution.
  try {
    await Promise.all([
      notify({
        userId: order.customerId,
        type: 'alert',
        content: `Tvisten din er avgjort. Utfall: ${outcome}.`,
        orderId: order._id,
        event: 'dispute_resolved',
        payload: { orderId: String(order._id), outcome },
      }),
      notify({
        userId: order.providerId,
        type: 'alert',
        content: `Tvisten på oppdraget ditt er avgjort. Utfall: ${outcome}.`,
        orderId: order._id,
        event: 'dispute_resolved',
        payload: { orderId: String(order._id), outcome },
      }),
    ]);
  } catch {
    // Notification failure is non-critical
  }

  await logActivity({
    adminId: req.user._id,
    action: 'other',
    targetModel: 'Order',
    targetId: order._id,
    description: `Tvist løst: ${outcome}. Refundert: ${plan.refund}. Utbetalt: ${plan.payout}. Stripe refusjon: ${stripeRefundId ?? 'N/A'}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(
    res,
    { dispute, stripeRefundId, stripeRefundStatus, stripeTransferId },
    'Tvist løst.'
  );
});

// ── Reopen dispute ────────────────────────────────────────────────────────────
const reopenDispute = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.disputeId);
  if (!id) return sendError(res, 'Ugyldig tvist-ID.', 400);

  const { reason } = req.body;
  if (!reason?.trim()) return sendError(res, 'Årsak til gjenåpning er påkrevd.', 400);

  const dispute = await Dispute.findById(id);
  if (!dispute) return sendError(res, 'Tvist ikke funnet.', 404);
  if (!['resolved', 'closed'].includes(dispute.status)) {
    return sendError(res, 'Kun løste eller lukkede tvister kan gjenåpnes.', 400);
  }

  dispute.status = 'under_review';
  dispute.payoutFrozen = true;
  dispute.closedAt = null;
  dispute.timeline.push({
    action: 'dispute_reopened',
    actorId: req.user._id,
    note: `Tvist gjenåpnet: ${reason.trim()}`,
  });
  await dispute.save();

  return sendSuccess(res, { dispute }, 'Tvist gjenåpnet.');
});

module.exports = {
  getDisputes,
  getDisputesSummary,
  getDisputeById,
  assignDispute,
  updateDisputeStatus,
  requestInformation,
  addDisputeMessage,
  addInternalNote,
  resolveDispute,
  reopenDispute,
};
