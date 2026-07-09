const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

// Stricter limiter for auth routes (login/register)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many login/register attempts, please try again after an hour',
  },
});

// OTP send limiter — max 3 OTP requests per 15 minutes per IP
// Prevents spam/abuse of email sending
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'For mange forsøk. Vent 15 minutter før du prøver igjen.',
  },
});

// OTP verify limiter — max 5 attempts per 10 minutes per IP
// Prevents brute-force guessing of the 6-digit code
const otpVerifyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'For mange forsøk. Vent 10 minutter før du prøver igjen.',
  },
});

module.exports = { apiLimiter, authLimiter, otpSendLimiter, otpVerifyLimiter };
