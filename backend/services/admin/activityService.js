const AdminActivity = require('../../models/AdminActivity');

/**
 * Log an admin action safely.
 * Failure to log must never break the main operation.
 *
 * @param {object} options
 * @param {string} options.adminId - ID of the acting admin
 * @param {string} options.action - Action enum value
 * @param {string} options.targetModel - Model name affected
 * @param {string|null} options.targetId - ID of the affected document
 * @param {string} options.description - Human-readable description
 * @param {object} options.metadata - Safe, non-sensitive extra data
 * @param {string} options.ip - Request IP address
 * @param {string} options.userAgent - Request user-agent string
 */
const logActivity = async ({
  adminId,
  action,
  targetModel = 'other',
  targetId = null,
  description,
  metadata = {},
  ip = 'unknown',
  userAgent = 'unknown',
}) => {
  try {
    // Sanitize metadata — strip any sensitive keys before saving
    const FORBIDDEN_KEYS = [
      'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
      'authorization', 'secret', 'apiKey', 'cardNumber', 'cvv', 'privateKey',
    ];

    const safeMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([key]) => {
        return !FORBIDDEN_KEYS.some((forbidden) =>
          key.toLowerCase().includes(forbidden.toLowerCase())
        );
      })
    );

    await AdminActivity.create({
      adminId,
      action,
      targetModel,
      targetId: targetId || null,
      description: description.substring(0, 500),
      metadata: safeMetadata,
      ip: ip.substring(0, 50),
      userAgent: userAgent.substring(0, 300),
    });
  } catch (err) {
    // Log to server only — never propagate to the calling request
    console.error('[ActivityService] Failed to save activity log:', err.message);
  }
};

module.exports = { logActivity };
