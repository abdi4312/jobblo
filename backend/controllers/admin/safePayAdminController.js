const mongoose = require('mongoose');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const SafePayHistory = require('../../models/SafePayHistory');
const Chat = require('../../models/ChatMessage');
const Dispute = require('../../models/Dispute');
const AdminActivity = require('../../models/AdminActivity');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId, parseSort, parseDate } = require('../../utils/pagination');
const { logActivity } = require('../../services/admin/activityService');

const SORT_FIELDS = ['createdAt', 'updatedAt', 'agreedPrice'];

// ── SafePay list ───────────────────────────────────────────────────────────────
/**
 * GET /api/admin/safepay
 * Paginated list of all SafePay contracts (orders with payment context).
 */
const getSafePayList = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sortBy, req.query.sortOrder, SORT_FIELDS, 'createdAt');

  const query = {};

  if (req.query.status) {
    const valid = ['pending','accepted','declined','in_progress','completed','cancelled','awaiting_payment','paid','disputed'];
    if (valid.includes(req.query.status)) query.status = req.query.status;
  }
  if (req.query.paymentStatus) {
    const valid = ['unpaid','pending','paid','refunded'];
    if (valid.includes(req.query.paymentStatus)) query.paymentStatus = req.query.paymentStatus;
  }

  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = new Date(dateTo.setHours(23, 59, 59, 999));
  }

  // Search by order ID prefix
  if (req.query.orderId) {
    const oid = parseObjectId(req.query.orderId);
    if (oid) query._id = oid;
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-checklist -priceNegotiation -history -beforeImages -afterImages -attachments')
      .populate('customerId', 'name email avatarUrl phone accountStatus verified')
      .populate('providerId', 'name email avatarUrl phone accountStatus verified')
      .populate('serviceId', 'title price status categories')
      .lean(),
  ]);

  // Attach dispute info for each order
  const orderIds = orders.map((o) => o._id);
  const disputes = await Dispute.find(
    { orderId: { $in: orderIds } },
    { orderId: 1, status: 1, priority: 1, _id: 1 }
  ).lean();

  const disputeMap = {};
  disputes.forEach((d) => { disputeMap[String(d.orderId)] = d; });

  // Fee calculation (3% Jobblo fee)
  const enriched = orders.map((o) => {
    const fee = o.agreedPrice ? Math.round(o.agreedPrice * 0.03) : 0;
    return {
      ...o,
      fee,
      customerTotal: o.agreedPrice ? o.agreedPrice + fee : null,
      providerNet: o.agreedPrice ? o.agreedPrice - fee : null,
      dispute: disputeMap[String(o._id)] ?? null,
    };
  });

  // Chat status — attach separately (chatId is on order)
  const chatIds = orders.map((o) => o.chatId).filter(Boolean);
  const chats = await Chat.find(
    { _id: { $in: chatIds } },
    { _id: 1, status: 1, messages: { $slice: -1 } }
  ).lean();
  const chatMap = {};
  chats.forEach((c) => { chatMap[String(c._id)] = c; });

  const final = enriched.map((o) => ({
    ...o,
    chatStatus: o.chatId ? chatMap[String(o.chatId)]?.status ?? null : null,
  }));

  return sendSuccess(res, { contracts: final }, 'SafePay-kontrakter hentet.', buildPagination(total, page, limit));
});

// ── SafePay summary ───────────────────────────────────────────────────────────
/**
 * GET /api/admin/safepay/summary
 * Aggregated stats for the summary cards.
 */
const getSafePaySummary = asyncHandler(async (req, res) => {
  const [orderStats, disputeStats, revenueStats] = await Promise.all([
    Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$agreedPrice' },
        },
      },
    ]),
    Dispute.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    SafePayHistory.aggregate([
      {
        $group: {
          _id: '$status',
          totalCustomer: { $sum: '$amounts.totalCustomer' },
          totalNet: { $sum: '$amounts.netProvider' },
          totalFee: { $sum: '$amounts.fee' },
        },
      },
    ]),
  ]);

  const byStatus = (arr, key) => {
    const map = {};
    arr.forEach((item) => { map[item._id] = item[key] || 0; });
    return map;
  };

  const orderCountByStatus = byStatus(orderStats, 'count');
  const disputeCountByStatus = byStatus(disputeStats, 'count');

  const revenueSummary = { secured: 0, released: 0, refunded: 0, fees: 0 };
  revenueStats.forEach((r) => {
    if (r._id === 'completed') {
      revenueSummary.secured += r.totalCustomer;
      revenueSummary.released += r.totalNet;
      revenueSummary.fees += r.totalFee;
    }
    if (r._id === 'refunded') {
      revenueSummary.refunded += r.totalCustomer;
    }
  });

  return sendSuccess(res, {
    orders: {
      total: Object.values(orderCountByStatus).reduce((s, v) => s + v, 0),
      awaiting_payment: orderCountByStatus['awaiting_payment'] ?? 0,
      paid: orderCountByStatus['paid'] ?? 0,
      in_progress: orderCountByStatus['in_progress'] ?? 0,
      completed: orderCountByStatus['completed'] ?? 0,
      cancelled: orderCountByStatus['cancelled'] ?? 0,
      disputed: orderCountByStatus['disputed'] ?? 0,
    },
    disputes: {
      open: disputeCountByStatus['open'] ?? 0,
      under_review: disputeCountByStatus['under_review'] ?? 0,
      resolved: disputeCountByStatus['resolved'] ?? 0,
    },
    revenue: revenueSummary,
  });
});

// ── SafePay detail ────────────────────────────────────────────────────────────
/**
 * GET /api/admin/safepay/:orderId
 */
const getSafePayDetail = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.orderId);
  if (!id) return sendError(res, 'Ugyldig ordre-ID.', 400);

  const order = await Order.findById(id)
    .populate('customerId', 'name email avatarUrl phone role accountStatus verified averageRating completedJobs reviewCount')
    .populate('providerId', 'name email avatarUrl phone role accountStatus verified averageRating completedJobs reviewCount')
    .populate('serviceId', 'title price status categories images location')
    .populate('checklist.checkedBy', 'name email')
    .lean();

  if (!order) return sendError(res, 'Kontrakt ikke funnet.', 404);

  // Fee calculation
  const fee = order.agreedPrice ? Math.round(order.agreedPrice * 0.03) : 0;

  const [payment, safePayHistory, dispute, chat] = await Promise.all([
    Payment.findOne({ orderId: id })
      .select('-stripeSessionId') // Never return raw session ID
      .lean(),
    SafePayHistory.findOne({ orderId: id }).lean(),
    Dispute.findOne({ orderId: id })
      .populate('openedBy', 'name email role')
      .populate('openedAgainst', 'name email role')
      .populate('assignedAdminId', 'name email')
      .lean(),
    order.chatId
      ? Chat.findById(order.chatId)
          .select('status clientId providerId messages.type messages.createdAt messages.text messages.systemData agreedPrice')
          .lean()
      : null,
  ]);

  // Chat metadata only (no full message content unless audit)
  const chatMeta = chat
    ? {
        _id: chat._id,
        status: chat.status,
        messageCount: chat.messages?.length ?? 0,
        systemMessageCount: chat.messages?.filter((m) => m.type?.startsWith('system_')).length ?? 0,
        lastMessageAt: chat.messages?.length
          ? chat.messages[chat.messages.length - 1].createdAt
          : null,
      }
    : null;

  // Sanitize payment — truncate Stripe IDs
  let safePay = null;
  if (payment) {
    safePay = {
      _id: payment._id,
      status: payment.status,
      amount: payment.amount,
      stripePaymentIntentId: payment.stripePaymentIntentId
        ? `...${payment.stripePaymentIntentId.slice(-8)}`
        : null,
      stripeSessionId: null, // Never exposed
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  return sendSuccess(res, {
    order: {
      ...order,
      fee,
      customerTotal: order.agreedPrice ? order.agreedPrice + fee : null,
      providerNet: order.agreedPrice ? order.agreedPrice - fee : null,
    },
    payment: safePay,
    safePayHistory: safePayHistory
      ? { ...safePayHistory, transactionId: safePayHistory.transactionId ? `...${safePayHistory.transactionId.slice(-8)}` : null }
      : null,
    dispute,
    chatMeta,
  });
});

// ── SafePay timeline ──────────────────────────────────────────────────────────
/**
 * GET /api/admin/safepay/:orderId/timeline
 * Unified timeline from order history + chat system events + dispute events.
 */
const getSafePayTimeline = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.orderId);
  if (!id) return sendError(res, 'Ugyldig ordre-ID.', 400);

  const [order, dispute] = await Promise.all([
    Order.findById(id).select('history chatId status').lean(),
    Dispute.findOne({ orderId: id }).select('timeline openedAt closedAt').lean(),
  ]);

  if (!order) return sendError(res, 'Kontrakt ikke funnet.', 404);

  const timeline = [];

  // Order history events
  (order.history || []).forEach((h) => {
    timeline.push({
      source: 'order',
      action: h.action,
      actorId: h.userId,
      timestamp: h.timestamp,
      description: h.data?.message ?? h.action,
    });
  });

  // Chat system events (metadata only)
  if (order.chatId) {
    const chat = await Chat.findById(order.chatId)
      .select('messages.type messages.text messages.createdAt messages.systemData')
      .lean();
    (chat?.messages || [])
      .filter((m) => m.type?.startsWith('system_'))
      .forEach((m) => {
        timeline.push({
          source: 'chat',
          action: m.type,
          actorId: null,
          timestamp: m.createdAt,
          description: m.text,
        });
      });
  }

  // Dispute timeline
  if (dispute) {
    (dispute.timeline || []).forEach((t) => {
      timeline.push({
        source: 'dispute',
        action: t.action,
        actorId: t.actorId,
        timestamp: t.createdAt,
        description: t.note ?? t.action,
      });
    });
  }

  // Sort by timestamp ascending
  timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return sendSuccess(res, { timeline });
});

// ── Chat metadata access (audit) ──────────────────────────────────────────────
/**
 * GET /api/admin/safepay/:orderId/chat
 * Returns full chat messages only when admin provides an audit reason.
 * Creates an AdminActivity record.
 */
const getSafePayChat = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.orderId);
  if (!id) return sendError(res, 'Ugyldig ordre-ID.', 400);

  const { accessReason } = req.query;
  if (!accessReason || accessReason.trim().length < 5) {
    return sendError(res, 'En tilgangsgrunn er påkrevd for å se chattmeldinger.', 400);
  }

  const order = await Order.findById(id).select('chatId status').lean();
  if (!order) return sendError(res, 'Kontrakt ikke funnet.', 404);
  if (!order.chatId) return sendError(res, 'Ingen chat knyttet til denne kontrakten.', 404);

  // Allow full chat access when:
  // 1. There is an active dispute, OR
  // 2. Admin explicitly requests audit mode with a valid reason (access is always logged)
  const activeDispute = await Dispute.findOne({
    orderId: id,
    status: { $in: ['open', 'under_review', 'waiting_for_customer', 'waiting_for_provider', 'evidence_submitted'] },
  }).lean();

  const isAuditMode = req.query.auditMode === 'true';

  if (!activeDispute && !isAuditMode) {
    return sendError(res, 'Oppgi auditMode=true for å se chat uten aktiv tvist. Tilgang logges alltid.', 403);
  }

  const chat = await Chat.findById(order.chatId)
    .select('-deletedFor')
    .populate({ path: 'messages.senderId', select: 'name email role', strictPopulate: false })
    .lean();

  if (!chat) return sendError(res, 'Chat ikke funnet.', 404);

  await logActivity({
    adminId: req.user._id,
    action: 'other',
    targetModel: 'Order',
    targetId: id,
    description: `Admin åpnet fullstendig chatthistorikk (${activeDispute ? 'aktiv tvist' : 'revisjonsmodus'}). Årsak: ${accessReason.trim()}`,
    metadata: { chatId: order.chatId, orderId: id, reason: accessReason.trim(), hasActiveDispute: !!activeDispute },
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Sanitize — remove senderId details (name/email only, no tokens/passwords)
  const safeChatMessages = chat.messages.map((m) => ({
    _id: m._id,
    type: m.type,
    text: m.text,
    sender: m.senderId
      ? { _id: m.senderId._id, name: m.senderId.name, role: m.senderId.role }
      : null,
    attachments: m.attachments,
    systemData: m.systemData,
    createdAt: m.createdAt,
  }));

  return sendSuccess(res, {
    chat: {
      _id: chat._id,
      status: chat.status,
      agreedPrice: chat.agreedPrice,
      messages: safeChatMessages,
    },
    accessLogged: true,
    reason: accessReason.trim(),
  });
});

module.exports = {
  getSafePayList,
  getSafePaySummary,
  getSafePayDetail,
  getSafePayTimeline,
  getSafePayChat,
};
