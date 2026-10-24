const express = require('express');
const { makeLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../utils/apiResponse');
const { ingest } = require('../services/monitoring/rum');

const router = express.Router();

// Public: anonymous visitors. navigator.sendBeacon posts text/plain, so accept it raw.
const limiter = makeLimiter('rum', { windowMs: 5 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
router.post('/', limiter, express.text({ type: 'text/plain', limit: '64kb' }), asyncHandler(ingest));

module.exports = router;
