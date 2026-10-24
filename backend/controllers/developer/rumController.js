const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const rum = require('../../services/monitoring/rum');

/** Developer dashboard — real-user monitoring of the web app. Read-only. */
const getRum = asyncHandler(async (req, res) => {
  const days = [1, 7, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
  return sendSuccess(res, await rum.summary({ days }));
});

module.exports = { getRum };
