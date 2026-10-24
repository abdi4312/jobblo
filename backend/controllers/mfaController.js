const mfa = require('../services/auth/mfa');
const { logActivity } = require('../services/admin/activityService');

/** Authenticator-app 2FA endpoints. The session may be unverified here (see middleware/auth.js). */

const audit = (req, userId, description, metadata = {}) =>
  logActivity({ adminId: req.user._id, action: 'other', targetModel: 'User', targetId: userId, description, metadata: { area: 'auth.mfa', ...metadata }, ip: req.ip, userAgent: req.get('user-agent') || 'unknown' });

exports.status = async (req, res) => {
  const Session = require('../models/Session');
  const session = await Session.findById(req.sessionId).select('mfaVerifiedAt').lean();
  res.json({ required: mfa.requiresMfa(req.user), enabled: Boolean(req.user.mfaEnabledAt), verified: Boolean(session?.mfaVerifiedAt) });
};

exports.setup = async (req, res) => {
  try {
    res.json(await mfa.startSetup(req.user._id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, message: err.message });
  }
};

exports.verify = async (req, res) => {
  const { code, backupCode } = req.body || {};
  if (!code && !backupCode) return res.status(400).json({ error: 'Code required', message: 'Enter the 6-digit code from your authenticator app.' });
  try {
    const wasEnabled = Boolean(req.user.mfaEnabledAt);
    const r = await mfa.verify(req.user._id, req.sessionId, { code, backupCode });
    if (!r.ok) {
      audit(req, req.user._id, 'Two-factor code rejected', { backup: Boolean(backupCode) });
      // 400, not 401: the session is fine, the code is not — a 401 makes clients refresh and resend it.
      return res.status(400).json({ error: 'Invalid code', message: backupCode ? 'That backup code is not valid or was already used.' : 'Wrong or expired code. Check the time on your phone and try the newest code.', code: 'MFA_INVALID' });
    }
    audit(req, req.user._id, wasEnabled ? (backupCode ? `Signed in with a backup code (${r.backupCodesLeft} left)` : 'Two-factor code accepted') : 'Authenticator app set up');
    res.json({ verified: true, backupCodes: r.backupCodes, backupCodesLeft: r.backupCodesLeft });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, message: err.message });
  }
};

/** Super Admin: remove another user's authenticator (lost phone). They re-enrol at next sign-in. */
exports.resetForUser = async (req, res) => {
  const { id } = req.params;
  if (!require('mongoose').isValidObjectId(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (String(id) === String(req.user._id)) return res.status(403).json({ error: 'Ask another Super Admin to reset your own authenticator.' });
  const target = await require('../models/User').findById(id).select('email role mfaEnabledAt').lean();
  if (!target) return res.status(404).json({ error: 'User not found' });
  await mfa.reset(id);
  audit(req, id, `Reset authenticator app for ${target.email} (all sessions signed out)`, { role: target.role, hadAuthenticator: Boolean(target.mfaEnabledAt) });
  res.json({ message: 'Authenticator removed; the user sets up a new one at next sign-in.' });
};
