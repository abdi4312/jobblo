const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { overview } = require('../../services/monitoring/quality');

/** Developer dashboard — test & quality center. Read-only. */
const getQuality = asyncHandler(async (req, res) => sendSuccess(res, await overview({ days: [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30 })));

module.exports = { getQuality };
