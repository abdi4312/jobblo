/**
 * Auth endpoints, split by concern (this file used to be ~815 lines). Kept as the single import for routes/auth.js, services and tests.
 */
module.exports = {
  ...require('./auth/authHelpers'),
  ...require('./auth/loginController'),
  ...require('./auth/accountController'),
  ...require('./auth/passwordController'),
};
