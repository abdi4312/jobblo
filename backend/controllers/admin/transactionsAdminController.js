const Transaction = require('../../models/Transaction');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId, parseSort, parseDate } = require('../../utils/pagination');

const SORT_FIELDS = ['createdAt', 'amount', 'status'];
const VALID_STATUSES = ['pending', 'succeeded', 'failed', 'refunded'];
const VALID_TYPES = ['subscription', 'extra_contact'];

/**
 * GET /api/admin/transactions
 */
const getTransactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sortBy, req.query.sortOrder, SORT_FIELDS, 'createdAt');

  const query = {};

  if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
    query.status = req.query.status;
  }
  if (req.query.type && VALID_TYPES.includes(req.query.type)) {
    query.type = req.query.type;
  }
  if (req.query.search) {
    const esc = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { planName: { $regex: esc, $options: 'i' } },
      { discountCoupon: { $regex: esc, $options: 'i' } },
    ];
  }
  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = new Date(dateTo.setHours(23, 59, 59, 999));
  }

  const [total, transactions] = await Promise.all([
    Transaction.countDocuments(query),
    Transaction.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      // Never expose stripeSessionId, raw Stripe data
      .select('-stripeSessionId')
      .populate('userId', 'name email')
      .lean(),
  ]);

  return sendSuccess(res, { transactions }, 'Transaksjoner hentet.', buildPagination(total, page, limit));
});

/**
 * GET /api/admin/transactions/:id
 */
const getTransactionById = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig transaksjons-ID.', 400);

  const transaction = await Transaction.findById(id)
    .select('-stripeSessionId')
    .populate('userId', 'name email')
    .lean();

  if (!transaction) return sendError(res, 'Transaksjon ikke funnet.', 404);
  return sendSuccess(res, { transaction });
});

module.exports = { getTransactions, getTransactionById };
