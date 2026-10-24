const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { overview } = require('../../services/monitoring/marketplace');

/** Developer dashboard — marketplace health (supply vs demand). Read-only. */
const getMarketplace = asyncHandler(async (req, res) => sendSuccess(res, await overview({ days: [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30 })));

module.exports = { getMarketplace };
