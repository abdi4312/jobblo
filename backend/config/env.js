/**
 * Loads backend/.env exactly once, whoever requires it first (server.js, app.js, scripts).
 * Real environment variables win over the file, as before.
 */
const path = require('path');

if (!global.__jobbloEnvLoaded) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
  global.__jobbloEnvLoaded = true;
}

module.exports = process.env;
