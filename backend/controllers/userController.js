/**
 * User endpoints, split by concern (this file used to be ~1170 lines). Kept as the single import for routes/users.js and tests.
 */
module.exports = {
  ...require('./users/userHelpers'),
  ...require('./users/profileController'),
  ...require('./users/searchController'),
  ...require('./users/portfolioController'),
  ...require('./users/blockingController'),
};
