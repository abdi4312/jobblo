/**
 * End-to-end walk of the money path, run against a live local backend.
 *
 *   register customer + provider
 *     → customer posts a job
 *     → provider applies
 *     → customer awards it (creates the SafePay contract / Order)
 *     → customer opens a Stripe Checkout session
 *     → the session is paid with a test card via the Stripe API
 *     → the order is confirmed paid (the same path the success page polls)
 *     → provider starts the job and marks it ready for review
 *     → customer approves, which releases the payout
 *
 * Every step asserts on the response, so a break names the step it broke at instead of
 * surfacing later as a wrong number. Nothing here is mocked: it talks to the real
 * controllers and to Stripe in test mode.
 *
 *   node scripts/e2e-job-flow.js
 *
 * Requires the API running on $API (default http://localhost:5001) and a Stripe *test*
 * secret key — it refuses to run against a live key.
 */
require('dotenv').config({ path: __dirname + '//../.env' });

const API = process.env.API || 'http://localhost:5001';
const stamp = Date.now();

let step = 0;
const log = (msg) => console.log(`  ${msg}`);
const head = (msg) => console.log(`\n[${++step}] ${msg}`);

function fail(what, detail) {
  console.error(`\n  ✗ FAILED at step ${step}: ${what}`);
  if (detail !== undefined) console.error('    ', typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

async function api(method, path, { token, body, expect = [200, 201] } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }

  if (!expect.includes(res.status)) {
    fail(`${method} ${path} → ${res.status} (expected ${expect.join('/')})`, json);
  }
  return json;
}

async function register(role, label) {
  const email = `e2e.${role}.${stamp}@jobblo.test`;
  const password = 'E2ePassord!2024';
  const body = {
    name: `E2E ${label}`,
    lastName: 'Test',
    email,
    password,
    confirmPassword: password,
    role: 'user',
  };

  const out = await api('POST', '/api/auth/register', { body, expect: [200, 201] });
  const token = out.token || out.accessToken || out.data?.token;
  const id = out.user?._id || out.data?.user?._id || out._id;
  if (!token) fail(`register ${label}: no token in response`, out);
  log(`${label.padEnd(8)} ${email}  id=${id}`);
  return { token, id, email, password };
}

(async () => {
  console.log(`\nSafePay end-to-end — ${API}\n${'─'.repeat(60)}`);

  // ── Guard: never run this against live Stripe keys ────────────────────────────
  const key = process.env.STRIPE_SECRET_KEY || '';
  if (!key) fail('preflight', 'STRIPE_SECRET_KEY is not set');
  if (!key.startsWith('sk_test_')) {
    fail('preflight', 'STRIPE_SECRET_KEY is not a test key — refusing to charge a live account');
  }
  const stripe = require('stripe')(key);

  head('Register both parties');
  const customer = await register('customer', 'customer');
  const provider = await register('provider', 'provider');

  head('Customer posts a job');
  const service = await api('POST', '/api/services', {
    token: customer.token,
    body: {
      title: `E2E oppdrag ${stamp}`,
      description: 'Automated end-to-end test of the SafePay money path.',
      price: 2500,
      categories: ['Maling'],
      location: { type: 'Point', coordinates: [10.7461, 59.9127], address: 'Testveien 1', city: 'Oslo' },
      duration: { value: 2, unit: 'hours' },
      equipment: 'utstyrfri',
      tags: [],
    },
  });
  const serviceId = service._id || service.data?._id || service.service?._id;
  if (!serviceId) fail('create service: no _id in response', service);
  log(`serviceId=${serviceId}  price=2500`);

  head('Provider applies');
  const request = await api('POST', '/api/orders/request', {
    token: provider.token,
    body: { serviceId, message: 'Jeg kan ta dette oppdraget.' },
  });
  const requestId = request._id || request.data?._id || request.request?._id;
  log(`requestId=${requestId}`);

  head('Customer awards it — creates the SafePay contract');
  const contract = await api('POST', '/api/safepay/create-contract', {
    token: customer.token,
    body: { serviceId, applicantId: provider.id, requestId },
  });
  const orderId = contract.order?._id || contract._id || contract.orderId;
  if (!orderId) fail('create-contract: no order id', contract);
  log(`orderId=${orderId}`);

  head('Checkout details reflect the 3 % fee');
  const details = await api('GET', `/api/safepay-checkout/details/${orderId}`, { token: customer.token });
  const calc = details.calculation || {};
  log(`base=${calc.basePrice}  fee=${calc.fee}  total=${calc.total}  providerNet=${calc.providerNet}`);
  if (calc.fee !== Math.round(calc.basePrice * 0.03)) fail('fee is not 3 % of base', calc);
  if (calc.total !== calc.basePrice + calc.fee) fail('total != base + fee', calc);
  if (calc.providerNet !== calc.basePrice - calc.fee) fail('providerNet != base - fee', calc);

  head('Create the Stripe Checkout session  ← the endpoint returning 500 in production');
  const session = await api('POST', '/api/safepay-checkout/create-session', {
    token: customer.token,
    body: { orderId },
  });
  if (!session.url) fail('create-session returned no url', session);
  log(`checkout url ok (${session.url.slice(0, 48)}…)`);

  head('Customer can read their own order');
  // Regression guard: `getOrderById` populates the party refs before authorising, so a
  // `.toString()` on the populated document never matched the user id and BOTH parties
  // got 403 on every order.
  const order = await api('GET', `/api/orders/${orderId}`, { token: customer.token });
  const sessionId = order.checkoutSessionId;
  if (!sessionId) fail('order has no checkoutSessionId after create-session', order);
  log(`checkoutSessionId=${sessionId}`);

  head('Pay with a test card');
  const amount = Math.round((calc.total || 0) * 100);
  const intent = await stripe.paymentIntents.create({
    amount,
    currency: 'nok',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    metadata: { orderId: String(orderId), type: 'safepay_payment' },
  });
  if (intent.status !== 'succeeded') fail('test payment did not succeed', intent.status);
  log(`paymentIntent=${intent.id} status=${intent.status} amount=${amount / 100} kr`);

  head('Stripe tells us it is paid (webhook — the production confirmation path)');
  // A Checkout Session cannot be completed over the API, so the event Stripe would send
  // on completion is constructed and signed with the real secret. Everything downstream
  // of the signature check — confirmPaidSession, the Payment record, the chat message,
  // the notifications — runs exactly as it does in production.
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    fail(
      'STRIPE_WEBHOOK_SECRET is not set',
      'Without it the webhook rejects every event, so a paid order is only ever confirmed\n' +
        '     if the buyer returns to the success page. Set it and re-run.'
    );
  }

  const payload = JSON.stringify({
    id: `evt_e2e_${stamp}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        status: 'complete',
        payment_status: 'paid',
        payment_intent: intent.id,
        metadata: { orderId: String(orderId), userId: String(customer.id), type: 'safepay_payment' },
      },
    },
  });

  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
  const hookRes = await fetch(`${API}/api/safepay-checkout/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': signature },
    body: payload,
  });
  if (hookRes.status !== 200) fail(`webhook → ${hookRes.status}`, await hookRes.text());
  log('webhook accepted');

  head('Order is now paid, and the money is held');
  const paid = await api('GET', `/api/orders/${orderId}`, { token: customer.token });
  log(`status=${paid.status}  paymentStatus=${paid.paymentStatus}`);
  if (!['paid', 'in_progress'].includes(paid.status)) {
    fail('order did not reach paid after the webhook', { status: paid.status });
  }

  head('Provider starts the job');
  await api('POST', `/api/safepay/orders/${orderId}/start`, { token: provider.token });

  head('Provider marks it ready for review');
  await api('POST', `/api/safepay/orders/${orderId}/ready-for-review`, { token: provider.token });

  head('Give the provider a payouts-enabled Connect account');
  // Without this the release stops at PAYOUT_SETUP_REQUIRED — correct behaviour, but it
  // means the transfer itself never runs and the one step that actually moves money to
  // the provider goes untested. A test-mode Custom account is enabled on creation.
  const connect = await stripe.accounts.create({
    type: 'custom',
    country: 'NO',
    email: provider.email,
    capabilities: { transfers: { requested: true } },
    business_type: 'individual',
    individual: {
      first_name: 'E2E',
      last_name: 'Provider',
      dob: { day: 1, month: 1, year: 1990 },
      address: { line1: 'address_full_match', city: 'Oslo', postal_code: '0150', country: 'NO' },
      email: provider.email,
      phone: '+4721234567',
    },
    business_profile: { mcc: '1520', url: 'https://jobblo.no' },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
    external_account: {
      object: 'bank_account',
      country: 'NO',
      currency: 'nok',
      account_number: 'NO9386011117947',
    },
  });
  if (!connect.payouts_enabled) fail('test Connect account is not payouts-enabled', connect.requirements);

  const mongoose = require('mongoose');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  await require('../models/User').findByIdAndUpdate(provider.id, {
    stripeConnectAccountId: connect.id,
    payoutEnabled: true,
  });
  log(`connect=${connect.id} payouts_enabled=${connect.payouts_enabled}`);

  head('Customer approves — releases the payout');
  const approved = await api('POST', '/api/safepay-checkout/approve', {
    token: customer.token,
    body: {
      orderId,
      ratings: { overall: 5, punctuality: 5, quality: 5, communication: 5, tidiness: 5 },
      comment: 'Automated end-to-end approval.',
      recommendWorker: true,
    },
  });
  log(JSON.stringify(approved).slice(0, 300));

  head('Final state — and did the money actually move?');
  const final = await api('GET', `/api/orders/${orderId}`, { token: customer.token });
  log(`status=${final.status}  paymentStatus=${final.paymentStatus}`);

  if (approved.payoutWarning) {
    log(`payout warning: ${approved.payoutWarning}`);
    fail('the payout did not go through', approved.payoutErrorCode);
  }

  const payout = await require('../models/Payout').findOne({ orderId });
  if (!payout) fail('no Payout record was written', null);
  log(`payout status=${payout.status}  net=${payout.netProviderAmount} kr  transfer=${payout.stripeTransferId}`);
  if (payout.status !== 'transferred') fail('payout never reached "transferred"', payout.status);

  const transfer = await stripe.transfers.retrieve(payout.stripeTransferId);
  log(`stripe transfer ${transfer.id}: ${transfer.amount / 100} ${transfer.currency} → ${transfer.destination}`);
  if (transfer.amount !== calc.providerNet * 100) {
    fail('transferred amount != providerNet', { transferred: transfer.amount / 100, expected: calc.providerNet });
  }

  console.log(`\n${'─'.repeat(60)}\nWalked every step without an unexpected status.\n`);
  process.exit(0);
})().catch((err) => {
  console.error('\n  ✗ UNCAUGHT:', err?.message);
  console.error(err?.stack);
  process.exit(1);
});
