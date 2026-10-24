const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { summary } = require('../../services/monitoring/externalCalls');

/** Developer dashboard — external services: latency, failures, rate limits, quotas. Read-only. */
const getExternalServices = asyncHandler(async (req, res) => sendSuccess(res, await summary({ hours: [24, 168].includes(Number(req.query.hours)) ? Number(req.query.hours) : 24 })));

module.exports = { getExternalServices };
