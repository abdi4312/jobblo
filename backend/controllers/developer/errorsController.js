const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { redactSensitive } = require('../../utils/sanitizer');
const { logActivity } = require('../../services/admin/activityService');
const User = require('../../models/User');
const ErrorLog = require('../../models/ErrorLog');
const { DAY, parseRange, bucketExpr, escapeRegex, pageParams, pagination } = require('../../utils/devQuery');

/** Developer console — grouped backend errors with triage. Read-only unless noted; no exec, no arbitrary queries, no secrets. */

// ── 3. Error monitoring (grouped by errorCode + route + message) ─────────────
const ERROR_GROUP_KEY = { errorCode: '$errorCode', route: '$route', message: '$message' };

const getErrors = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const { page, limit, skip } = pageParams(req.query);
  const match = { createdAt: { $gte: from, $lte: to } };
  if (req.query.severity) match.severity = req.query.severity;
  if (req.query.source) match.source = req.query.source;
  if (req.query.q) {
    const rx = { $regex: escapeRegex(req.query.q), $options: 'i' };
    match.$or = [{ message: rx }, { route: rx }, { errorCode: rx }, { referenceId: rx }, { requestId: rx }];
  }

  const pipeline = [
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: ERROR_GROUP_KEY,
        count: { $sum: 1 },
        firstSeen: { $min: '$createdAt' },
        lastSeen: { $max: '$createdAt' },
        latestId: { $first: '$_id' },
        status: { $first: '$status' },
        severity: { $first: '$severity' },
        source: { $first: '$source' },
        httpMethod: { $first: '$httpMethod' },
        statusCode: { $first: '$statusCode' },
        assignee: { $first: '$assignee' },
        users: { $addToSet: '$userId' },
      },
    },
    ...(req.query.status ? [{ $match: { status: req.query.status } }] : []),
    { $sort: { lastSeen: -1 } },
  ];

  const [result, statusCounts] = await Promise.all([
    ErrorLog.aggregate([
      ...pipeline,
      { $facet: { rows: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
    ]),
    ErrorLog.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $group: { _id: ERROR_GROUP_KEY, status: { $first: '$status' }, severity: { $first: '$severity' } } },
      { $group: { _id: { status: '$status', severity: '$severity' }, n: { $sum: 1 } } },
    ]),
  ]);
  const rows = result[0]?.rows || [];
  const total = result[0]?.total[0]?.n || 0;
  const assignees = await User.find({ _id: { $in: rows.map((r) => r.assignee).filter(Boolean) } })
    .select('name email')
    .lean();
  const byId = Object.fromEntries(assignees.map((u) => [String(u._id), u]));

  return sendSuccess(
    res,
    {
      groups: rows.map((r) => ({
        id: r.latestId,
        errorCode: r._id.errorCode,
        route: r._id.route,
        message: r._id.message,
        count: r.count,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
        status: r.status,
        severity: r.severity,
        source: r.source,
        httpMethod: r.httpMethod,
        statusCode: r.statusCode,
        affectedUsers: r.users.filter(Boolean).length,
        assignee: r.assignee ? byId[String(r.assignee)] || null : null,
      })),
      summary: statusCounts.map((s) => ({ ...s._id, count: s.n })),
    },
    'Errors retrieved.',
    pagination(page, limit, total)
  );
});

async function errorGroupOf(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await ErrorLog.findById(id).lean();
  if (!doc) return null;
  return { doc, filter: { errorCode: doc.errorCode, route: doc.route, message: doc.message } };
}

const getErrorDetail = asyncHandler(async (req, res) => {
  const group = await errorGroupOf(req.params.id);
  if (!group) return sendError(res, 'Error not found.', 404);
  const [latest, occurrences, timeline, notesDoc] = await Promise.all([
    ErrorLog.findOne(group.filter)
      .sort({ createdAt: -1 })
      .populate('assignee', 'name email')
      .populate('resolvedBy', 'name email')
      .lean(),
    ErrorLog.find(group.filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .select('referenceId requestId userId statusCode createdAt environment')
      .lean(),
    ErrorLog.aggregate([
      { $match: { ...group.filter, createdAt: { $gte: new Date(Date.now() - 14 * DAY) } } },
      { $group: { _id: bucketExpr('$createdAt', DAY), count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    ErrorLog.findOne({ ...group.filter, 'notes.0': { $exists: true } })
      .sort({ createdAt: -1 })
      .select('notes')
      .populate('notes.by', 'name')
      .lean(),
  ]);
  // Top stack frame → file / function / line.
  const frame = (latest.stack || '').split('\n').find((l) => /\bat\b.*:\d+:\d+/.test(l));
  const m = frame && frame.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
  return sendSuccess(res, {
    error: { ...latest, metadata: redactSensitive(latest.metadata || {}) },
    location: m ? { fn: m[1] || '(anonymous)', file: m[2], line: Number(m[3]), column: Number(m[4]) } : null,
    occurrences,
    timeline: timeline.map((t) => ({ t: t._id, count: t.count })),
    notes: notesDoc?.notes || [],
  });
});

const ERROR_STATUSES = ['open', 'investigating', 'resolved', 'reopened'];

/** Triage a whole error group: status, assignee, note. Audited. */
const updateError = asyncHandler(async (req, res) => {
  const group = await errorGroupOf(req.params.id);
  if (!group) return sendError(res, 'Error not found.', 404);
  const { status, assignee, note } = req.body || {};
  const set = {};
  if (status !== undefined) {
    if (!ERROR_STATUSES.includes(status)) return sendError(res, 'Invalid status.', 400);
    set.status = status;
    set.resolvedAt = status === 'resolved' ? new Date() : null;
    set.resolvedBy = status === 'resolved' ? req.user._id : null;
  }
  if (assignee !== undefined) {
    if (assignee !== null) {
      const dev = mongoose.isValidObjectId(assignee)
        ? await User.findOne({ _id: assignee, role: { $in: ['developer', 'superAdmin'] } }).select('_id').lean()
        : null;
      if (!dev) return sendError(res, 'Assignee must be a developer.', 400);
    }
    set.assignee = assignee;
  }
  const update = {};
  if (Object.keys(set).length) update.$set = set;
  const text = typeof note === 'string' ? note.trim().slice(0, 2000) : '';
  if (!update.$set && !text) return sendError(res, 'Nothing to update.', 400);

  if (update.$set) await ErrorLog.updateMany(group.filter, update);
  // Notes live on the latest occurrence so they are not copied N times.
  if (text) {
    await ErrorLog.updateOne(
      { _id: group.doc._id },
      { $push: { notes: { by: req.user._id, text, at: new Date() } } }
    );
  }

  await logActivity({
    adminId: req.user._id,
    action: 'other',
    description: `Developer triaged error ${group.doc.errorCode} ${group.doc.route || ''}`.trim(),
    metadata: { area: 'developer.errors', errorId: String(group.doc._id), status, assignee, noted: Boolean(text) },
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown',
  });
  return sendSuccess(res, {}, 'Error updated.');
});

module.exports = { getErrors, getErrorDetail, updateError };
