const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const { clientIp } = require('../../services/monitoring/securityEvents');
const stepUp = require('../../services/developer/stepUp');
const { ACTIONS } = require('../../services/developer/sensitiveActions');
const ChangeRequest = require('../../models/ChangeRequest');

/**
 * Access model for the developer dashboard:
 *   readonly   — view everything, change nothing
 *   operations — day-to-day triage; sensitive actions only as approval requests
 *   superAdmin — executes sensitive actions directly and approves others' requests
 * Every sensitive action also needs step-up authentication (see services/developer/stepUp).
 * Actions marked selfService (IP block/unblock) run directly for operations developers too.
 */

const REQUEST_TTL_MS = 24 * 60 * 60 * 1000;
const RANK = { readonly: 0, operations: 1, superAdmin: 2 };
const accessOf = (user) => (user.role === 'superAdmin' ? 'superAdmin' : user.developerAccess || 'readonly');
const hasAccess = (user, min) => RANK[accessOf(user)] >= RANK[min];
const requireAccess = (min) => (req, res, next) =>
  hasAccess(req.user, min) ? next() : sendError(res, min === 'superAdmin' ? 'Only a Super Admin can do this.' : 'Read-only developers cannot make changes.', 403);
const isId = (v) => mongoose.isValidObjectId(v) && String(v).length === 24;
const audit = (req, description, metadata) =>
  logActivity({ adminId: req.user._id, action: 'other', description, metadata: { area: 'developer.approvals', ...metadata }, ip: req.ip, userAgent: req.get('user-agent') || 'unknown' });

const getMe = asyncHandler(async (req, res) => {
  const access = accessOf(req.user);
  return sendSuccess(res, {
    _id: req.user._id,
    name: req.user.name,
    role: req.user.role,
    access,
    environment: process.env.NODE_ENV || 'development',
    can: {
      triage: hasAccess(req.user, 'operations'),
      request: access === 'operations',
      execute: access === 'superAdmin',
      approve: access === 'superAdmin',
    },
  });
});

const sendStepUp = asyncHandler(async (req, res) => {
  try {
    await stepUp.sendCode(req.user);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
  await audit(req, 'Requested step-up code', {});
  return sendSuccess(res, { sentTo: require('../../services/monitoring/securityEvents').maskEmail(req.user.email) }, 'Code sent.');
});

const verifyStepUp = asyncHandler(async (req, res) => {
  try {
    const result = await stepUp.verifyCode(req.user, req.sessionId, req.body?.code);
    await audit(req, 'Completed step-up authentication', {});
    return sendSuccess(res, result, 'Confirmed.');
  } catch (err) {
    await audit(req, 'Failed step-up authentication', { reason: err.message });
    return sendError(res, err.message, err.status || 500);
  }
});

const readReason = (body) => (typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) : '');

/** Super Admin: execute now. Operations: open an approval request. Readonly: refused by route. */
const submitAction = asyncHandler(async (req, res) => {
  const action = ACTIONS[req.params.type];
  if (!action) return sendError(res, 'Unknown action.', 404);
  const reason = readReason(req.body);
  if (reason.length < 5) return sendError(res, 'A reason (5+ characters) is required.', 400);
  let payload;
  try {
    payload = await action.prepare(req.body?.input || {}, { actor: req.user._id });
  } catch (err) {
    return sendError(res, err.message, err.status || 400);
  }
  const summary = action.summary(payload);
  // Risk is scored before anything is applied. Scoring must never block a change by failing.
  const risk = await require('../../services/monitoring/changeRisk')
    .assessAction(req.params.type, payload, { requesterIp: clientIp(req) })
    .catch(() => null);

  if (accessOf(req.user) === 'superAdmin' || action.selfService) {
    // A critical-risk change needs an explicit second click after the reasons were shown.
    if (risk?.level === 'critical' && req.body?.acknowledgeRisk !== true) {
      return res.status(409).json({ success: false, code: 'RISK_CONFIRM', message: `Risk ${risk.score}/100 (critical). Review the reasons and confirm.`, data: { risk, summary } });
    }
    try {
      await action.execute(payload, { actor: req.user._id, actorIp: clientIp(req), reason });
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
    await audit(req, `${summary} (${reason})`, { type: req.params.type, direct: true, key: payload.key, environment: process.env.NODE_ENV || 'development', after: payload.enabled, risk: risk && { score: risk.score, level: risk.level, acknowledged: req.body?.acknowledgeRisk === true } });
    return sendSuccess(res, { executed: true, summary, risk }, 'Done.');
  }

  const request = await ChangeRequest.create({
    type: req.params.type,
    summary,
    payload: { ...payload, requesterIp: clientIp(req) },
    reason,
    requestedBy: req.user._id,
    expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
    risk,
  });
  await audit(req, `Requested approval: ${summary} (${reason})`, { type: req.params.type, requestId: String(request._id) });
  return sendSuccess(res, { executed: false, requestId: request._id, summary, risk }, 'Sent for Super Admin approval.', null, 201);
});

const listApprovals = asyncHandler(async (req, res) => {
  await ChangeRequest.updateMany({ status: 'pending', expiresAt: { $lte: new Date() } }, { $set: { status: 'expired' } });
  const match = {};
  if (req.query.status) match.status = req.query.status;
  if (req.query.mine === 'true') match.requestedBy = req.user._id;
  const [requests, pending] = await Promise.all([
    ChangeRequest.find(match).sort({ createdAt: -1 }).limit(200).populate('requestedBy reviewedBy', 'name role').lean(),
    ChangeRequest.countDocuments({ status: 'pending' }),
  ]);
  return sendSuccess(res, { pending, requests: requests.map((r) => ({ ...r, payload: { ...r.payload, requesterIp: undefined } })) });
});

async function loadPending(id) {
  if (!isId(id)) return { error: ['Invalid request.', 400] };
  const r = await ChangeRequest.findById(id);
  if (!r) return { error: ['Request not found.', 404] };
  if (r.status !== 'pending') return { error: [`Request is already ${r.status}.`, 409] };
  if (r.expiresAt <= new Date()) {
    r.status = 'expired';
    await r.save();
    return { error: ['Request expired.', 409] };
  }
  return { r };
}

const approve = asyncHandler(async (req, res) => {
  const { r, error } = await loadPending(req.params.id);
  if (error) return sendError(res, ...error);
  if (String(r.requestedBy) === String(req.user._id)) return sendError(res, 'You cannot approve your own request.', 403);
  const action = ACTIONS[r.type];
  if (r.risk?.level === 'critical' && req.body?.acknowledgeRisk !== true) {
    return res.status(409).json({ success: false, code: 'RISK_CONFIRM', message: `Risk ${r.risk.score}/100 (critical). Review the reasons and confirm.`, data: { risk: r.risk, summary: r.summary } });
  }
  r.reviewedBy = req.user._id;
  r.reviewedAt = new Date();
  r.reviewNote = readReason({ reason: req.body?.note }) || null;
  try {
    await action.execute(r.payload, { actor: req.user._id, actorIp: clientIp(req), requesterIp: r.payload.requesterIp, reason: r.reason, approvedVia: r._id });
    r.status = 'executed';
    r.executedAt = new Date();
  } catch (err) {
    r.status = 'failed';
    r.error = String(err.message).slice(0, 300);
  }
  await r.save();
  await audit(req, `Approved: ${r.summary} → ${r.status}`, { requestId: String(r._id), type: r.type, requestedBy: String(r.requestedBy), key: r.payload.key, environment: r.environment, after: r.payload.enabled });
  return r.status === 'executed' ? sendSuccess(res, { status: r.status }, 'Approved and executed.') : sendError(res, `Approved, but execution failed: ${r.error}`, 409);
});

const reject = asyncHandler(async (req, res) => {
  const { r, error } = await loadPending(req.params.id);
  if (error) return sendError(res, ...error);
  r.status = 'rejected';
  r.reviewedBy = req.user._id;
  r.reviewedAt = new Date();
  r.reviewNote = readReason({ reason: req.body?.note }) || null;
  await r.save();
  await audit(req, `Rejected: ${r.summary}`, { requestId: String(r._id), type: r.type });
  return sendSuccess(res, {}, 'Rejected.');
});

const cancel = asyncHandler(async (req, res) => {
  const { r, error } = await loadPending(req.params.id);
  if (error) return sendError(res, ...error);
  if (String(r.requestedBy) !== String(req.user._id)) return sendError(res, 'Only the requester can cancel.', 403);
  r.status = 'cancelled';
  await r.save();
  await audit(req, `Cancelled request: ${r.summary}`, { requestId: String(r._id) });
  return sendSuccess(res, {}, 'Cancelled.');
});

module.exports = { accessOf, hasAccess, requireAccess, getMe, sendStepUp, verifyStepUp, submitAction, listApprovals, approve, reject, cancel };
