const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const risk = require('../../services/monitoring/changeRisk');
const { ACTIONS } = require('../../services/developer/sensitiveActions');
const { clientIp } = require('../../services/monitoring/securityEvents');

/** Developer dashboard — change risk analyzer. Read-only previews; nothing is applied here. */

const getRisk = asyncHandler(async (req, res) => {
  const [environment, requests, direct] = await Promise.all([
    risk.environment(),
    require('../../models/ChangeRequest').find({ risk: { $ne: null } }).sort({ createdAt: -1 }).limit(30).populate('requestedBy', 'name').populate('reviewedBy', 'name').select('type summary status risk createdAt requestedBy reviewedBy').lean(),
    // Super Admin actions run directly (no ChangeRequest); their score is in the audit entry.
    require('../../models/AdminActivity').find({ 'metadata.risk': { $exists: true, $ne: null } }).sort({ createdAt: -1 }).limit(30).populate('adminId', 'name').select('description metadata createdAt adminId').lean(),
  ]);
  const rows = [
    ...requests,
    ...direct.map((a) => ({ _id: String(a._id), type: a.metadata.type, summary: a.description, status: 'executed', direct: true, createdAt: a.createdAt, requestedBy: a.adminId, risk: { factors: [], mitigations: [], ...a.metadata.risk } })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sendSuccess(res, { now: risk.combine(environment), requests: rows.slice(0, 40) });
});

const assess = asyncHandler(async (req, res) => {
  const b = req.body || {};
  let result;
  if (b.kind === 'action') {
    const action = ACTIONS[b.type];
    if (!action) return sendError(res, 'Unknown action type.', 400);
    let payload;
    try {
      payload = await action.prepare(b.input || {}, { actor: req.user._id });
    } catch (err) {
      return sendError(res, err.message, err.status || 400);
    }
    result = { ...(await risk.assessAction(b.type, payload, { requesterIp: clientIp(req) })), subject: action.summary(payload) };
  } else if (b.kind === 'role') {
    if (!mongoose.isValidObjectId(b.userId) || !['user', 'provider', 'company', 'developer', 'superAdmin'].includes(b.role)) return sendError(res, 'Give a user id and a role.', 400);
    result = await risk.assessRole({ userId: b.userId, role: b.role });
    if (!result) return sendError(res, 'User not found.', 404);
  } else if (b.kind === 'stripe_mode') {
    result = await risk.assessStripeMode({ toTest: b.mode === 'test' });
  } else if (b.kind === 'deployment') {
    result = await risk.assessDeployment({ ref: b.ref });
    if (result.error) return sendError(res, result.error, 400);
  } else {
    return sendError(res, 'kind must be action, role, stripe_mode or deployment.', 400);
  }
  return sendSuccess(res, result);
});

module.exports = { getRisk, assess };
