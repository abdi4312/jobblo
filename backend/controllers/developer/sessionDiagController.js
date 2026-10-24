const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const diag = require('../../services/monitoring/sessionDiagnostics');

/** Developer dashboard — frontend session diagnostics (masked breadcrumb replay). Read-only. */
const KINDS = ['js_error', 'render', 'not_found', 'chunk', 'api', 'console'];

const getSessions = asyncHandler(async (req, res) =>
  sendSuccess(res, await diag.overview({ days: [1, 7, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 7, kind: KINDS.includes(req.query.kind) ? req.query.kind : undefined }))
);

const getSession = asyncHandler(async (req, res) => {
  const s = await diag.session(req.params.sessionId);
  if (!s) return sendError(res, 'Session not found (sessions are kept 30 days).', 404);
  return sendSuccess(res, s);
});

module.exports = { getSessions, getSession };
