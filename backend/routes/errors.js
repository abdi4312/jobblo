const express = require('express');
const router = express.Router();
const { asyncHandler, sendSuccess, sendError } = require('../utils/apiResponse');
const ErrorLog = require('../models/ErrorLog');
const { redactSensitive } = require('../utils/sanitizer');

// POST /api/errors/client - accept sanitized client-side error reports
router.post('/client', asyncHandler(async (req, res) => {
  const { errorCode = 'FRONTEND_RENDER_ERROR', message = '', route = '', component = '', metadata = {} } = req.body || {};
  try {
    const sanitized = redactSensitive(metadata);
    const referenceId = `FRONT-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    await ErrorLog.create({
      referenceId,
      errorCode,
      message: message.substring(0,500),
      technicalMessage: message,
      source: 'frontend',
      route,
      metadata: sanitized,
    });
    return sendSuccess(res, { referenceId }, 'Client error recorded.');
  } catch (err) {
    console.error('[ClientErrorRoute] Failed to persist:', err.message);
    return sendError(res, 'Failed to record client error.', 500);
  }
}));

module.exports = router;
