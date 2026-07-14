const AdminActivity = require('../../models/AdminActivity');
const { asyncHandler, sendSuccess, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseDate } = require('../../utils/pagination');

/**
 * GET /api/admin/activity
 * Paginated, filterable admin activity log.
 */
const getActivityLog = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const query = {};

  if (req.query.action) query.action = req.query.action;
  if (req.query.targetModel) query.targetModel = req.query.targetModel;

  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = new Date(dateTo.setHours(23, 59, 59, 999));
  }

  const [total, logs] = await Promise.all([
    AdminActivity.countDocuments(query),
    AdminActivity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('adminId', 'name email')
      .lean(),
  ]);

  return sendSuccess(res, { logs }, 'Aktivitetslogg hentet.', buildPagination(total, page, limit));
});

module.exports = { getActivityLog };
