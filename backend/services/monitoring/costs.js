const mongoose = require('mongoose');

/**
 * Infrastructure cost center. Monthly cost in NOK from three kinds of line:
 *   measured — read from the source of truth (Stripe processing fees from balance transactions)
 *   metered  — our own usage × a configurable unit price (OpenAI tokens, BankID logins,
 *              emails, blob storage GB)
 *   fixed    — monthly amounts entered by developers (VPS, domains, Atlas tier, stores…)
 * plus platform-fee income and unit economics (cost per order / per active user).
 * Prices and fixed items live in GlobalConfig "devdash_costs"; defaults are list prices
 * at the time of writing and should be checked against real invoices.
 */

const DAY = 24 * 60 * 60 * 1000;
const CONFIG_KEY = 'devdash_costs';
const DEFAULTS = {
  monthlyBudgetNok: null,
  fixed: [], // [{ name, category, monthlyNok }]
  prices: {
    usdToNok: 10.8,
    // USD per 1M tokens: [input, output]
    aiModels: { 'gpt-4o-mini': [0.15, 0.6], 'gpt-4o': [2.5, 10], 'gpt-4.1-mini': [0.4, 1.6], 'gpt-4.1': [2, 8], 'gpt-4.1-nano': [0.1, 0.4], default: [2.5, 10] },
    bankIdPerAuthNok: 0, // set from the Idura contract
    emailPerSendNok: 0, // 0 for Gmail/Workspace SMTP; set when moving to a paid provider
    blobPerGbMonthNok: 0.2, // Azure Blob hot LRS ≈ $0.018/GB
  },
};

const model = (name) => require(`../../models/${name}`);

/** Fire-and-forget: one row per OpenAI call. Never throws. */
function recordAiUsage(modelName, usage, feature) {
  if (!usage || mongoose.connection.readyState !== 1) return;
  model('UsageRecord')
    .create({ at: new Date(), kind: 'ai', model: modelName || null, feature: feature || null, inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0 })
    .catch(() => {});
}

async function getConfig() {
  const doc = await model('GlobalConfig').findOne({ key: CONFIG_KEY }).lean().catch(() => null);
  const v = doc?.value || {};
  return { ...DEFAULTS, ...v, prices: { ...DEFAULTS.prices, ...(v.prices || {}), aiModels: { ...DEFAULTS.prices.aiModels, ...(v.prices?.aiModels || {}) } } };
}

/** Pure: validate a config update from the dashboard. Unit-tested. */
function validateConfig(input) {
  const out = {};
  if (input.monthlyBudgetNok !== undefined) {
    const b = input.monthlyBudgetNok === null || input.monthlyBudgetNok === '' ? null : Number(input.monthlyBudgetNok);
    if (b !== null && (!Number.isFinite(b) || b < 0 || b > 10_000_000)) return { error: 'Budget must be between 0 and 10 000 000 NOK.' };
    out.monthlyBudgetNok = b;
  }
  if (input.fixed !== undefined) {
    if (!Array.isArray(input.fixed) || input.fixed.length > 50) return { error: 'At most 50 fixed items.' };
    out.fixed = [];
    for (const f of input.fixed) {
      const name = String(f?.name || '').trim().slice(0, 80);
      const category = String(f?.category || 'Other').trim().slice(0, 40);
      const monthlyNok = Number(f?.monthlyNok);
      if (!name) return { error: 'Every fixed item needs a name.' };
      if (!Number.isFinite(monthlyNok) || monthlyNok < 0 || monthlyNok > 1_000_000) return { error: `Invalid amount for ${name}.` };
      out.fixed.push({ name, category, monthlyNok: Math.round(monthlyNok * 100) / 100 });
    }
  }
  if (input.prices !== undefined) {
    const p = input.prices || {};
    out.prices = {};
    for (const k of ['usdToNok', 'bankIdPerAuthNok', 'emailPerSendNok', 'blobPerGbMonthNok']) {
      if (p[k] === undefined) continue;
      const n = Number(p[k]);
      if (!Number.isFinite(n) || n < 0 || n > 10_000) return { error: `Invalid price ${k}.` };
      out.prices[k] = n;
    }
  }
  return Object.keys(out).length ? { value: out } : { error: 'Nothing to change.' };
}

/** "2026-10" → [start, end) in UTC. */
function monthRange(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(month || '');
  const now = new Date();
  const y = m ? Number(m[1]) : now.getUTCFullYear();
  const mo = m ? Number(m[2]) - 1 : now.getUTCMonth();
  return [new Date(Date.UTC(y, mo, 1)), new Date(Date.UTC(y, mo + 1, 1))];
}

/** Pure: month-end projection for a metered amount. */
function project(amount, from, to, now = Date.now()) {
  if (now >= to.getTime()) return amount;
  const elapsed = Math.max(now - from.getTime(), DAY / 4); // avoid wild projections on the 1st
  return (amount * (to - from)) / elapsed;
}

const stripeCache = new Map();
async function stripeFees(from, to) {
  const key = `${from.toISOString()}|${to.toISOString()}`;
  const hit = stripeCache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.value;
  let value;
  try {
    const { getStripe, getStripeConfiguration } = require('../../config/stripe');
    const { testMode } = await getStripeConfiguration();
    const stripe = await getStripe();
    let fee = 0;
    let count = 0;
    // ponytail: walks at most 5 000 balance transactions per month; move to Stripe's reports API beyond that.
    for await (const t of stripe.balanceTransactions.list({ created: { gte: Math.floor(from / 1000), lt: Math.floor(to / 1000) }, limit: 100 })) {
      if (t.currency === 'nok') fee += t.fee;
      count += 1;
      if (count >= 5000) break;
    }
    value = { ok: true, nok: fee / 100, transactions: count, testMode };
  } catch (e) {
    value = { ok: false, error: e.message, nok: 0 };
  }
  stripeCache.set(key, { at: Date.now(), value });
  return value;
}

let blobCache = { at: 0, value: null };
async function blobUsage() {
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) return null;
  if (blobCache.value && Date.now() - blobCache.at < 6 * 60 * 60 * 1000) return blobCache.value;
  try {
    const { BlobServiceClient } = require('@azure/storage-blob');
    const container = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING).getContainerClient(process.env.AZURE_CONTAINER_NAME || 'images');
    let bytes = 0;
    let blobs = 0;
    // ponytail: full listing, cached 6 h, capped at 200 000 blobs; use Azure Monitor capacity metrics past that.
    for await (const b of container.listBlobsFlat()) {
      bytes += b.properties.contentLength || 0;
      blobs += 1;
      if (blobs >= 200_000) break;
    }
    blobCache = { at: Date.now(), value: { bytes, blobs, capped: blobs >= 200_000 } };
  } catch (e) {
    blobCache = { at: Date.now(), value: { error: e.message } };
  }
  return blobCache.value;
}

async function computeCosts(month) {
  const [from, to] = monthRange(month);
  const cfg = await getConfig();
  const p = cfg.prices;
  const inMonth = { $gte: from, $lt: to };
  const [stripe, ai, bankId, emails, blob, db, platformFees, orders, activeUsers] = await Promise.all([
    stripeFees(from, to),
    model('UsageRecord').aggregate([{ $match: { kind: 'ai', at: inMonth } }, { $group: { _id: '$model', calls: { $sum: 1 }, input: { $sum: '$inputTokens' }, output: { $sum: '$outputTokens' } } }]),
    model('IdentityClaim').countDocuments({ createdAt: inMonth }),
    model('DeliveryLog').countDocuments({ channel: 'email', status: 'sent', at: inMonth }),
    blobUsage(),
    mongoose.connection.db.stats().catch(() => null),
    model('Payout').aggregate([{ $match: { createdAt: inMonth, status: { $in: ['released_internal', 'processing', 'transferred'] } } }, { $group: { _id: null, nok: { $sum: '$platformFee' }, n: { $sum: 1 } } }]),
    model('Order').countDocuments({ completedAt: inMonth }),
    model('Session').distinct('userId', { lastUsed: inMonth }).then((x) => x.length),
  ]);

  const usd = p.usdToNok;
  const aiRows = ai.map((r) => {
    const [pin, pout] = p.aiModels[r._id] || p.aiModels.default;
    return { model: r._id || 'unknown', calls: r.calls, inputTokens: r.input, outputTokens: r.output, nok: ((r.input * pin + r.output * pout) / 1e6) * usd };
  });
  const gb = blob?.bytes ? blob.bytes / 1024 ** 3 : 0;
  const lines = [
    { key: 'stripe', category: 'Payments', name: 'Stripe processing fees', kind: 'measured', nok: stripe.nok, metered: true, excluded: Boolean(stripe.testMode), detail: stripe.ok ? `${stripe.transactions} balance transactions${stripe.testMode ? ' · TEST mode — not real charges' : ''}` : `Stripe unavailable: ${stripe.error}` },
    { key: 'ai', category: 'AI', name: 'OpenAI', kind: 'metered', nok: aiRows.reduce((a, r) => a + r.nok, 0), metered: true, detail: aiRows.length ? aiRows.map((r) => `${r.model}: ${r.calls} calls, ${(r.inputTokens + r.outputTokens).toLocaleString('en')} tokens`).join(' · ') : 'No AI calls recorded this month' },
    { key: 'bankid', category: 'Identity', name: 'BankID (Idura)', kind: 'metered', nok: bankId * p.bankIdPerAuthNok, metered: true, detail: `${bankId} verifications × ${p.bankIdPerAuthNok} NOK${p.bankIdPerAuthNok ? '' : ' (set the contract price)'}` },
    { key: 'email', category: 'Messaging', name: 'Email', kind: 'metered', nok: emails * p.emailPerSendNok, metered: true, detail: `${emails} emails sent × ${p.emailPerSendNok} NOK` },
    { key: 'blob', category: 'Storage', name: 'Azure Blob Storage', kind: 'metered', nok: gb * p.blobPerGbMonthNok, metered: false, detail: blob?.error ? `Could not list blobs: ${blob.error}` : blob ? `${gb.toFixed(2)} GB in ${blob.blobs.toLocaleString('en')} blobs × ${p.blobPerGbMonthNok} NOK/GB` : 'Not configured' },
    ...cfg.fixed.map((f, i) => ({ key: `fixed-${i}`, category: f.category, name: f.name, kind: 'fixed', nok: f.monthlyNok, metered: false, detail: 'Fixed monthly amount' })),
  ].map((l) => ({ ...l, nok: Math.round(l.nok * 100) / 100, projectedNok: Math.round((l.metered ? project(l.nok, from, to) : l.nok) * 100) / 100 }));

  // Test-mode Stripe fees are shown but are not money anyone pays.
  const counted = lines.filter((l) => !l.excluded);
  const total = counted.reduce((a, l) => a + l.nok, 0);
  const projected = counted.reduce((a, l) => a + l.projectedNok, 0);
  const fees = platformFees[0]?.nok || 0;
  const byCategory = {};
  for (const l of counted) byCategory[l.category] = Math.round(((byCategory[l.category] || 0) + l.projectedNok) * 100) / 100;

  return {
    month: from.toISOString().slice(0, 7),
    from,
    to,
    complete: Date.now() >= to.getTime(),
    lines,
    byCategory,
    totalNok: Math.round(total * 100) / 100,
    projectedNok: Math.round(projected * 100) / 100,
    budgetNok: cfg.monthlyBudgetNok,
    income: { platformFeesNok: Math.round(fees * 100) / 100, payouts: platformFees[0]?.n || 0 },
    units: {
      ordersCompleted: orders,
      activeUsers,
      costPerOrder: orders ? Math.round((total / orders) * 100) / 100 : null,
      costPerActiveUser: activeUsers ? Math.round((total / activeUsers) * 100) / 100 : null,
    },
    database: db ? { dataBytes: db.dataSize, storageBytes: db.storageSize, indexBytes: db.indexSize } : null,
    config: cfg,
  };
}

module.exports = { blobUsage, CONFIG_KEY, DEFAULTS, recordAiUsage, getConfig, validateConfig, monthRange, project, computeCosts };
