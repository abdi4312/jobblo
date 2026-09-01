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

// Stricter limiter for auth routes (login/register).
//
// This counts only FAILED attempts. It used to count every request — 10 per IP
// per hour, successes included — which punished the wrong people: a household,
// an office or a café shares one public IP, so ten ordinary sign-ins locked out
// everyone behind it for an hour. Behind a CDN or load balancer that is the
// entire user base sharing one address (see also `app.set('trust proxy')`).
//
// `skipSuccessfulRequests` keeps the control aimed at what it is actually for:
// someone guessing passwords fails, and burns the budget; someone who knows
// their password never touches it.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // failed attempts only
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'For mange mislykkede forsøk. Prøv igjen om 15 minutter.',
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

// Admin API rate limiter — 200 requests per IP per 15 minutes
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'For mange forespørsler. Prøv igjen om 15 minutter.',
  },
});

module.exports = { apiLimiter, authLimiter, otpSendLimiter, otpVerifyLimiter, adminLimiter };
