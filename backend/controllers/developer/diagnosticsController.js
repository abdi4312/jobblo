/**
 * Developer-console diagnostics, split by topic (this file used to hold all of them, ~870 lines). Kept as the single import for routes, the admin order details route and older importers.
 */
module.exports = {
  ...require('../../services/monitoring/orderHealth'),
  ...require('./moneyDiagnosticsController'),
  ...require('./jobDiagnosticsController'),
  ...require('./subscriptionDiagnosticsController'),
  ...require('./reconciliationController'),
  ...require('./userDiagnosticsController'),
  ...require('./investigateController'),
};
