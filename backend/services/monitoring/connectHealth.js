const { readinessFromAccount } = require('../stripeConnectReadiness');

/**
 * Stripe Connect health: every provider's connected account as Stripe sees it, compared with
 * what our database believes, and the SafePay money that is stuck because of it.
 *
 * One paged accounts.list per scan (cached 10 min) instead of one call per provider.
 * Readiness uses readinessFromAccount — the same rule that gates real payouts.
 */

const DAY = 24 * 60 * 60 * 1000;
const model = (name) => require(`../../models/${name}`);
const HELD_ORDER = ['paid', 'in_progress', 'ready_for_review', 'completed', 'disputed'];
const SETTLED_PAYOUT = ['released_internal', 'processing', 'transferred'];

/** Pure: what is wrong with one provider's Connect state. Unit-tested. */
function problems({ db, stripe, accountId }) {
  const out = [];
  const add = (code, severity, detail) => out.push({ code, severity, detail });
  if (!accountId) return out;
  if (!stripe) {
    add('account_missing_in_stripe', 'critical', 'The account id stored for this provider does not exist in the current Stripe mode.');
    return out;
  }
  if (stripe.disabledReason) add('disabled', 'critical', `Stripe disabled the account: ${stripe.disabledReason.replace(/_/g, ' ')}`);
  if (stripe.pastDue.length) add('past_due', 'high', `${stripe.pastDue.length} requirement(s) past due — payouts are blocked`);
  if (stripe.currentlyDue.length && stripe.currentDeadline) {
    const days = (new Date(stripe.currentDeadline) - Date.now()) / DAY;
    add('deadline', days < 7 ? 'high' : 'medium', `${stripe.currentlyDue.length} requirement(s) due ${days < 0 ? 'overdue' : `in ${Math.max(0, Math.round(days))} days`}`);
  } else if (stripe.currentlyDue.length) add('currently_due', 'medium', `${stripe.currentlyDue.length} requirement(s) currently due`);
  if (stripe.pendingVerification.length) add('pending_verification', 'low', `${stripe.pendingVerification.length} item(s) under Stripe review`);
  if (!stripe.transfersEnabled && stripe.detailsSubmitted) add('transfers_inactive', 'high', 'Transfers capability is not active — SafePay cannot pay this provider');
  if (stripe.errors.length) add('verification_errors', 'high', stripe.errors.map((e) => `${e.requirement}: ${e.reason || e.code}`).join('; ').slice(0, 300));
  if (db.payoutEnabled && !stripe.ready) add('db_says_ready', 'high', 'Our database says payouts are enabled, but Stripe does not — flags are stale');
  if (!db.payoutEnabled && stripe.ready) add('db_says_not_ready', 'medium', 'Stripe is ready but our database still blocks this provider — resync');
  return out;
}

let cache = { at: 0, value: null };

async function listAccounts(stripe) {
  const map = new Map();
  // ponytail: one paged list, capped at 2 000 accounts; beyond that, keep a synced copy via account.updated webhooks.
  for await (const a of stripe.accounts.list({ limit: 100 })) {
    map.set(a.id, a);
    if (map.size >= 2000) break;
  }
  return map;
}

async function scan({ force = false } = {}) {
  if (!force && cache.value && Date.now() - cache.at < 10 * 60 * 1000) return cache.value;
  const { getStripeConfiguration, getStripeForMode } = require('../../config/stripe');
  const cfg = await getStripeConfiguration();
  const field = cfg.testMode ? 'stripeConnectAccountIdTest' : 'stripeConnectAccountId';
  let accounts = new Map();
  let stripeError = null;
  try {
    accounts = await listAccounts(await getStripeForMode(cfg.testMode));
  } catch (e) {
    stripeError = e.message;
  }

  const [providers, activeWithoutAccount, held, failedPayouts, bankFailures] = await Promise.all([
    model('User').find({ [field]: { $nin: [null, ''] } }).select(`name email role ${field} payoutEnabled payoutOnboardingStatus chargesEnabled detailsSubmitted payoutOnboardingLastRefreshedAt connectAccountCreatedAt createdAt`).lean(),
    // Providers doing work without any Connect account (their earnings can never be paid).
    model('Order').aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 90 * DAY) }, providerId: { $ne: null } } },
      { $group: { _id: '$providerId', orders: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', pipeline: [{ $project: { [field]: 1, name: 1, email: 1 } }], as: 'u' } },
      { $unwind: '$u' },
      { $match: { [`u.${field}`]: { $in: [null, ''] } } },
      { $project: { orders: 1, name: '$u.name', email: '$u.email' } },
    ]),
    // Money the platform holds for each provider: paid orders without a settled payout.
    model('Order').aggregate([
      { $match: { status: { $in: HELD_ORDER }, paymentStatus: { $in: ['paid', 'partially_refunded'] } } },
      { $lookup: { from: 'payouts', localField: '_id', foreignField: 'orderId', pipeline: [{ $project: { status: 1 } }], as: 'po' } },
      { $match: { $expr: { $not: { $in: [{ $arrayElemAt: ['$po.status', 0] }, SETTLED_PAYOUT] } } } },
      { $group: { _id: '$providerId', nok: { $sum: { $ifNull: ['$agreedPrice', 0] } }, orders: { $push: '$_id' } } },
    ]),
    model('Payout').find({ status: { $in: ['failed', 'reconciliation_required'] } }).sort({ updatedAt: -1 }).limit(100).populate('providerId', 'name email').select('orderId providerId status failureCode failureReason netProviderAmount updatedAt').lean(),
    model('StripeBankPayoutRecord').find({ status: 'failed', createdAt: { $gte: new Date(Date.now() - 90 * DAY) } }).sort({ createdAt: -1 }).limit(100).populate('providerId', 'name email').select('stripeAccountId providerId amount currency failureCode failureMessage arrivalDate createdAt').lean().catch(() => []),
  ]);

  const heldBy = new Map(held.map((h) => [String(h._id), h]));
  const known = new Set();
  const rows = providers.map((u) => {
    const accountId = u[field];
    known.add(accountId);
    const acct = accounts.get(accountId);
    const s = acct ? readinessFromAccount(acct) : null;
    const issues = stripeError ? [] : problems({ db: u, stripe: s, accountId });
    const h = heldBy.get(String(u._id));
    if (h && s && !s.ready) issues.unshift({ code: 'money_blocked', severity: 'critical', detail: `${h.nok.toLocaleString('nb-NO')} NOK in ${h.orders.length} order(s) cannot be paid out until the account is ready` });
    return {
      userId: String(u._id),
      name: u.name,
      email: u.email,
      accountId,
      db: { payoutEnabled: Boolean(u.payoutEnabled), status: u.payoutOnboardingStatus, lastRefreshed: u.payoutOnboardingLastRefreshedAt || null },
      stripe: s && { ready: s.ready, status: s.payoutOnboardingStatus, payoutsEnabled: s.payoutEnabled, transfersEnabled: s.transfersEnabled, chargesEnabled: s.chargesEnabled, disabledReason: s.disabledReason, currentlyDue: s.currentlyDue.length, pastDue: s.pastDue.length, pendingVerification: s.pendingVerification.length, currentDeadline: s.currentDeadline, country: acct.country, created: acct.created ? new Date(acct.created * 1000) : null },
      heldNok: h?.nok || 0,
      heldOrders: h?.orders.length || 0,
      issues,
      worst: issues.reduce((w, i) => (['critical', 'high', 'medium', 'low'].indexOf(i.severity) < ['critical', 'high', 'medium', 'low'].indexOf(w) ? i.severity : w), issues.length ? 'low' : null),
    };
  });
  const orphanAccounts = [...accounts.values()].filter((a) => !known.has(a.id)).map((a) => ({ id: a.id, email: a.email || null, jobbloUserId: a.metadata?.jobbloUserId || null, created: a.created ? new Date(a.created * 1000) : null, ready: readinessFromAccount(a).ready }));
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  rows.sort((a, b) => (rank[a.worst] ?? 9) - (rank[b.worst] ?? 9) || b.heldNok - a.heldNok);

  const value = {
    generatedAt: new Date(),
    mode: cfg.testMode ? 'test' : 'live',
    stripeError,
    providers: rows,
    withoutAccount: activeWithoutAccount.map((p) => ({ userId: String(p._id), name: p.name, email: p.email, orders: p.orders, heldNok: heldBy.get(String(p._id))?.nok || 0 })),
    orphanAccounts,
    failedPayouts,
    bankFailures,
    summary: {
      accounts: rows.length,
      ready: rows.filter((r) => r.stripe?.ready).length,
      restricted: rows.filter((r) => r.stripe && !r.stripe.ready && (r.stripe.disabledReason || r.stripe.pastDue)).length,
      pending: rows.filter((r) => r.stripe && !r.stripe.ready && !r.stripe.disabledReason && !r.stripe.pastDue).length,
      missing: rows.filter((r) => r.issues.some((i) => i.code === 'account_missing_in_stripe')).length,
      staleFlags: rows.filter((r) => r.issues.some((i) => i.code === 'db_says_ready' || i.code === 'db_says_not_ready')).length,
      blockedNok: rows.filter((r) => r.stripe && !r.stripe.ready).reduce((a, r) => a + r.heldNok, 0) + activeWithoutAccount.reduce((a, p) => a + (heldBy.get(String(p._id))?.nok || 0), 0),
      failedPayouts: failedPayouts.length,
      bankFailures: bankFailures.length,
    },
  };
  cache = { at: Date.now(), value };
  return value;
}

/** Live detail for one provider: full requirement lists, capabilities, money records. */
async function providerDetail(userId) {
  const { getStripeConfiguration, getStripeForMode } = require('../../config/stripe');
  const cfg = await getStripeConfiguration();
  const field = cfg.testMode ? 'stripeConnectAccountIdTest' : 'stripeConnectAccountId';
  const u = await model('User').findById(userId).select(`name email ${field} payoutEnabled payoutOnboardingStatus chargesEnabled detailsSubmitted payoutOnboardingLastRefreshedAt connectAccountCreatedAt`).lean();
  if (!u) return null;
  let account = null;
  let stripeError = null;
  if (u[field]) {
    try {
      account = await (await getStripeForMode(cfg.testMode)).accounts.retrieve(u[field]);
    } catch (e) {
      stripeError = e.code === 'resource_missing' ? 'Account not found in this Stripe mode.' : e.message;
    }
  }
  const s = account ? readinessFromAccount(account) : null;
  const [payouts, bank, heldOrders] = await Promise.all([
    model('Payout').find({ providerId: userId }).sort({ createdAt: -1 }).limit(20).select('orderId status netProviderAmount stripeTransferId failureCode failureReason createdAt transferCompletedAt').lean(),
    model('StripeBankPayoutRecord').find({ providerId: userId }).sort({ createdAt: -1 }).limit(20).select('amount currency status arrivalDate failureCode failureMessage destinationBankName destinationLast4 createdAt').lean().catch(() => []),
    model('Order').find({ providerId: userId, status: { $in: HELD_ORDER }, paymentStatus: { $in: ['paid', 'partially_refunded'] } }).select('status agreedPrice completedAt createdAt').lean(),
  ]);
  return {
    mode: cfg.testMode ? 'test' : 'live',
    user: { _id: String(u._id), name: u.name, email: u.email, accountId: u[field] || null, db: { payoutEnabled: u.payoutEnabled, status: u.payoutOnboardingStatus, chargesEnabled: u.chargesEnabled, detailsSubmitted: u.detailsSubmitted, lastRefreshed: u.payoutOnboardingLastRefreshedAt, connectedAt: u.connectAccountCreatedAt } },
    stripeError,
    stripe: s && {
      ...s,
      capabilities: account.capabilities || {},
      country: account.country,
      defaultCurrency: account.default_currency,
      businessType: account.business_type,
      payoutSchedule: account.settings?.payouts?.schedule || null,
      externalAccounts: (account.external_accounts?.data || []).map((x) => ({ bank: x.bank_name, last4: x.last4, currency: x.currency, status: x.status })),
    },
    issues: problems({ db: u, stripe: s, accountId: u[field] }),
    payouts,
    bankPayouts: bank,
    heldOrders,
  };
}

/** Resync our flags from Stripe using the existing owner-checked persistence path. */
async function resync(userId) {
  const { getStripeConfiguration, getStripeForMode } = require('../../config/stripe');
  const ctl = require('../../controllers/stripeConnectController');
  const cfg = await getStripeConfiguration();
  const field = ctl.accountFieldForMode(cfg.testMode);
  const user = await model('User').findById(userId).select(`${field} payoutEnabled payoutOnboardingStatus`);
  if (!user?.[field]) return { error: 'This provider has no Connect account in the current mode.' };
  const account = await (await getStripeForMode(cfg.testMode)).accounts.retrieve(user[field]);
  const before = { payoutEnabled: user.payoutEnabled, status: user.payoutOnboardingStatus };
  await ctl.syncAccountFields(user, account, cfg.testMode);
  cache = { at: 0, value: null };
  const after = await model('User').findById(userId).select('payoutEnabled payoutOnboardingStatus').lean();
  return { before, after: { payoutEnabled: after.payoutEnabled, status: after.payoutOnboardingStatus } };
}

module.exports = { problems, scan, providerDetail, resync };
