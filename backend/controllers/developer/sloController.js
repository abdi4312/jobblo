const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { computeSlos, FAST_BURN, SLOW_BURN } = require('../../services/monitoring/slo');

/** Developer dashboard — SLOs and error budgets. Read-only (targets change via /actions/slo_targets_set). */
const getSlos = asyncHandler(async (req, res) => {
  const windowDays = [7, 14, 30].includes(Number(req.query.window)) ? Number(req.query.window) : 30;
  const slos = await computeSlos({ windowDays });
  return sendSuccess(res, { windowDays, fastBurn: FAST_BURN, slowBurn: SLOW_BURN, slos });
});

module.exports = { getSlos };
