const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const User = require('../../models/User');
const ErrorLog = require('../../models/ErrorLog');
const Incident = require('../../models/Incident');
const SupportTicket = require('../../models/SupportTicket');
const { MINUTE, DAY, isId, pageParams, pagination, groupCount, audit } = require('../../utils/devQuery');

/** Developer console — incidents: list, detail, create and triage (operations). */

// ── 25. Incidents ───────────────────────────────────────────────────────────
const getIncidents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const match = {};
  if (req.query.status) match.status = req.query.status;
  else if (req.query.active !== 'false') match.status = { $ne: 'resolved' };
  if (req.query.severity) match.severity = req.query.severity;
  const since = new Date(Date.now() - 30 * DAY);
  const [rows, total, resolved, repeats, byService] = await Promise.all([
    Incident.find(match).sort({ startedAt: -1 }).skip(skip).limit(limit).populate('assignee', 'name').select('-timeline -postmortem').lean(),
    Incident.countDocuments(match),
    Incident.find({ resolvedAt: { $gte: since } }).select('startedAt acknowledgedAt resolvedAt').lean(),
    Incident.aggregate([{ $match: { fingerprint: { $ne: null }, startedAt: { $gte: since } } }, { $group: { _id: '$fingerprint', n: { $sum: 1 }, title: { $last: '$title' } } }, { $match: { n: { $gt: 1 } } }, { $sort: { n: -1 } }]),
    groupCount(Incident, 'service', { status: { $ne: 'resolved' } }),
  ]);
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return sendSuccess(
    res,
    {
      metrics: {
        open: await Incident.countDocuments({ status: 'open' }),
        acknowledged: await Incident.countDocuments({ status: 'acknowledged' }),
        mttaMinutes: avg(resolved.filter((i) => i.acknowledgedAt).map((i) => (new Date(i.acknowledgedAt) - new Date(i.startedAt)) / MINUTE)),
        mttrMinutes: avg(resolved.map((i) => (new Date(i.resolvedAt) - new Date(i.startedAt)) / MINUTE)),
        resolved30d: resolved.length,
      },
      repeats: repeats.map((r) => ({ fingerprint: r._id, count: r.n, title: r.title })),
      byService,
      incidents: rows,
      notifications: { slack: Boolean(process.env.SLACK_WEBHOOK_URL), email: Boolean(process.env.DEV_ALERT_EMAIL) },
    },
    'Incidents retrieved.',
    pagination(page, limit, total)
  );
});

const getIncident = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const inc = await Incident.findById(req.params.id).populate('assignee acknowledgedBy resolvedBy timeline.by', 'name').lean();
  if (!inc) return sendError(res, 'Incident not found.', 404);
  const window = { $gte: new Date(new Date(inc.startedAt).getTime() - 15 * MINUTE), $lte: inc.resolvedAt || new Date() };
  const [errors, tickets] = await Promise.all([
    ErrorLog.aggregate([
      { $match: { createdAt: window, ...(inc.relatedErrorCodes?.length ? { errorCode: { $in: inc.relatedErrorCodes } } : {}) } },
      { $group: { _id: { errorCode: '$errorCode', route: '$route' }, n: { $sum: 1 }, id: { $last: '$_id' }, last: { $max: '$createdAt' } } },
      { $sort: { n: -1 } },
      { $limit: 10 },
    ]),
    SupportTicket.find({ incidentId: inc._id }).select('subject status priority createdAt').lean(),
  ]);
  return sendSuccess(res, { incident: inc, relatedErrors: errors.map((e) => ({ id: e.id, errorCode: e._id.errorCode, route: e._id.route, count: e.n, last: e.last })), tickets });
});

const INCIDENT_STATUSES = ['open', 'acknowledged', 'resolved'];
const SEVERITIES = ['critical', 'high', 'medium', 'low'];

const createIncident = asyncHandler(async (req, res) => {
  const { title, severity = 'medium', service, detail } = req.body || {};
  if (!title || String(title).trim().length < 4) return sendError(res, 'Title is required.', 400);
  if (!SEVERITIES.includes(severity)) return sendError(res, 'Invalid severity.', 400);
  const inc = await Incident.create({
    title: String(title).trim().slice(0, 200),
    severity,
    service: service ? String(service).slice(0, 40) : null,
    detail: detail ? String(detail).slice(0, 1000) : null,
    source: 'manual',
    timeline: [{ kind: 'opened', by: req.user._id, text: 'Opened manually' }],
  });
  await audit(req, `Developer opened incident: ${inc.title}`, { area: 'developer.incidents', incidentId: String(inc._id), severity });
  return sendSuccess(res, { incident: inc }, 'Incident created.', null, 201);
});

const updateIncident = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const inc = await Incident.findById(req.params.id);
  if (!inc) return sendError(res, 'Incident not found.', 404);
  const { status, severity, assignee, note, resolutionNotes, postmortem } = req.body || {};
  const by = req.user._id;
  const changes = [];
  if (status !== undefined && status !== inc.status) {
    if (!INCIDENT_STATUSES.includes(status)) return sendError(res, 'Invalid status.', 400);
    if (status === 'resolved' && !(resolutionNotes || inc.resolutionNotes)) return sendError(res, 'Resolution notes are required to resolve.', 400);
    inc.timeline.push({ by, kind: 'status', text: `${inc.status} → ${status}` });
    if (status === 'acknowledged' && !inc.acknowledgedAt) Object.assign(inc, { acknowledgedAt: new Date(), acknowledgedBy: by });
    if (status === 'resolved') Object.assign(inc, { resolvedAt: new Date(), resolvedBy: by, acknowledgedAt: inc.acknowledgedAt || new Date(), acknowledgedBy: inc.acknowledgedBy || by });
    if (status === 'open') Object.assign(inc, { resolvedAt: null, resolvedBy: null });
    inc.status = status;
    changes.push('status');
  }
  if (severity !== undefined && severity !== inc.severity) {
    if (!SEVERITIES.includes(severity)) return sendError(res, 'Invalid severity.', 400);
    inc.timeline.push({ by, kind: 'escalate', text: `Severity ${inc.severity} → ${severity}` });
    inc.severity = severity;
    changes.push('severity');
  }
  if (assignee !== undefined) {
    if (assignee !== null && !(isId(assignee) && (await User.exists({ _id: assignee, role: { $in: ['developer', 'superAdmin'] } })))) return sendError(res, 'Assignee must be a developer.', 400);
    inc.assignee = assignee;
    inc.timeline.push({ by, kind: 'assign', text: assignee ? 'Responder assigned' : 'Responder removed' });
    changes.push('assignee');
  }
  if (typeof resolutionNotes === 'string') {
    inc.resolutionNotes = resolutionNotes.trim().slice(0, 4000);
    changes.push('resolution');
  }
  if (typeof postmortem === 'string') {
    inc.postmortem = postmortem.trim().slice(0, 10000);
    changes.push('postmortem');
  }
  const text = typeof note === 'string' ? note.trim().slice(0, 2000) : '';
  if (text) {
    inc.timeline.push({ by, kind: 'note', text });
    changes.push('note');
  }
  if (!changes.length) return sendError(res, 'Nothing to update.', 400);
  await inc.save();
  await audit(req, `Developer updated incident "${inc.title}" (${changes.join(', ')})`, { area: 'developer.incidents', incidentId: String(inc._id), changes });
  return sendSuccess(res, {}, 'Incident updated.');
});

module.exports = { getIncidents, getIncident, INCIDENT_STATUSES, SEVERITIES, createIncident, updateIncident };
