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

/**
 * PUT /api/admin/services/:id
 * Full content edit — admin bypasses ownership & lifecycle guards.
 * Accepts both JSON and multipart/form-data (same as the user-facing edit).
 */
const updateService = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig tjeneste-ID.', 400);

  const service = await Service.findById(id);
  if (!service) return sendError(res, 'Tjeneste ikke funnet.', 404);

  const b = req.body;

  // ── Scalar fields ──────────────────────────────────────────────────────────
  const EDITABLE = [
    'title', 'description', 'paymentType', 'equipment', 'status',
    'urgent', 'promoted', 'countyCode', 'municipalityCode', 'areaCode',
  ];
  for (const field of EDITABLE) {
    if (b[field] !== undefined) service[field] = b[field];
  }
  if (b.price !== undefined) service.price = Number(b.price);
  if (b.hourlyRate !== undefined) service.hourlyRate = Number(b.hourlyRate);
  if (b.maxApplicants !== undefined) service.maxApplicants = Number(b.maxApplicants);
  if (b.fromDate !== undefined) service.fromDate = b.fromDate || null;
  if (b.toDate !== undefined) service.toDate = b.toDate || null;

  // ── Arrays (FormData sends repeated keys; JSON sends real arrays) ──────────
  if (b.categories !== undefined) {
    service.categories = Array.isArray(b.categories) ? b.categories : [b.categories];
  }
  if (b.tags !== undefined) {
    service.tags = Array.isArray(b.tags) ? b.tags : [b.tags];
  }

  // ── Duration ──────────────────────────────────────────────────────────────
  if (b['duration[value]'] !== undefined || b['duration[unit]'] !== undefined) {
    service.duration = {
      value: Number(b['duration[value]'] ?? service.duration?.value ?? 0),
      unit: b['duration[unit]'] ?? service.duration?.unit ?? 'hours',
    };
  } else if (b.duration) {
    service.duration = b.duration;
  }

  // ── Location (supports both nested object and bracket notation) ───────────
  const locAddress = b['location[address]'] ?? b.location?.address;
  const locCity    = b['location[city]']    ?? b.location?.city;
  const locLng     = b['location[coordinates][0]'] ?? b.location?.coordinates?.[0];
  const locLat     = b['location[coordinates][1]'] ?? b.location?.coordinates?.[1];
  if (locAddress !== undefined || locCity !== undefined || locLng !== undefined) {
    const existing = service.location?.toObject?.() ?? service.location ?? {};
    service.location = {
      ...existing,
      type: 'Point',
      ...(locAddress !== undefined && { address: locAddress }),
      ...(locCity    !== undefined && { city: locCity }),
      ...(locLng !== undefined && locLat !== undefined && {
        coordinates: [Number(locLng), Number(locLat)],
      }),
    };
  }

  // ── Contact fields ─────────────────────────────────────────────────────────
  if (b.contactPhone !== undefined) service.contactPhone = b.contactPhone;
  if (b.contactEmail !== undefined) service.contactEmail = b.contactEmail;

  // ── Checklist ──────────────────────────────────────────────────────────────
  if (b.checklist) {
    try {
      const parsed = typeof b.checklist === 'string' ? JSON.parse(b.checklist) : b.checklist;
      service.checklist = parsed.map((item) => {
        const existing = service.checklist.find((c) => c.id === item.id);
        return {
          id: item.id, text: item.text,
          checked: existing?.checked ?? false,
          checkedBy: existing?.checkedBy ?? null,
          checkedAt: existing?.checkedAt ?? null,
        };
      });
    } catch { /* ignore bad checklist — don't block the save */ }
  }

  // ── Image deletion ─────────────────────────────────────────────────────────
  if (b.imagesToDelete) {
    const cloudinary = require('../../config/cloudinary');
    const toDelete = Array.isArray(b.imagesToDelete) ? b.imagesToDelete : [b.imagesToDelete];
    for (const url of toDelete) {
      const meta = service.imageMetadata.find((m) => m.url === url);
      if (meta?.blobName) await cloudinary.uploader.destroy(meta.blobName).catch(() => {});
      service.images = service.images.filter((u) => u !== url);
      service.imageMetadata = service.imageMetadata.filter((m) => m.url !== url);
    }
  }

  // ── New image uploads (via multer, same as user route) ────────────────────
  if (req.files?.length) {
    service.images.push(...req.files.map((f) => f.path));
    service.imageMetadata.push(...req.files.map((f) => ({
      url: f.path, blobName: f.filename, uploadedAt: new Date(),
    })));
  }

  await service.save();

  await logActivity({
    adminId: req.user._id,
    action: 'service_updated',
    targetModel: 'Service',
    targetId: id,
    description: `Tjeneste redigert av admin: ${service.title}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { service }, 'Tjeneste oppdatert.');
});

module.exports = { getServices, getServiceById, updateServiceStatus, updateService, deleteService };
