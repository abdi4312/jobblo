const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const impact = require('../../services/monitoring/impact');

/** Developer dashboard — user impact analyzer. Read-only. */

const getImpactOverview = asyncHandler(async (req, res) => sendSuccess(res, await impact.overview({ days: [1, 7, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 7 })));

const getImpactScope = asyncHandler(async (req, res) => {
  const { kind, id, from, to } = req.query;
  if (!['error', 'incident', 'release', 'window'].includes(kind)) return sendError(res, 'kind must be error, incident, release or window.', 400);
  const scope = await impact.resolveScope({ kind, id, from, to, hours: [1, 3, 6, 12, 24].includes(Number(req.query.hours)) ? Number(req.query.hours) : 6 });
  if (!scope) return sendError(res, kind === 'window' ? 'Invalid window (max 31 days).' : 'Not found.', kind === 'window' ? 400 : 404);
  return sendSuccess(res, { kind, id: id || null, ...(await impact.measure(scope)) });
});

module.exports = { getImpactOverview, getImpactScope };
