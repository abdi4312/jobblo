const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const connect = require('../../services/monitoring/connectHealth');

/** Developer dashboard — Stripe Connect health. */
const getConnectHealth = asyncHandler(async (req, res) => sendSuccess(res, await connect.scan({ force: req.query.refresh === 'true' })));

const getConnectProvider = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return sendError(res, 'Invalid id.', 400);
  const d = await connect.providerDetail(req.params.userId);
  if (!d) return sendError(res, 'User not found.', 404);
  return sendSuccess(res, d);
});

/** Resync one provider's payout flags from Stripe (operations access, audited). Changes only our cached flags. */
const resyncProvider = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return sendError(res, 'Invalid id.', 400);
  const r = await connect.resync(req.params.userId);
  if (r.error) return sendError(res, r.error, 400);
  await logActivity({
    adminId: req.user._id,
    action: 'other',
    targetModel: 'User',
    targetId: req.params.userId,
    description: 'Developer resynced Stripe Connect flags from Stripe',
    metadata: { area: 'developer.connect', before: r.before, after: r.after },
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown',
  });
  return sendSuccess(res, r, 'Resynced from Stripe.');
});

module.exports = { getConnectHealth, getConnectProvider, resyncProvider };
