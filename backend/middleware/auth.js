const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Session = require("../models/Session");

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

    if (
      !token &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
        message: "Please log in",
        code: "TOKEN_MISSING",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Token expired",
          message: "Please log in again or refresh token",
          code: "TOKEN_EXPIRED",
        });
      }
      throw err;
    }

    // CRITICAL: Check if the session still exists in DB using the session ID (sid) from token
    const sessionId = decoded.sid;
    if (!sessionId) {
      return res.status(401).json({
        error: "Invalid token",
        message: "Session information missing from token",
      });
    }

    const sessionExists = await Session.findOne({
      _id: sessionId,
      userId: decoded.id,
    });

    if (!sessionExists) {
      // Clear cookies if session is invalid or revoked
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
      return res.status(401).json({
        error: "Session revoked",
        message: "Your session has been terminated or is invalid",
        code: "SESSION_REVOKED",
      });
    }

    // Update session lastUsed
    sessionExists.lastUsed = new Date();
    await sessionExists.save();

    // Fetch user from database
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        error: "User not found",
        message: "Invalid authentication token",
      });
    }

    // Attach user to request object
    req.user = user;
    req.userId = user._id.toString();
    req.sessionId = sessionId;

    next();
  } catch (error) {
    // Already handled special cases above, only handle others here
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Invalid token",
        message: "Authentication token is malformed",
      });
    }
    return res.status(500).json({
      error: "Authentication error",
      message: error.message,
    });
  }
};

/**
 * Middleware to require admin role
 * Must be used AFTER authenticate middleware
 *
 * @param {Object} req - Express request object (must have req.user from authenticate middleware)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: "Authentication required",
      message: "Please authenticate first",
    });
  }

  if (req.user.role !== "superAdmin") {
    return res.status(403).json({
      error: "Access denied",
      message: "Admin privileges required",
    });
  }

  next();
};

module.exports = { authenticate, requireAdmin };
