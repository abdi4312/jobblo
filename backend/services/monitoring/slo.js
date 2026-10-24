/**
 * Service level objectives over data the platform already records. Every SLO is
 * "good events / valid events" over a rolling window, with an error budget of
 * (1 − target) × valid events and burn rates over 1 h and 6 h:
 *
 *   burn = (bad / valid in the short window) / (1 − target)
 *
 * A burn of 1 spends the budget exactly over the window; 14.4 over 1 h spends 2 % of a
 * 30-day budget in an hour (the classic fast-burn page), 6 over 6 h is the slow burn.
 * Targets are editable (sensitive action "slo_targets_set"); defaults below.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CONFIG_KEY = 'devdash_slo_targets';
const FAST_BURN = 14.4;
const SLOW_BURN = 6;
const LATENCY_MS = Number(process.env.SLO_LATENCY_MS) || 1000;

const model = (name) => require(`../../models/${name}`);
const bucket = (field, ms) => ({ $toDate: { $subtract: [{ $toLong: `$${field}` }, { $mod: [{ $toLong: `$${field}` }, ms] }] } });
const USER_ROUTES = { route: { $not: /^\/api\/(developer|mobile\/telemetry)/ } };

/** Each `buckets(from, to, ms)` resolves to [{ t, good, bad }]. */
const SLOS = [
  {
    key: 'api_availability',
    name: 'API availability',
    description: 'Share of API requests that did not fail with a 5xx.',
    target: 99.5,
    buckets: (from, to, ms) =>
      model('ApiMetricMinute').aggregate([
        { $match: { minute: { $gte: from, $lt: to }, ...USER_ROUTES } },
        { $group: { _id: bucket('minute', ms), total: { $sum: '$count' }, bad: { $sum: '$c5xx' } } },
        { $project: { _id: 0, t: '$_id', bad: 1, good: { $subtract: ['$total', '$bad'] } } },
      ]),
  },
  {
    key: 'api_latency',
    name: 'API latency',
    description: `Share of API requests answered within ${LATENCY_MS} ms.`,
    target: 99,
    buckets: (from, to, ms) =>
      model('ApiMetricMinute').aggregate([
        { $match: { minute: { $gte: from, $lt: to }, slow: { $exists: true }, ...USER_ROUTES } },
        { $group: { _id: bucket('minute', ms), total: { $sum: '$count' }, bad: { $sum: '$slow' } } },
        { $project: { _id: 0, t: '$_id', bad: 1, good: { $subtract: ['$total', '$bad'] } } },
      ]),
  },
  {
    key: 'uptime',
    name: 'Uptime (synthetic)',
    description: 'Share of synthetic probe runs (API, web, realtime, login journey) that passed.',
    target: 99.5,
    buckets: (from, to, ms) =>
      model('SyntheticRun').aggregate([
        { $match: { at: { $gte: from, $lt: to } } },
        { $group: { _id: bucket('at', ms), good: { $sum: { $cond: ['$ok', 1, 0] } }, bad: { $sum: { $cond: ['$ok', 0, 1] } } } },
        { $project: { _id: 0, t: '$_id', good: 1, bad: 1 } },
      ]),
  },
  {
    key: 'webhooks',
    name: 'Stripe webhook processing',
    description: 'Share of Stripe events processed; events still failing after 15 min count as bad.',
    target: 99.9,
    buckets: (from, to, ms) =>
      model('StripeEvent').aggregate([
        { $match: { createdAt: { $gte: from, $lt: to } } },
        {
          $group: {
            _id: bucket('createdAt', ms),
            good: { $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] } },
            bad: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'processed'] }, { $lt: ['$createdAt', new Date(Date.now() - 15 * 60 * 1000)] }] }, 1, 0] } },
          },
        },
        { $project: { _id: 0, t: '$_id', good: 1, bad: 1 } },
      ]),
  },
  ...['email', 'push'].map((channel) => ({
    key: `${channel}_delivery`,
    name: channel === 'email' ? 'Email delivery' : 'Push delivery',
    description: `Share of ${channel} sends accepted by the provider (skipped sends are not counted).`,
    target: channel === 'email' ? 99 : 98,
    buckets: (from, to, ms) =>
      model('DeliveryLog').aggregate([
        { $match: { channel, at: { $gte: from, $lt: to }, status: { $ne: 'skipped' } } },
        { $group: { _id: bucket('at', ms), good: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } }, bad: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 0, 1] } } } },
        { $project: { _id: 0, t: '$_id', good: 1, bad: 1 } },
      ]),
  })),
  {
    key: 'scheduler',
    name: 'Background jobs',
    description: 'Share of scheduler runs (escrow release, payout retries, reconciliation…) that succeeded.',
    target: 99,
    buckets: (from, to, ms) =>
      model('SchedulerRun').aggregate([
        { $match: { startedAt: { $gte: from, $lt: to } } },
        { $group: { _id: bucket('startedAt', ms), good: { $sum: { $cond: ['$ok', 1, 0] } }, bad: { $sum: { $cond: ['$ok', 0, 1] } } } },
        { $project: { _id: 0, t: '$_id', good: 1, bad: 1 } },
      ]),
  },
  {
    key: 'mobile_crash_free',
    name: 'Mobile crash-free sessions',
    description: 'Share of app sessions without a fatal crash.',
    target: 99.5,
    buckets: (from, to, ms) =>
      model('MobileEvent').aggregate([
        { $match: { at: { $gte: from, $lt: to }, $or: [{ type: 'session' }, { type: 'error', fatal: true }] } },
        { $group: { _id: bucket('at', ms), sessions: { $sum: { $cond: [{ $eq: ['$type', 'session'] }, 1, 0] } }, crashed: { $addToSet: { $cond: ['$fatal', '$sessionId', '$$REMOVE'] } } } },
        { $project: { _id: 0, t: '$_id', bad: { $size: '$crashed' }, good: { $max: [0, { $subtract: ['$sessions', { $size: '$crashed' }] }] } } },
      ]),
  },
];

async function getTargets() {
  try {
    const doc = await model('GlobalConfig').findOne({ key: CONFIG_KEY }).lean();
    return { ...Object.fromEntries(SLOS.map((s) => [s.key, s.target])), ...(doc?.value && typeof doc.value === 'object' ? doc.value : {}) };
  } catch {
    return Object.fromEntries(SLOS.map((s) => [s.key, s.target]));
  }
}

const sum = (rows) => rows.reduce((a, r) => ({ good: a.good + (r.good || 0), bad: a.bad + (r.bad || 0) }), { good: 0, bad: 0 });

/** Pure: SLI, budget and burn for one SLO. Unit-tested. */
function evaluate(target, window, last1h, last6h) {
  const allowed = 1 - target / 100;
  const total = window.good + window.bad;
  const burn = (w) => {
    const n = w.good + w.bad;
    return n ? w.bad / n / allowed : null;
  };
  const sli = total ? (window.good / total) * 100 : null;
  const budget = total * allowed; // bad events the window may contain
  const remaining = total ? (budget > 0 ? Math.max(-999, ((budget - window.bad) / budget) * 100) : window.bad ? -999 : 100) : null;
  const b1 = burn(last1h);
  const b6 = burn(last6h);
  const status =
    total === 0 ? 'no_data' : sli < target ? 'breached' : b1 !== null && b1 >= FAST_BURN ? 'fast_burn' : (b6 !== null && b6 >= SLOW_BURN) || remaining <= 25 ? 'at_risk' : 'ok';
  return { sli, total, bad: window.bad, budget, remaining, burn1h: b1, burn6h: b6, status };
}

async function computeSlos({ windowDays = 30, withSeries = true } = {}) {
  const to = new Date();
  const from = new Date(to - windowDays * DAY);
  const targets = await getTargets();
  return Promise.all(
    SLOS.map(async (s) => {
      const [daily, h1, h6] = await Promise.all([
        s.buckets(from, to, DAY),
        s.buckets(new Date(to - HOUR), to, HOUR + 1),
        s.buckets(new Date(to - 6 * HOUR), to, 6 * HOUR + 1),
      ]);
      const target = Number(targets[s.key]) || s.target;
      const result = evaluate(target, sum(daily), sum(h1), sum(h6));
      // Budget remaining day by day (cumulative), for the burn-down chart.
      let good = 0;
      let bad = 0;
      const series = withSeries
        ? daily
            .sort((a, b) => a.t - b.t)
            .map((d) => {
              good += d.good;
              bad += d.bad;
              const n = d.good + d.bad;
              return { t: d.t, sli: n ? (d.good / n) * 100 : null, remaining: evaluate(target, { good, bad }, { good: 0, bad: 0 }, { good: 0, bad: 0 }).remaining };
            })
        : undefined;
      return { key: s.key, name: s.name, description: s.description, target, defaultTarget: s.target, windowDays, ...result, series };
    })
  );
}

/** Fast-burn SLOs for the alert engine (cheap: 1 h and 6 h windows only). */
async function burningSlos() {
  const to = new Date();
  const targets = await getTargets();
  const out = [];
  for (const s of SLOS) {
    const [h1, h6] = await Promise.all([s.buckets(new Date(to - HOUR), to, HOUR + 1), s.buckets(new Date(to - 6 * HOUR), to, 6 * HOUR + 1)]);
    const w1 = sum(h1);
    // ponytail: needs ≥ 20 events in the hour, so one failure at night does not page anyone.
    if (w1.good + w1.bad < 20) continue;
    const r = evaluate(Number(targets[s.key]) || s.target, sum(h6), w1, sum(h6));
    if (r.burn1h >= FAST_BURN) out.push({ key: s.key, name: s.name, burn1h: r.burn1h });
  }
  return out;
}

module.exports = { SLOS, CONFIG_KEY, FAST_BURN, SLOW_BURN, evaluate, computeSlos, burningSlos, getTargets };
