const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const tx = require('../../services/monitoring/transactions');

/** Developer dashboard — business transaction tracing. Read-only. */
const getJourneys = asyncHandler(async (req, res) => {
  const days = [30, 90, 180, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 90;
  return sendSuccess(res, await tx.journeys(days));
});

const getTrace = asyncHandler(async (req, res) => {
  const t = await tx.traceJob(String(req.params.id));
  if (!t) return sendError(res, 'No job, order, payment, payout or bid with this id.', 404);
  return sendSuccess(res, t);
});

module.exports = { getJourneys, getTrace };
