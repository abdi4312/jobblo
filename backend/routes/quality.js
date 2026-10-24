const express = require('express');
const { makeLimiter } = require('../middleware/rateLimiter');
const { asyncHandler } = require('../utils/apiResponse');
const { tokenOk, normalizeReport } = require('../services/monitoring/quality');

const router = express.Router();

// CI → test results. Off (404) unless QUALITY_INGEST_TOKEN is set; the token goes in X-Quality-Token.
const limiter = makeLimiter('quality-report', { windowMs: 60 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
router.post(
  '/report',
  limiter,
  asyncHandler(async (req, res) => {
    if (!process.env.QUALITY_INGEST_TOKEN) return res.status(404).end();
    if (!tokenOk(req.get('x-quality-token'))) return res.status(401).json({ success: false, message: 'Invalid quality token.' });
    const { doc, error } = normalizeReport(req.body);
    if (error) return res.status(400).json({ success: false, message: error });
    const run = await require('../models/QualityRun').create(doc);
    return res.status(201).json({ success: true, id: String(run._id) });
  })
);

module.exports = router;
