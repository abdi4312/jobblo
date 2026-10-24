const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { getCapacity } = require('../../services/monitoring/capacity');

/** Developer dashboard — capacity planning (cached 10 min; ?refresh=true recomputes). Read-only. */
const getCapacityInfo = asyncHandler(async (req, res) => sendSuccess(res, await getCapacity({ force: req.query.refresh === 'true' })));

module.exports = { getCapacityInfo };
