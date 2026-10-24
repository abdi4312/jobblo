const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const drift = require('../../services/monitoring/configDrift');

/** Developer dashboard — configuration drift. Values never leave the server. */
const getConfigDrift = asyncHandler(async (req, res) => sendSuccess(res, await drift.getDrift({ force: req.query.refresh === 'true' })));

/** Accept the running configuration as the new baseline (operations access, audited). */
const acceptBaseline = asyncHandler(async (req, res) => {
  const snap = await drift.acceptBaseline(req.user._id, req.body?.note);
  await logActivity({
    adminId: req.user._id,
    action: 'other',
    description: 'Developer accepted the running configuration as the drift baseline',
    metadata: { area: 'developer.config-drift', digest: snap.digest, note: snap.note },
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown',
  });
  return sendSuccess(res, { digest: snap.digest, at: snap.at }, 'Baseline accepted.');
});

module.exports = { getConfigDrift, acceptBaseline };
