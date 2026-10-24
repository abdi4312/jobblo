const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { overview } = require('../../services/monitoring/searchHealth');

/** Developer dashboard — search & geolocation health. Read-only. */
const getSearchHealth = asyncHandler(async (req, res) => sendSuccess(res, await overview({ days: [1, 7, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 7 })));

module.exports = { getSearchHealth };
