const Stripe = require('stripe');
const GlobalConfig = require('../models/GlobalConfig');

let cachedClient = null;
let cachedMode = null;

async function getStripe() {
  let testMode = false;
  try {
    const config = await GlobalConfig.findOne({ key: 'STRIPE_TEST_MODE' });
    testMode = config ? Boolean(config.value) : false;
  } catch (err) {
    console.error('Stripe config lookup error, defaulting to production:', err.message);
  }

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

module.exports = { getStripe };
