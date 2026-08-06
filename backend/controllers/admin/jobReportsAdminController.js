const JobReport = require('../../models/JobReport');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId, parseSort, parseDate } = require('../../utils/pagination');

const SORT_FIELDS = ['createdAt', 'updatedAt'];
const TERMINAL_STATUSES = ['resolved', 'dismissed'];

// ── List ──────────────────────────────────────────────────────────────────────
const getReports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sortBy, req.query.sortOrder, SORT_FIELDS, 'createdAt');

  const query = {};

  if (req.query.status && JobReport.schema.path('status').enumValues.includes(req.query.status)) {
    query.status = req.query.status;
  }
  if (req.query.reportType) query.reportType = req.query.reportType;
  if (req.query.assignedToMe === 'true') query.assignedAdminId = req.user._id;

  const serviceId = parseObjectId(req.query.serviceId);
  if (serviceId) query.serviceId = serviceId;

  const dateFrom = parseDate(req.query.startDate);
  const dateTo = parseDate(req.query.endDate);
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = new Date(dateTo.setHours(23, 59, 59, 999));
  }

  const [total, reports] = await Promise.all([
    JobReport.countDocuments(query),
    JobReport.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('serviceId', 'title price status images')
      .populate('reportedBy', 'name email role avatarUrl')
      .populate('reportedUser', 'name email role avatarUrl')
      .populate('assignedAdminId', 'name email')
      .lean(),
  ]);

  return sendSuccess(res, { reports }, 'Rapporter hentet.', buildPagination(total, page, limit));
});

// ── Summary ───────────────────────────────────────────────────────────────────
const getReportsSummary = asyncHandler(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [statusCounts, resolvedThisMonth, unassigned] = await Promise.all([
    JobReport.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    JobReport.countDocuments({ status: 'resolved', updatedAt: { $gte: startOfMonth } }),
    JobReport.countDocuments({ assignedAdminId: null, status: { $nin: TERMINAL_STATUSES } }),
  ]);

  const byStatus = {};
  statusCounts.forEach((s) => { byStatus[s._id] = s.count; });

  return sendSuccess(res, {
    open: byStatus['open'] ?? 0,
    under_review: byStatus['under_review'] ?? 0,
    resolved: byStatus['resolved'] ?? 0,
    dismissed: byStatus['dismissed'] ?? 0,
    resolvedThisMonth,
    unassigned,
    total: await JobReport.countDocuments({}),
  });
});

// ── Detail ────────────────────────────────────────────────────────────────────
const getReportById = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.reportId);
  if (!id) return sendError(res, 'Ugyldig rapport-ID.', 400);

  const report = await JobReport.findById(id)
    .populate('serviceId', 'title description price status images location createdAt')
    .populate('reportedBy', 'name email role avatarUrl accountStatus verified')
    .populate('reportedUser', 'name email role avatarUrl accountStatus verified')
    .populate('assignedAdminId', 'name email')
    .populate('resolvedBy', 'name email')
    .lean();

  if (!report) return sendError(res, 'Rapport ikke funnet.', 404);

  return sendSuccess(res, { report });
});

// ── Assign ────────────────────────────────────────────────────────────────────
const assignReport = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.reportId);
  if (!id) return sendError(res, 'Ugyldig rapport-ID.', 400);

  const report = await JobReport.findById(id);
  if (!report) return sendError(res, 'Rapport ikke funnet.', 404);

  report.assignedAdminId = req.user._id;
  if (report.status === 'open') report.status = 'under_review';
  await report.save();

  return sendSuccess(res, { report: await report.populate('assignedAdminId', 'name email') }, 'Rapport tildelt.');
});

// ── Status update / resolve ───────────────────────────────────────────────────
const updateStatus = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.reportId);
  if (!id) return sendError(res, 'Ugyldig rapport-ID.', 400);

  const { status, note } = req.body;
  if (!status || !JobReport.schema.path('status').enumValues.includes(status)) {
    return sendError(res, 'Ugyldig status.', 400);
  }

  const report = await JobReport.findById(id);
  if (!report) return sendError(res, 'Rapport ikke funnet.', 404);

  report.status = status;
  if (TERMINAL_STATUSES.includes(status)) {
    report.resolutionNote = note || report.resolutionNote || null;
    report.resolvedBy = req.user._id;
    report.resolvedAt = new Date();
  } else {
    report.resolutionNote = null;
    report.resolvedBy = undefined;
    report.resolvedAt = undefined;
  }
  await report.save();

  return sendSuccess(res, { report }, 'Rapportstatus oppdatert.');
});

module.exports = { getReports, getReportsSummary, getReportById, assignReport, updateStatus };
