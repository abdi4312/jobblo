const Stripe = require('stripe');
const GlobalConfig = require('../models/GlobalConfig');
const crypto = require('crypto');

let cachedClient = null;
let cachedMode = null;
let cachedSecretKey = null;

/**
 * The API version this codebase is written against.
 *
 * Left unpinned, the *account's* dashboard default governs, so Stripe can change
 * payload shapes under a running deploy. stripe@20.2.0 sends this same version
 * implicitly, so pinning it changes nothing today — it only stops a future
 * `npm update stripe` or a dashboard version bump from moving us silently.
 *
 * The webhook endpoint registered in the Stripe dashboard must be set to this
 * same version, or live payloads will not match the shapes the handlers expect.
 */
const STRIPE_API_VERSION = '2025-12-15.clover';

/**
 * GlobalConfig.value is Schema.Types.Mixed, so an admin write can land a string.
 * `Boolean('false')` is `true` — which would silently flip production onto test
 * keys and stop real charges with no error anywhere. Parse explicitly instead.
 */
function parseBool(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  return false;
}

async function isTestMode() {
  const config = await GlobalConfig.findOne({ key: 'STRIPE_TEST_MODE' });
  if (!config) return false;

  const value = config.value;
  if (
    value === true ||
    value === false ||
    value === 1 ||
    value === 0 ||
    (typeof value === 'string' &&
      ['true', 'false', '1', '0', 'yes', 'no'].includes(value.trim().toLowerCase()))
  ) {
    return parseBool(value);
  }
  throw new Error('Stripe mode configuration is invalid');
}

async function getStripeConfiguration() {
  const testMode = await isTestMode();
  const secretKey = secretKeyForMode(testMode);
  const webhookSecret = (
    testMode ? process.env.STRIPE_TEST_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET
  )?.trim();
  const expectedPrefix = testMode ? /^(?:sk|rk)_test_.+/ : /^(?:sk|rk)_live_.+/;
  const keyModeValid = Boolean(secretKey && expectedPrefix.test(secretKey));

  return {
    testMode,
    mode: testMode ? 'test' : 'live',
    secretKey,
    webhookSecret: webhookSecret || null,
    keyModeValid,
    webhookSecretValid: Boolean(webhookSecret && /^whsec_.+/.test(webhookSecret)),
    fingerprint:
      secretKey && webhookSecret
        ? crypto
            .createHash('sha256')
            .update(`${testMode ? 'test' : 'live'}\0${secretKey}\0${webhookSecret}`)
            .digest('hex')
        : null,
  };
}

/**
 * Signing secret for the Stripe webhook, matching whichever mode getStripe() uses.
 *
 * Deliberately NO cross-mode fallback. A test-signed event verified against the
 * live secret fails as a signature mismatch, which in the log is indistinguishable
 * from a forged request. Missing configuration should report itself as missing
 * configuration, so the caller can return "not configured" rather than "bad
 * signature".
 */
async function getStripeWebhookSecret() {
  return (await getStripeConfiguration()).webhookSecret;
}

function secretKeyForMode(testMode) {
  // No fallback between modes: silently using the live key because the test key is
  // absent would take real money during a test run.
  return (testMode ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY) || null;
}

async function getStripeForMode(testMode) {
  require('../services/monitoring/faults').assertNoFault('stripe'); // staging failure simulator only

  const secretKey = secretKeyForMode(testMode);
  const expectedPrefix = testMode ? /^(?:sk|rk)_test_.+/ : /^(?:sk|rk)_live_.+/;

  if (!secretKey || !expectedPrefix.test(secretKey)) {
    const varName = testMode ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY';
    throw new Error(
      `Stripe secret key is missing or invalid for ${testMode ? 'TEST' : 'PRODUCTION'} mode (${varName})`
    );
  }

  if (cachedClient && cachedMode === testMode && cachedSecretKey === secretKey) {
    return cachedClient;
  }

  cachedClient = Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 20000,
  });
  // API latency for the developer dashboard. Guarded: tests mock the client.
  if (typeof cachedClient.on === 'function') {
    cachedClient.on('response', (e) => require('../services/monitoring/apm').recordStripe(e));
  }
  cachedMode = testMode;
  cachedSecretKey = secretKey;
  console.log(`Stripe client initialized: ${testMode ? 'TEST' : 'PRODUCTION'} mode`);
  return cachedClient;
}

async function getStripe() {
  const { testMode } = await getStripeConfiguration();
  return getStripeForMode(testMode);
}

/**
 * What mode are we *actually* in, judged by the key that will be used rather than
 * by the toggle that is supposed to select it.
 *
 * The admin badge previously rendered straight from the toggle, so with the toggle
 * off and an `sk_test_` key in the production slot it displayed a confident LIVE
 * while taking no real money. Callers should render `keyMode` and surface
 * `mismatch`.
 *
 * Returns key *prefixes* only — never the key itself.
 */
async function getStripeModeReport() {
  const config = await getStripeConfiguration();
  const { testMode: toggleTestMode, secretKey: key } = config;
  const keyMode = !key
    ? 'missing'
    : /^(?:sk|rk)_test_.+/.test(key)
      ? 'test'
      : /^(?:sk|rk)_live_.+/.test(key)
        ? 'live'
        : 'invalid';

  return {
    // What the STRIPE_TEST_MODE toggle says.
    toggleTestMode,
    // What the selected key actually is: 'test' | 'live' | 'missing'.
    keyMode,
    keyVarName: toggleTestMode ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY',
    webhookVarName: toggleTestMode ? 'STRIPE_TEST_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET',
    webhookConfigured: config.webhookSecretValid,
    apiVersion: STRIPE_API_VERSION,
    // True when the toggle and the real key disagree, or the key is absent.
    mismatch: !config.keyModeValid || toggleTestMode !== (keyMode === 'test'),
  };
}

/** Test seam — the module caches a client per mode for the process lifetime. */
function _resetStripeCache() {
  cachedClient = null;
  cachedMode = null;
  cachedSecretKey = null;
}

module.exports = {
  getStripe,
  getStripeForMode,
  getStripeConfiguration,
  getStripeWebhookSecret,
  getStripeModeReport,
  isTestMode,
  parseBool,
  STRIPE_API_VERSION,
  _resetStripeCache,
};
