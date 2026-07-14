const Service = require('../../models/Service');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId, parseSort, parseDate } = require('../../utils/pagination');
const { logActivity } = require('../../services/admin/activityService');

const SORT_FIELDS = ['createdAt', 'updatedAt', 'price', 'title', 'views'];
const VALID_STATUSES = ['open','closed','in_progress','completed','pending','waiting_for_approval','cancelled','expired','draft'];

/**
 * GET /api/admin/services
 */
const getServices = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sortBy, req.query.sortOrder, SORT_FIELDS, 'createdAt');

  const query = {};

  if (req.query.search) {
    const esc = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { title: { $regex: esc, $options: 'i' } },
      { description: { $regex: esc, $options: 'i' } },
    ];
  }
  if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
    query.status = req.query.status;
  }
  if (req.query.category) {
    query.categories = { $in: [req.query.category] };
  }
  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = new Date(dateTo.setHours(23, 59, 59, 999));
  }

  const [total, services] = await Promise.all([
    Service.countDocuments(query),
    Service.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-checklist -timeEntries -imageMetadata')
      .populate('userId', 'name email avatarUrl role')
      .lean(),
  ]);

  return sendSuccess(res, { services }, 'Tjenester hentet.', buildPagination(total, page, limit));
});

/**
 * GET /api/admin/services/:id
 */
const getServiceById = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig tjeneste-ID.', 400);

  const service = await Service.findById(id)
    .populate('userId', 'name email avatarUrl phone role subscription')
    .lean();

  if (!service) return sendError(res, 'Tjeneste ikke funnet.', 404);
  return sendSuccess(res, { service });
});

/**
 * PUT /api/admin/services/:id/status
 */
const updateServiceStatus = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig tjeneste-ID.', 400);

  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return sendError(res, `Ugyldig status. Tillatte: ${VALID_STATUSES.join(', ')}.`, 400);
  }

  const service = await Service.findByIdAndUpdate(id, { status }, { new: true }).lean();
  if (!service) return sendError(res, 'Tjeneste ikke funnet.', 404);

  await logActivity({
    adminId: req.user._id,
    action: 'service_activated',
    targetModel: 'Service',
    targetId: id,
    description: `Tjeneste status satt til "${status}": ${service.title}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { service }, 'Tjenestestatus oppdatert.');
});

/**
 * DELETE /api/admin/services/:id
 */
const deleteService = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig tjeneste-ID.', 400);

  const service = await Service.findById(id);
  if (!service) return sendError(res, 'Tjeneste ikke funnet.', 404);

  // Clean up Cloudinary images if any
  if (service.imageMetadata?.length > 0) {
    try {
      const cloudinary = require('../../config/cloudinary');
      for (const meta of service.imageMetadata) {
        if (meta.blobName) {
          await cloudinary.uploader.destroy(meta.blobName).catch(() => {});
        }
      }
    } catch {
      // Image cleanup failure should not block record deletion
    }
  }

  await service.deleteOne();

  await logActivity({
    adminId: req.user._id,
    action: 'service_deleted',
    targetModel: 'Service',
    targetId: id,
    description: `Tjeneste slettet: ${service.title}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, {}, 'Tjeneste slettet.');
});

module.exports = { getServices, getServiceById, updateServiceStatus, deleteService };
