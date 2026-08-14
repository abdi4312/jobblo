/**
 * Read-only preflight for the payment configuration. Safe to run on production.
 *
 *   node scripts/check-payment-config.js
 *
 * It answers the question the 500 on /api/safepay-checkout/create-session could not:
 * which piece of configuration is missing on THIS machine. It touches Stripe only with
 * a balance read, writes nothing, and never prints a secret.
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const mongoose = require('mongoose');

let problems = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m) => {
  problems++;
  console.log(`  FAIL  ${m}`);
};
const note = (m) => console.log(`        ${m}`);

(async () => {
  console.log('\nJobblo payment configuration\n' + '─'.repeat(58));

  // ── 1. Which Stripe mode is this machine in ─────────────────────────────────
  console.log('\nStripe mode');
  let testMode = false;
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
    const cfg = await require('../models/GlobalConfig').findOne({ key: 'STRIPE_TEST_MODE' });
    testMode = cfg ? Boolean(cfg.value) : false;
    ok(`STRIPE_TEST_MODE = ${testMode}${cfg ? '' : '  (no row — defaults to production)'}`);
  } catch (err) {
    bad(`could not read STRIPE_TEST_MODE from Mongo: ${err.message}`);
  }

  // ── 2. The key that mode will actually read ────────────────────────────────
  const keyName = testMode ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_SECRET_KEY';
  const key = process.env[keyName];
  console.log(`\nSecret key (${keyName})`);
  if (!key) {
    bad(`${keyName} is NOT SET — getStripe() throws, every checkout returns 500`);
    note(testMode ? 'Either set this key, or turn STRIPE_TEST_MODE off in Superadmin.' : '');
  } else {
    const live = key.startsWith('sk_live_');
    ok(`present (${key.slice(0, 8)}…, ${live ? 'LIVE' : 'test'} key)`);
    if (testMode && live) bad('test mode is ON but the key is a LIVE key');
    if (!testMode && !live) {
      note('production mode is using a TEST key — real payments will not be taken');
    }
    try {
      const stripe = require('stripe')(key);
      const balance = await stripe.balance.retrieve();
      ok(`Stripe reachable — balance currencies: ${balance.available.map((b) => b.currency).join(', ')}`);
    } catch (err) {
      bad(`Stripe rejected the key: ${err.type || ''} ${err.message}`);
    }
  }

  // ── 3. Return URLs ─────────────────────────────────────────────────────────
  console.log('\nReturn URLs (FRONTEND_URL)');
  const frontend = process.env.FRONTEND_URL?.trim();
  if (!frontend) {
    bad('FRONTEND_URL is NOT SET — success_url becomes "undefined/safepay/…" and Stripe rejects it');
  } else if (!/^https?:\/\//i.test(frontend)) {
    bad(`FRONTEND_URL must be absolute, got "${frontend}"`);
  } else {
    ok(frontend);
    if (frontend.includes('localhost')) note('points at localhost — wrong for a deployed server');
  }

  // ── 4. Webhook ─────────────────────────────────────────────────────────────
  console.log('\nWebhook');
  const hookName = testMode ? 'STRIPE_TEST_WEBHOOK_SECRET' : 'STRIPE_WEBHOOK_SECRET';
  const hook = process.env[hookName] || process.env.STRIPE_WEBHOOK_SECRET;
  if (!hook) {
    bad(`${hookName} is NOT SET — every webhook fails signature checks`);
    note('Payments still confirm when the buyer returns to the success page, but an order');
    note('is left unpaid if they close the tab at Stripe. Set this.');
  } else {
    ok(`${hookName} present (${hook.slice(0, 8)}…)`);
  }

  console.log('\n' + '─'.repeat(58));
  console.log(problems === 0 ? 'No configuration problems found.\n' : `${problems} problem(s) found.\n`);
  process.exit(problems === 0 ? 0 : 1);
})().catch((err) => {
  console.error('check failed:', err.message);
  process.exit(1);
});
