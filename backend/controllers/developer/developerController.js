/**
 * The developer-console core pages, split by topic (this file used to hold all of them,
 * ~990 lines). Kept as the single import for routes/developer.js and older importers.
 */
const { parseRange } = require('../../utils/devQuery');
const { diskUsage } = require('../../services/monitoring/system');

module.exports = {
  parseRange,
  diskUsage,
  ...require('./overviewController'), // getOverview
  ...require('./apiMonitoringController'), // getApiMetrics, getApiClients, getApiTraces
  ...require('./errorsController'), // getErrors, getErrorDetail, updateError
  ...require('./infraController'), // getServer, getMongo, getMongoIndexes, getScheduler, getWebhooks, getAudit
  ...require('./toolsController'), // runChecks, traceLookup, getDevelopers
};
