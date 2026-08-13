const Stripe = require('stripe');
const GlobalConfig = require('../models/GlobalConfig');

let cachedClient = null;
let cachedMode = null;

async function isTestMode() {
  try {
    const config = await GlobalConfig.findOne({ key: 'STRIPE_TEST_MODE' });
    return config ? Boolean(config.value) : false;
  } catch (err) {
    console.error('Stripe config lookup error, defaulting to production:', err.message);
    return false;
  }
}

/**
 * Signing secret for the Stripe webhook, matching whichever mode getStripe() uses.
 * Falls back to the production secret so a missing test secret doesn't silently
 * disable webhook verification.
 */
async function getStripeWebhookSecret() {
  const testMode = await isTestMode();
  return testMode
    ? process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET;
}

async function getStripe() {
  const testMode = await isTestMode();

  if (cachedClient && cachedMode === testMode) return cachedClient;

  const secretKey = testMode
    ? process.env.STRIPE_TEST_SECRET_KEY
    : process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error(`Stripe secret key is missing for ${testMode ? 'TEST' : 'PRODUCTION'} mode`);
  }

  cachedClient = Stripe(secretKey);
  cachedMode = testMode;
  console.log(`Stripe client initialized: ${testMode ? 'TEST' : 'PRODUCTION'} mode`);
  return cachedClient;
}

module.exports = { getStripe, getStripeWebhookSecret };
