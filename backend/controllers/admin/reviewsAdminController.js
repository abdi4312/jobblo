const Review = require('../../models/Review');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId, parseSort, parseDate } = require('../../utils/pagination');
const { logActivity } = require('../../services/admin/activityService');

const SORT_FIELDS = ['createdAt', 'rating'];

/**
 * GET /api/admin/reviews
 */
const getReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sortBy, req.query.sortOrder, SORT_FIELDS, 'createdAt');

  const query = {};

  if (req.query.rating) {
    const r = parseInt(req.query.rating, 10);
    if (r >= 1 && r <= 5) query.rating = r;
  }
  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = new Date(dateTo.setHours(23, 59, 59, 999));
  }
  const reviewerId = parseObjectId(req.query.reviewerId);
  if (reviewerId) query.reviewerId = reviewerId;

  const [total, reviews] = await Promise.all([
    Review.countDocuments(query),
    Review.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('reviewerId', 'name email avatarUrl')
      .populate('revieweeId', 'name email avatarUrl')
      .populate('serviceId', 'title')
      .lean(),
  ]);

  return sendSuccess(res, { reviews }, 'Vurderinger hentet.', buildPagination(total, page, limit));
});

/**
 * DELETE /api/admin/reviews/:id
 */
const deleteReview = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig vurderings-ID.', 400);

  const review = await Review.findById(id);
  if (!review) return sendError(res, 'Vurdering ikke funnet.', 404);

  await review.deleteOne();

  await logActivity({
    adminId: req.user._id,
    action: 'other',
    targetModel: 'other',
    targetId: id,
    description: `Vurdering slettet (rating: ${review.rating})`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, {}, 'Vurdering slettet.');
});

module.exports = { getReviews, deleteReview };
