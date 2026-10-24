const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const privacy = require('../../services/monitoring/privacy');

/** Developer dashboard — privacy & data lifecycle. Overview is read-only; exports are Super Admin + step-up + audited. */

const getPrivacy = asyncHandler(async (req, res) => sendSuccess(res, await privacy.overview()));

const exportUserData = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const reason = String(req.body?.reason || '').trim();
  if (!mongoose.isValidObjectId(userId)) return sendError(res, 'Invalid user.', 400);
  if (reason.length < 10) return sendError(res, 'Give the reason (e.g. the support ticket of the access request), at least 10 characters.', 400);
  const data = await privacy.exportUser(userId);
  if (!data) return sendError(res, 'User not found.', 404);
  logActivity({
    adminId: req.user._id,
    action: 'other',
    targetModel: 'User',
    targetId: userId,
    description: `Exported personal data (subject access request): ${reason.slice(0, 200)}`,
    metadata: { area: 'developer.privacy', reason: reason.slice(0, 500), sections: Object.keys(data) },
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown',
  });
  res.setHeader('Content-Disposition', `attachment; filename="jobblo-data-${userId}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.json(data);
});

module.exports = { getPrivacy, exportUserData };
