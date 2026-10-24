const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { runChecks } = require('../../services/monitoring/eventConsistency');

/** Developer dashboard — event consistency monitor. Read-only. */
const getEventConsistency = asyncHandler(async (req, res) => sendSuccess(res, await runChecks({ days: [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30 })));

module.exports = { getEventConsistency };
