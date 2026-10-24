const express = require('express');
const { makeLimiter } = require('../middleware/rateLimiter');
const { optionalAuthenticate } = require('../middleware/auth');
const { asyncHandler } = require('../utils/apiResponse');
const { ingest } = require('../services/monitoring/mobileTelemetry');

const router = express.Router();

// Public: the app reports crashes before login too. Small bodies, per-IP budget.
const telemetryLimiter = makeLimiter('mobile-telemetry', { windowMs: 5 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const maxBody = (req, res, next) => (Number(req.headers['content-length']) > 256 * 1024 ? res.status(413).json({ success: false, message: 'Batch too large.' }) : next());

router.post('/telemetry', telemetryLimiter, maxBody, optionalAuthenticate, asyncHandler(ingest));

module.exports = router;
