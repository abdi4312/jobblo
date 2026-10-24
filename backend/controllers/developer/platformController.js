/**
 * Developer-console platform pages, split by topic (this file used to hold all of them, ~690 lines). Kept as the single import for routes/developer.js.
 */
module.exports = {
  ...require('../../services/monitoring/workQueues'),
  ...require('./queuesController'),
  ...require('./ticketsController'),
  ...require('../../services/monitoring/github'),
  ...require('./deploymentsController'),
  ...require('./incidentsController'),
  ...require('./reportsController'),
  ...require('./devSettingsController'),
};
