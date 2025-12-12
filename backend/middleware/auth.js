const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to authenticate JWT tokens
 * Compatible with OAuth-only authentication
 *
 * Extracts and verifies JWT token from Authorization header,
 * attaches user object to req.user and user ID to req.userId
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticate = async (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please provide a valid authorization token'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user from database
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                error: 'User not found',
                message: 'Invalid authentication token'
            });
        }

        // Attach user to request object
        req.user = user;
        req.userId = user._id.toString();

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Invalid token',
                message: 'Authentication token is malformed'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expired',
                message: 'Please log in again'
            });
        }
        return res.status(500).json({
            error: 'Authentication error',
            message: error.message
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
            error: 'Authentication required',
            message: 'Please authenticate first'
        });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Access denied',
            message: 'Admin privileges required'
        });
    }

    next();
};

module.exports = { authenticate, requireAdmin };
