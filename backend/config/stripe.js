const Stripe = require('stripe');
const GlobalConfig = require('../models/GlobalConfig');

let cachedClient = null;
let cachedMode = null;

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
  try {
    const config = await GlobalConfig.findOne({ key: 'STRIPE_TEST_MODE' });
    return config ? parseBool(config.value) : false;
  } catch (err) {
    console.error('Stripe config lookup error, defaulting to production:', err.message);
    return false;
  }
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
  const testMode = await isTestMode();
  return (
    (testMode ? process.env.STRIPE_TEST_WEBHOOK_SECRET : process.env.STRIPE_WEBHOOK_SECRET) || null
  );
}

function secretKeyForMode(testMode) {
  // No fallback between modes: silently using the live key because the test key is
  // absent would take real money during a test run.
  return (testMode ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_SECRET_KEY) || null;
}

async function getStripe() {
  const testMode = await isTestMode();

  if (cachedClient && cachedMode === testMode) return cachedClient;

  const secretKey = secretKeyForMode(testMode);

  if (!secretKey) {
    const varName = testMode ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY';
    throw new Error(
      `Stripe secret key is missing for ${testMode ? 'TEST' : 'PRODUCTION'} mode (${varName} is not set)`
    );
  }

  cachedClient = Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 20000,
  });
  cachedMode = testMode;
  console.log(`Stripe client initialized: ${testMode ? 'TEST' : 'PRODUCTION'} mode`);
  return cachedClient;
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
  const toggleTestMode = await isTestMode();
  const key = secretKeyForMode(toggleTestMode);
  const webhookSecret = await getStripeWebhookSecret();

  const keyMode = !key ? 'missing' : key.startsWith('sk_live_') ? 'live' : 'test';

  return {
    // What the STRIPE_TEST_MODE toggle says.
    toggleTestMode,
    // What the selected key actually is: 'test' | 'live' | 'missing'.
    keyMode,
    keyVarName: toggleTestMode ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY',
    webhookVarName: toggleTestMode ? 'STRIPE_TEST_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET',
    webhookConfigured: Boolean(webhookSecret),
    apiVersion: STRIPE_API_VERSION,
    // True when the toggle and the real key disagree, or the key is absent.
    mismatch: keyMode === 'missing' || toggleTestMode !== (keyMode === 'test'),
  };
}

/** Test seam — the module caches a client per mode for the process lifetime. */
function _resetStripeCache() {
  cachedClient = null;
  cachedMode = null;
}

module.exports = {
  getStripe,
  getStripeWebhookSecret,
  getStripeModeReport,
  isTestMode,
  parseBool,
  STRIPE_API_VERSION,
  _resetStripeCache,
};
