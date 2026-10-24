/**
 * Job listing (service) endpoints, split by concern (this file used to be ~1060 lines). Kept as the single import for routes/service.js, middleware/upload.js and tests.
 */
module.exports = {
  ...require('./services/serviceHelpers'),
  ...require('./services/browseController'),
  ...require('./services/manageController'),
  ...require('./services/locationController'),
  ...require('./services/progressController'),
};
