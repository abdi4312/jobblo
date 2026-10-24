const User = require('../models/User');
const Session = require('../models/Session');
const { verifyToken, deviceNameFrom } = require('../utils/tokenUtils');

/**
 * Middleware to authenticate JWT tokens
 * Extracts and verifies JWT token from cookies or Authorization header
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticate = async (req, res, next) => {
  try {
    // Try to get token from cookie first, then from Authorization header
    let token = req.cookies.accessToken || req.cookies.token;
    const refreshToken = req.cookies.refreshToken;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in',
        code: 'TOKEN_MISSING',
      });
    }

    // Verify token
    // Purpose-checked: a refresh token (cookie or Bearer) is rejected here.
    let decoded;
    try {
      decoded = verifyToken(token, 'access');
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Please log in again or refresh token',
          code: 'TOKEN_EXPIRED',
        });
      }
      throw err;
    }

    // CRITICAL: Check if the session still exists in DB using the session ID (sid) from token
    const sessionId = decoded.sid;
    if (!sessionId) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Session information missing from token',
      });
    }

    const sessionExists = await Session.findOne({
      _id: sessionId,
      userId: decoded.id,
    });

    if (!sessionExists) {
      // Clear cookies if session is invalid or revoked
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
      return res.status(401).json({
        error: 'Session revoked',
        message: 'Your session has been terminated or is invalid',
        code: 'SESSION_REVOKED',
      });
    }

    // Update session lastUsed. The app's device model is filled in here too, so sessions
    // created before the app sent it, or by an OAuth login in the browser, get it as well.
    sessionExists.lastUsed = new Date();
    const deviceName = deviceNameFrom(req);
    if (deviceName && sessionExists.deviceName !== deviceName) sessionExists.deviceName = deviceName;
    await sessionExists.save();

    // Fetch user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'Invalid authentication token',
      });
    }

    if (
      user.accountStatus === 'inactive' ||
      user.accountStatus === 'deactivated' ||
      user.isDeleted
    ) {
      return res.status(403).json({
        error: 'Account inactive',
        message: 'Kontoen din er deaktivert.',
        code: 'account_inactive',
      });
    }

    // Superadmins and developers must pass the authenticator code on this session before
    // anything else works — whichever way they signed in. Only the 2FA screens, their own
    // profile (so the app knows who they are) and logout stay open.
    if (require('../services/auth/mfa').requiresMfa(user) && !sessionExists.mfaVerifiedAt) {
      const path = String(req.originalUrl || '').split('?')[0];
      if (!/^\/api\/auth\/(mfa(\/|$)|profile$|logout$)/.test(path)) {
        return res.status(403).json({
          error: 'Two-factor authentication required',
          message: user.mfaEnabledAt ? 'Enter the code from your authenticator app.' : 'Set up an authenticator app to continue.',
          code: 'MFA_REQUIRED',
          setup: !user.mfaEnabledAt,
        });
      }
      req.mfaPending = true;
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id.toString();
    req.sessionId = sessionId;

    next();
  } catch (error) {
    // Already handled special cases above, only handle others here
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Authentication token is malformed',
      });
    }
    return res.status(500).json({
      error: 'Authentication error',
      message: error.message,
    });
  }
};

/**
 * Authenticate when the caller happens to be signed in, but never block them.
 *
 * For routes that serve logged-out visitors *and* want to recognise a member —
 * e.g. support tickets, where someone who cannot log in is the person most
 * likely to need help. A missing, expired or revoked token simply means the
 * request continues anonymously with `req.userId` unset.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const optionalAuthenticate = (req, res, next) => {
  const hasToken =
    req.cookies?.accessToken ||
    req.cookies?.token ||
    (req.headers.authorization || '').startsWith('Bearer ');

  if (!hasToken) return next();

  // Reuse `authenticate` verbatim rather than re-implementing token handling,
  // but swallow the rejection it would have sent so a bad token degrades to
  // "anonymous" instead of "denied". Exactly one `next()` runs either way.
  const silentRes = {
    status: () => silentRes,
    json: () => next(),
    clearCookie: () => silentRes,
  };

  authenticate(req, silentRes, next);
};

/**
 * Middleware factory: allow only the given roles.
 * Must be used AFTER authenticate middleware.
 *
 * @param {...string} roles - Roles allowed through
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Please authenticate first',
    });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Access denied',
      message: roles.includes('developer') ? 'Developer privileges required' : 'Admin privileges required',
    });
  }

  next();
};

const requireAdmin = requireRole('superAdmin');
const requireDeveloper = requireRole('developer', 'superAdmin');

module.exports = { authenticate, optionalAuthenticate, requireAdmin, requireDeveloper, requireRole };
