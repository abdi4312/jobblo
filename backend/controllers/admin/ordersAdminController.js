const Order = require('../../models/Order');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId, parseSort, parseDate } = require('../../utils/pagination');
const { logActivity } = require('../../services/admin/activityService');

const SORT_FIELDS = ['createdAt', 'updatedAt', 'agreedPrice', 'status'];

/**
 * GET /api/admin/orders
 * Paginated, filterable order list.
 */
const getOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sortBy, req.query.sortOrder, SORT_FIELDS, 'createdAt');

  const query = {};

  if (req.query.status) {
    const valid = ['pending','accepted','declined','in_progress','completed','cancelled','awaiting_payment','paid'];
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

  // Customer or provider filter
  const customerId = parseObjectId(req.query.customerId);
  if (customerId) query.customerId = customerId;
  const providerId = parseObjectId(req.query.providerId);
  if (providerId) query.providerId = providerId;
  const serviceId = parseObjectId(req.query.serviceId);
  if (serviceId) query.serviceId = serviceId;

  const [total, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-checklist -priceNegotiation -history -beforeImages -afterImages -attachments')
      .populate('customerId', 'name email avatarUrl')
      .populate('providerId', 'name email avatarUrl')
      .populate('serviceId', 'title price status')
      .lean(),
  ]);

  return sendSuccess(res, { orders }, 'Ordrer hentet.', buildPagination(total, page, limit));
});

/**
 * GET /api/admin/orders/:id
 */
const getOrderById = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig ordre-ID.', 400);

  const order = await Order.findById(id)
    .populate('customerId', 'name email avatarUrl phone')
    .populate('providerId', 'name email avatarUrl phone')
    .populate('serviceId', 'title price status categories images')
    .lean();

  if (!order) return sendError(res, 'Ordre ikke funnet.', 404);

  return sendSuccess(res, { order });
});

/**
 * PUT /api/admin/orders/:id/status
 * Admin can only add a note or cancel a pending order.
 * Cannot bypass payment integrity (no forced 'paid' status).
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig ordre-ID.', 400);

  const { status, adminNote } = req.body;
  const ADMIN_ALLOWED = ['cancelled'];
  if (status && !ADMIN_ALLOWED.includes(status)) {
    return sendError(res, `Admin kan kun sette status til: ${ADMIN_ALLOWED.join(', ')}.`, 400);
  }

  const update = {};
  if (status) update.status = status;
  if (adminNote) update.adminNote = String(adminNote).substring(0, 500);

  const order = await Order.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!order) return sendError(res, 'Ordre ikke funnet.', 404);

  await logActivity({
    adminId: req.user._id,
    action: 'order_updated',
    targetModel: 'Order',
    targetId: id,
    description: `Ordre status endret til "${status ?? 'note added'}" av admin`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { order }, 'Ordre oppdatert.');
});

module.exports = { getOrders, getOrderById, updateOrderStatus };
