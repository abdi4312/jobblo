const Dispute = require('../../models/Dispute');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const SafePayHistory = require('../../models/SafePayHistory');
const Chat = require('../../models/ChatMessage');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const { logApplicationError } = require('../../utils/errorLogger');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId, parseSort, parseDate } = require('../../utils/pagination');
const { logActivity } = require('../../services/admin/activityService');
const { notify } = require('../../services/notifications');

const SORT_FIELDS = ['createdAt', 'updatedAt', 'openedAt'];
const VALID_STATUSES = ['open','under_review','waiting_for_customer','waiting_for_provider','evidence_submitted','resolved','closed','cancelled'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

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
  if (dispute.resolution?.outcome && dispute.resolution?.moneyState !== 'failed') {
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
          payment: 'refunded',
          order: prov > 0 ? 'completed' : 'cancelled',
        };
      case 'cancel_without_payment':
        // The customer's money must come back. This used to move nothing at all.
        return { refund: securedAmount, payout: 0, payoutFee: 0, payment: 'refunded', order: 'cancelled' };
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

  try {
    if (plan.refund > 0) {
      const { getStripe } = require('../../config/stripe');
      const stripe = await getStripe();
      const refund = await stripe.refunds.create(
        {
          payment_intent: payment.stripePaymentIntentId,
          amount: Math.round(plan.refund * 100), // Stripe works in øre
        },
        // Same key on every retry, so re-resolving a failed dispute cannot refund twice.
        { idempotencyKey: `dispute_refund_${id.toString()}` }
      );
      stripeRefundId = refund.id;
      stripeRefundStatus = refund.status;
      if (!['succeeded', 'pending'].includes(refund.status)) {
        throw new Error(`Stripe refusjon mislyktes: ${refund.status}`);
      }
    }

    if (plan.payout > 0) {
      const releasePayoutToProvider = require('../../services/payout/releasePayoutToProvider');
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
  } catch (moneyErr) {
    // Leave the dispute unresolved and retryable, and say so loudly. The previous code
    // returned 502 for a refund failure and merely console.error'd a failed transfer,
    // so a provider could be left unpaid with the dispute marked resolved.
    dispute.resolution.moneyState = 'failed';
    dispute.resolution.moneyError = moneyErr.message?.slice(0, 500);
    dispute.resolution.stripeRefundId = stripeRefundId;
    dispute.resolution.stripeRefundStatus = stripeRefundStatus;
    await dispute.save();

    await logApplicationError({
      error: moneyErr,
      requestPath: req.originalUrl,
      httpMethod: 'POST',
      httpStatus: 502,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?._id,
      errorCode: 'DISPUTE_RESOLUTION_MONEY_FAILED',
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
