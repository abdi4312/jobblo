const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { overview } = require('../../services/monitoring/migrations');

/** Developer dashboard — database migration center. Read-only: scripts are never run from here. */
const getMigrations = asyncHandler(async (req, res) => sendSuccess(res, await overview({ force: req.query.refresh === 'true' })));

module.exports = { getMigrations };
