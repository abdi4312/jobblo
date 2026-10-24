const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const User = require('../../models/User');
const Order = require('../../models/Order');
const ErrorLog = require('../../models/ErrorLog');
const Incident = require('../../models/Incident');
const SupportTicket = require('../../models/SupportTicket');
const { HOUR, rx, isId, pageParams, pagination, groupCount, audit } = require('../../utils/devQuery');

/** Developer console — support & technical tickets with SLA. */

// ── 17. Support & technical tickets ─────────────────────────────────────────
const SLA_HOURS = { critical: 4, high: 24, medium: 72, low: 168 };
const slaOf = (t) => {
  const due = new Date(new Date(t.createdAt).getTime() + SLA_HOURS[t.priority || 'medium'] * HOUR);
  const done = ['resolved', 'closed'].includes(t.status);
  return { dueAt: due, breached: !done && Date.now() > due.getTime(), metAt: done ? t.resolvedAt || t.updatedAt : null };
};
const maskEmail = (e) => require('../../services/monitoring/securityEvents').maskEmail(e);

const getTickets = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const match = {};
  if (req.query.status) match.status = req.query.status;
  if (req.query.priority) match.priority = req.query.priority;
  if (req.query.assignee === 'me') match.assignee = req.user._id;
  else if (isId(req.query.assignee)) match.assignee = req.query.assignee;
  if (req.query.escalated === 'true') match.escalated = true;
  if (req.query.q) {
    const q = String(req.query.q).slice(0, 100);
    match.$or = [{ subject: rx(q) }, { message: rx(q) }, ...(isId(q) ? [{ _id: q }, { userId: q }, { orderId: q }] : [])];
  }
  const [rows, total, byStatus, byPriority, openTickets] = await Promise.all([
    SupportTicket.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('assignee', 'name').select('-history -message').lean(),
    SupportTicket.countDocuments(match),
    groupCount(SupportTicket, 'status'),
    groupCount(SupportTicket, 'priority', { status: { $in: ['open', 'in_progress'] } }),
    SupportTicket.find({ status: { $in: ['open', 'in_progress'] } }).select('createdAt priority status').lean(),
  ]);
  return sendSuccess(
    res,
    {
      summary: { byStatus, byPriority, breached: openTickets.filter((t) => slaOf(t).breached).length, escalated: await SupportTicket.countDocuments({ escalated: true, status: { $in: ['open', 'in_progress'] } }) },
      slaHours: SLA_HOURS,
      tickets: rows.map((t) => ({ ...t, email: maskEmail(t.email), sla: slaOf(t) })),
    },
    'Tickets retrieved.',
    pagination(page, limit, total)
  );
});

const getTicket = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const t = await SupportTicket.findById(req.params.id).populate('assignee', 'name').populate('history.by', 'name').populate('userId', 'name role accountStatus').lean();
  if (!t) return sendError(res, 'Ticket not found.', 404);
  const [order, error, incident] = await Promise.all([
    t.orderId ? Order.findById(t.orderId).select('status paymentStatus updatedAt').lean() : null,
    t.relatedErrorRef ? ErrorLog.findOne({ referenceId: t.relatedErrorRef }).select('referenceId errorCode message route createdAt status').lean() : null,
    t.incidentId ? Incident.findById(t.incidentId).select('title status severity').lean() : null,
  ]);
  return sendSuccess(res, { ticket: { ...t, email: maskEmail(t.email), sla: slaOf(t) }, order, error, incident });
});

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const updateTicket = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const t = await SupportTicket.findById(req.params.id);
  if (!t) return sendError(res, 'Ticket not found.', 404);
  const { status, priority, assignee, escalated, note, relatedErrorRef, incidentId } = req.body || {};
  const by = req.user._id;
  const changes = [];
  if (status !== undefined && status !== t.status) {
    if (!TICKET_STATUSES.includes(status)) return sendError(res, 'Invalid status.', 400);
    t.history.push({ by, kind: 'status', text: `${t.status} → ${status}` });
    t.status = status;
    t.resolvedAt = ['resolved', 'closed'].includes(status) ? new Date() : null;
    changes.push('status');
  }
  if (priority !== undefined && priority !== t.priority) {
    if (!PRIORITIES.includes(priority)) return sendError(res, 'Invalid priority.', 400);
    t.history.push({ by, kind: 'priority', text: `${t.priority} → ${priority}` });
    t.priority = priority;
    changes.push('priority');
  }
  if (assignee !== undefined) {
    if (assignee !== null) {
      const dev = isId(assignee) ? await User.findOne({ _id: assignee, role: { $in: ['developer', 'superAdmin'] } }).select('name').lean() : null;
      if (!dev) return sendError(res, 'Assignee must be a developer.', 400);
      t.history.push({ by, kind: 'assign', text: `Assigned to ${dev.name}` });
    } else t.history.push({ by, kind: 'assign', text: 'Unassigned' });
    t.assignee = assignee;
    changes.push('assignee');
  }
  if (escalated === true && !t.escalated) {
    t.escalated = true;
    t.history.push({ by, kind: 'escalate', text: 'Escalated' });
    changes.push('escalated');
  }
  if (relatedErrorRef !== undefined) {
    const ref = relatedErrorRef ? String(relatedErrorRef).trim().slice(0, 60) : null;
    if (ref && !(await ErrorLog.exists({ referenceId: ref }))) return sendError(res, 'No error with that reference.', 400);
    t.relatedErrorRef = ref;
    t.history.push({ by, kind: 'link', text: ref ? `Linked error ${ref}` : 'Unlinked error' });
    changes.push('error');
  }
  if (incidentId !== undefined) {
    if (incidentId !== null && !(isId(incidentId) && (await Incident.exists({ _id: incidentId })))) return sendError(res, 'Incident not found.', 400);
    t.incidentId = incidentId;
    t.history.push({ by, kind: 'link', text: incidentId ? `Linked incident ${incidentId}` : 'Unlinked incident' });
    changes.push('incident');
  }
  const text = typeof note === 'string' ? note.trim().slice(0, 2000) : '';
  if (text) {
    t.history.push({ by, kind: 'note', text, internal: true });
    changes.push('note');
  }
  if (!changes.length) return sendError(res, 'Nothing to update.', 400);
  await t.save();
  await audit(req, `Developer updated support ticket (${changes.join(', ')})`, { area: 'developer.tickets', ticketId: String(t._id), changes });
  return sendSuccess(res, {}, 'Ticket updated.');
});

module.exports = { SLA_HOURS, slaOf, maskEmail, getTickets, getTicket, TICKET_STATUSES, PRIORITIES, updateTicket };
