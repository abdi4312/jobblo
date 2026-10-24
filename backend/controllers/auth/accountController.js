const User = require('../../models/User');
const Session = require('../../models/Session');
const { OWN_USER_SELECT, sanitizeUserOwner } = require('../../utils/userProjections');
const { CURRENT_TERMS_VERSION, sanitizeSession, sendServerError } = require('./authHelpers');

/** Signed-in account: sessions (list / revoke), profile and terms acceptance. */

exports.getSessions = async (req, res) => {
  try {
    const currentSessionId = req.sessionId;
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessions = await Session.find({ userId })
      .select('-refreshToken -oldRefreshToken -__v')
      .sort({ lastUsed: -1 });

    return res.json(sessions.map((session) => sanitizeSession(session, currentSessionId)));
  } catch (error) {
    return sendServerError(res, error, 'Get sessions failed');
  }
};

exports.revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await Session.deleteOne({
      _id: sessionId,
      userId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        error: 'Session not found or unauthorized',
      });
    }

    return res.json({ message: 'Session revoked' });
  } catch (error) {
    return sendServerError(res, error, 'Revoke session failed');
  }
};

exports.revokeAllOtherSessions = async (req, res) => {
  try {
    const currentSessionId = req.sessionId;
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await Session.deleteMany({
      userId,
      _id: { $ne: currentSessionId },
    });

    return res.json({
      message: `Revoked ${result.deletedCount} other sessions`,
      count: result.deletedCount,
    });
  } catch (error) {
    return sendServerError(res, error, 'Revoke all other sessions failed');
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId).select(OWN_USER_SELECT);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(sanitizeUserOwner(user));
  } catch (error) {
    return sendServerError(res, error, 'Get profile failed');
  }
};

exports.acceptTerms = async (req, res) => {
  try {
    const userId = req.user?._id || req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        acceptedTerms: true,
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: new Date(),
      },
      { new: true }
    ).select(OWN_USER_SELECT);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: sanitizeUserOwner(updatedUser),
      acceptedTerms: true,
      termsVersion: CURRENT_TERMS_VERSION,
    });
  } catch (error) {
    return sendServerError(res, error, 'Accept terms failed');
  }
};
