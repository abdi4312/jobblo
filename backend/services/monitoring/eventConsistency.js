/**
 * Event consistency monitor: job, payment, webhook and notification events that were
 * MISSING (should have happened, never did), DUPLICATE (happened twice) or OUT OF ORDER
 * (happened in an order the business flow does not allow). Read-only.
 * Duplicate *records* (two Payments for one order, ...) live on the Data Integrity page;
 * this page is about the events and their sequence.
 */

const MIN = 60_000;
const DAY = 86_400_000;
const STUCK_AFTER = 15 * MIN;
const TOLERANCE = 1000; // clocks and same-request writes: under a second is "same time"

// Lifecycle rank inside one Stripe event family (same object). A lower rank arriving after
// a higher one for the same object = out of order. Handlers must then not regress state.
const LIFECYCLE = {
  'customer.subscription.created': 0,
  'customer.subscription.updated': 1,
  'customer.subscription.deleted': 2,
  'subscription_schedule.created': 0,
  'subscription_schedule.updated': 1,
  'subscription_schedule.released': 2,
  'subscription_schedule.canceled': 2,
  'subscription_schedule.completed': 2,
  'payment_intent.created': 0,
  'payment_intent.processing': 1,
  'payment_intent.succeeded': 2,
  'payment_intent.payment_failed': 2,
  'payment_intent.canceled': 2,
  'invoice.created': 0,
  'invoice.finalized': 1,
  'invoice.paid': 2,
  'invoice.payment_failed': 2,
  'refund.created': 0,
  'refund.updated': 1,
  'charge.succeeded': 0,
  'charge.refunded': 1,
};
const family = (type) => type.slice(0, type.lastIndexOf('.'));

/** Pure: events of one object, any order → pairs that arrived against the lifecycle. Unit-tested. */
function outOfOrder(events) {
  const sorted = [...events].sort((a, b) => +new Date(a.at) - +new Date(b.at));
  const issues = [];
  const highest = {}; // family → highest-ranked event seen so far
  for (const e of sorted) {
    const rank = LIFECYCLE[e.type];
    if (rank === undefined) continue;
    const f = family(e.type);
    const h = highest[f];
    if (h && rank < h.rank) issues.push({ late: e.type, after: h.type, lateAt: e.at, afterAt: h.at });
    if (!h || rank > h.rank) highest[f] = { rank, type: e.type, at: e.at };
  }
  return issues;
}

// A job's steps, in the only order the flow allows.
const STEPS = [
  ['createdAt', 'created'],
  ['paymentConfirmedAt', 'paid'],
  ['startedAt', 'started'],
  ['readyForReviewAt', 'ready for review'],
  ['completedAt', 'completed'],
];

/** Pure: missing and out-of-order steps of one order. Unit-tested. */
function orderSequence(o) {
  const issues = [];
  let prev = null;
  for (const [field, label] of STEPS) {
    if (!o[field]) continue;
    const t = +new Date(o[field]);
    if (prev && t + TOLERANCE < prev.t) issues.push({ kind: 'out_of_order', detail: `${label} (${new Date(t).toISOString()}) before ${prev.label} (${new Date(prev.t).toISOString()})` });
    if (!prev || t > prev.t) prev = { t, label };
  }
  if (o.status === 'completed' && !o.completedAt) issues.push({ kind: 'missing', detail: 'status completed but no completedAt' });
  if (['paid', 'partially_refunded', 'refunded'].includes(o.paymentStatus) && !o.paymentConfirmedAt) issues.push({ kind: 'missing', detail: `paymentStatus ${o.paymentStatus} but no paymentConfirmedAt` });
  if (o.status === 'ready_for_review' && !o.readyForReviewAt) issues.push({ kind: 'missing', detail: 'status ready_for_review but no readyForReviewAt' });
  return issues;
}

/** Pure: groups of ≥2 rows with the same key within `windowMs` of each other. Unit-tested. */
function bursts(rows, keyOf, windowMs) {
  const by = new Map();
  for (const r of [...rows].sort((a, b) => +new Date(a.at) - +new Date(b.at))) {
    const k = keyOf(r);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const out = [];
  for (const [key, list] of by) {
    let group = [list[0]];
    for (let i = 1; i <= list.length; i++) {
      const r = list[i];
      if (r && +new Date(r.at) - +new Date(group[group.length - 1].at) <= windowMs) group.push(r);
      else {
        if (group.length > 1) out.push({ key, n: group.length, first: group[0].at, last: group[group.length - 1].at, ids: group.map((g) => String(g._id)) });
        group = r ? [r] : [];
      }
    }
  }
  return out.sort((a, b) => b.n - a.n);
}


/** Stripe events vs what this database received. ponytail: last 3 days, max 300 events; cached 10 min. */
let stripeCache = { at: 0, value: null };
async function stripeNotReceived() {
  if (stripeCache.value && Date.now() - stripeCache.at < 10 * MIN) return stripeCache.value;
  const handled = new Set(require('./configDrift').handledStripeEvents());
  let value;
  try {
    const stripe = await require('../../config/stripe').getStripe();
    const since = Math.floor((Date.now() - 3 * DAY) / 1000);
    const settled = Date.now() - 5 * MIN; // newer events may still be in flight
    const events = [];
    for await (const e of stripe.events.list({ created: { gte: since }, limit: 100 })) {
      if (handled.has(e.type) && e.created * 1000 < settled) events.push({ id: e.id, type: e.type, at: new Date(e.created * 1000) });
      if (events.length >= 300) break;
    }
    const ids = events.map((e) => e.id);
    const [a, b] = await Promise.all([
      require('../../models/StripeEvent').find({ eventId: { $in: ids } }).distinct('eventId'),
      require('../../models/SubscriptionWebhookEventV2').find({ stripeEventId: { $in: ids } }).distinct('stripeEventId'),
    ]);
    const got = new Set([...a, ...b]);
    const missing = events.filter((e) => !got.has(e.id));
    // None of Stripe's events reached this database: webhooks go to another deployment.
    const elsewhere = events.length >= 5 && got.size === 0;
    value = { ok: true, checked: events.length, elsewhere, missing: elsewhere ? [] : missing };
  } catch (e) {
    value = { ok: false, error: e.message, checked: 0, missing: [] };
  }
  stripeCache = { at: Date.now(), value };
  return value;
}

const CHECKS = [
  {
    key: 'webhook_not_received',
    area: 'webhook',
    kind: 'missing',
    severity: 'critical',
    title: 'Stripe event never received',
    why: 'Stripe created a handled event in the last 3 days that never reached this server — the order, refund or subscription it describes was not updated.',
    async run() {
      const r = await stripeNotReceived();
      if (!r.ok) return { skipped: `Stripe not reachable: ${r.error}` };
      if (r.elsewhere) return { skipped: `None of the ${r.checked} recent Stripe events reached this database — webhooks are delivered to another deployment. Run this check there.` };
      return { count: r.missing.length, checked: r.checked, samples: r.missing.slice(0, 20).map((e) => ({ ref: e.id, detail: e.type, at: e.at })) };
    },
  },
  {
    key: 'webhook_stuck',
    area: 'webhook',
    kind: 'missing',
    severity: 'high',
    title: 'Webhook claimed but never finished',
    why: 'The event was accepted but its handler never completed (crash or failure). Stripe retries for 3 days; after that the change is lost.',
    async run() {
      const before = new Date(Date.now() - STUCK_AFTER);
      const [a, b] = await Promise.all([
        require('../../models/StripeEvent').find({ status: 'processing', updatedAt: { $lt: before } }).sort({ updatedAt: -1 }).limit(50).select('eventId type attempts lastError updatedAt').lean(),
        require('../../models/SubscriptionWebhookEventV2').find({ status: { $in: ['received', 'processing', 'failed'] }, updatedAt: { $lt: before } }).sort({ updatedAt: -1 }).limit(50).select('stripeEventId eventType status attempts lastErrorMessage updatedAt').lean(),
      ]);
      const rows = [
        ...a.map((e) => ({ ref: e.eventId, detail: `${e.type} · ${e.attempts} attempt(s)${e.lastError ? ` · ${e.lastError}` : ''}`, at: e.updatedAt })),
        ...b.map((e) => ({ ref: e.stripeEventId, detail: `${e.eventType} · subscription pipeline ${e.status} · ${e.attempts} attempt(s)${e.lastErrorMessage ? ` · ${e.lastErrorMessage}` : ''}`, at: e.updatedAt })),
      ];
      return { count: rows.length, samples: rows.slice(0, 20) };
    },
  },
  {
    key: 'webhook_out_of_order',
    area: 'webhook',
    kind: 'out_of_order',
    severity: 'medium',
    title: 'Stripe events for one object arrived out of order',
    why: 'Stripe does not guarantee order. If a handler trusts the payload instead of re-reading the object, an older event can overwrite newer state (e.g. "updated" after "deleted").',
    async run({ days }) {
      const rows = await require('../../models/StripeEvent').find({ createdAt: { $gte: new Date(Date.now() - days * DAY) }, objectId: { $ne: null } }).select('type objectId createdAt').lean();
      const by = new Map();
      for (const r of rows) {
        if (!by.has(r.objectId)) by.set(r.objectId, []);
        by.get(r.objectId).push({ type: r.type, at: r.createdAt });
      }
      const samples = [];
      for (const [obj, evs] of by) for (const i of outOfOrder(evs)) samples.push({ ref: obj, detail: `${i.late} arrived after ${i.after}`, at: i.lateAt });
      return { count: samples.length, samples: samples.slice(0, 20) };
    },
  },
  {
    key: 'webhook_redelivered',
    area: 'webhook',
    kind: 'duplicate',
    severity: 'low',
    title: 'Webhook delivered more than once (absorbed)',
    why: 'Stripe retried after a failure or timeout. Idempotency claims absorbed the repeat; many of these mean slow or failing handlers.',
    async run({ days }) {
      const since = new Date(Date.now() - days * DAY);
      const rows = await require('../../models/StripeEvent').find({ attempts: { $gt: 1 }, createdAt: { $gte: since } }).sort({ attempts: -1 }).limit(50).select('eventId type attempts status createdAt').lean();
      return { count: rows.length, samples: rows.slice(0, 20).map((e) => ({ ref: e.eventId, detail: `${e.type} · ${e.attempts} deliveries · ${e.status}`, at: e.createdAt })) };
    },
  },
  {
    key: 'job_steps',
    area: 'job',
    kind: 'out_of_order',
    severity: 'high',
    title: 'Job steps recorded out of order',
    why: 'A job was e.g. completed before it was paid or started. Usually a handler wrote a step it should not have reached yet, or a timestamp was overwritten.',
    async run({ days }) {
      const orders = await require('../../models/Order').find({ updatedAt: { $gte: new Date(Date.now() - days * DAY) } }).select('status paymentStatus createdAt paymentConfirmedAt startedAt readyForReviewAt completedAt updatedAt').lean();
      const samples = [];
      for (const o of orders) for (const i of orderSequence(o)) if (i.kind === 'out_of_order') samples.push({ ref: String(o._id), link: 'job', detail: i.detail, at: o.updatedAt });
      return { count: samples.length, samples: samples.slice(0, 20) };
    },
  },
  {
    key: 'job_step_missing',
    area: 'job',
    kind: 'missing',
    severity: 'medium',
    title: 'Job status reached without its step event',
    why: 'The status says the step happened but its timestamp was never written, so timelines, SLAs and auto-release timers that read it are wrong.',
    async run({ days }) {
      const orders = await require('../../models/Order').find({ updatedAt: { $gte: new Date(Date.now() - days * DAY) } }).select('status paymentStatus createdAt paymentConfirmedAt startedAt readyForReviewAt completedAt updatedAt').lean();
      const samples = [];
      for (const o of orders) for (const i of orderSequence(o)) if (i.kind === 'missing') samples.push({ ref: String(o._id), link: 'job', detail: i.detail, at: o.updatedAt });
      return { count: samples.length, samples: samples.slice(0, 20) };
    },
  },
  {
    key: 'payment_not_recorded',
    area: 'payment',
    kind: 'missing',
    severity: 'critical',
    title: 'Order paid but no Payment recorded',
    why: 'The order was marked paid but the payment event never created its Payment row — refunds, payouts and the ledger cannot see the money.',
    async run({ days }) {
      const orders = await require('../../models/Order').find({ paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] }, updatedAt: { $gte: new Date(Date.now() - days * DAY) } }).select('paymentStatus agreedPrice paymentIntentId updatedAt').lean();
      const have = new Set((await require('../../models/Payment').find({ orderId: { $in: orders.map((o) => o._id) } }).distinct('orderId')).map(String));
      const rows = orders.filter((o) => !have.has(String(o._id)));
      return { count: rows.length, samples: rows.slice(0, 20).map((o) => ({ ref: String(o._id), link: 'job', detail: `${o.paymentStatus} · ${o.agreedPrice ?? '?'} NOK · ${o.paymentIntentId || 'no PaymentIntent'}`, at: o.updatedAt })) };
    },
  },
  {
    key: 'payment_state_lag',
    area: 'payment',
    kind: 'missing',
    severity: 'high',
    title: 'Payment and order disagree',
    why: 'A refund or capture updated one side but the event never reached the other (Payment refunded while the order still says paid, or the reverse).',
    async run({ days }) {
      const payments = await require('../../models/Payment').find({ updatedAt: { $gte: new Date(Date.now() - days * DAY) } }).select('orderId status updatedAt').lean();
      const orders = new Map((await require('../../models/Order').find({ _id: { $in: payments.map((p) => p.orderId) } }).select('paymentStatus').lean()).map((o) => [String(o._id), o]));
      const expect = { refunded: ['refunded'], partially_refunded: ['partially_refunded', 'refunded'], completed: ['paid', 'partially_refunded', 'refunded'], released: ['paid', 'partially_refunded', 'refunded'] };
      const rows = payments.filter((p) => expect[p.status] && orders.get(String(p.orderId)) && !expect[p.status].includes(orders.get(String(p.orderId)).paymentStatus));
      return { count: rows.length, samples: rows.slice(0, 20).map((p) => ({ ref: String(p.orderId), link: 'job', detail: `Payment ${p.status} · order paymentStatus ${orders.get(String(p.orderId)).paymentStatus}`, at: p.updatedAt })) };
    },
  },
  {
    key: 'safepay_duplicate_open',
    area: 'payment',
    kind: 'duplicate',
    severity: 'high',
    title: 'Escrow opened twice for one order',
    why: 'The payment event was processed twice and opened two SafePay records — the job may be released or refunded twice.',
    async run() {
      const SafePayHistory = require('../../models/SafePayHistory');
      const rows = await SafePayHistory.aggregate([{ $match: { status: { $in: SafePayHistory.OPEN_STATUSES } } }, { $group: { _id: '$orderId', n: { $sum: 1 }, last: { $max: '$updatedAt' } } }, { $match: { n: { $gt: 1 } } }, { $limit: 50 }]);
      return { count: rows.length, samples: rows.slice(0, 20).map((r) => ({ ref: String(r._id), link: 'job', detail: `${r.n} open SafePay records`, at: r.last })) };
    },
  },
  {
    key: 'notification_duplicate',
    area: 'notification',
    kind: 'duplicate',
    severity: 'medium',
    title: 'Same notification sent twice',
    why: 'Identical in-app notification to the same user within 2 minutes — a handler or retry ran twice.',
    async run({ days }) {
      const rows = await require('../../models/Notification').find({ createdAt: { $gte: new Date(Date.now() - days * DAY) } }).select('userId orderId type content createdAt').lean();
      const groups = bursts(rows.map((r) => ({ ...r, at: r.createdAt })), (r) => `${r.userId}|${r.orderId || ''}|${r.type}|${r.content}`, 2 * MIN);
      return {
        count: groups.length,
        samples: groups.slice(0, 20).map((g) => {
          const [userId, orderId, type, content] = g.key.split('|');
          return { ref: orderId || userId, link: orderId ? 'job' : 'user', detail: `${g.n}× ${type}: ${content.slice(0, 120)}`, at: g.last };
        }),
      };
    },
  },
  {
    key: 'notification_missing',
    area: 'notification',
    kind: 'missing',
    severity: 'medium',
    title: 'Job step with no notification',
    why: 'A job was paid or completed but nobody got an in-app notification about it afterwards.',
    async run({ days }) {
      const since = new Date(Date.now() - days * DAY);
      const orders = await require('../../models/Order').find({ $or: [{ paymentConfirmedAt: { $gte: since } }, { completedAt: { $gte: since } }] }).select('paymentConfirmedAt completedAt').lean();
      const notes = await require('../../models/Notification').find({ orderId: { $in: orders.map((o) => o._id) } }).select('orderId createdAt').lean();
      const latest = new Map();
      for (const n of notes) latest.set(String(n.orderId), Math.max(latest.get(String(n.orderId)) || 0, +n.createdAt));
      const samples = [];
      for (const o of orders) {
        for (const [field, label] of [['paymentConfirmedAt', 'paid'], ['completedAt', 'completed']]) {
          if (!o[field] || o[field] < since) continue;
          if ((latest.get(String(o._id)) || 0) < +o[field] - MIN) samples.push({ ref: String(o._id), link: 'job', detail: `${label} with no notification after it`, at: o[field] });
        }
      }
      return { count: samples.length, samples: samples.slice(0, 20) };
    },
  },
  {
    key: 'delivery_duplicate',
    area: 'notification',
    kind: 'duplicate',
    severity: 'low',
    title: 'Same email/push delivered twice',
    why: 'The same message to the same recipient within a minute — a retried job or double handler.',
    async run({ days }) {
      const rows = await require('../../models/DeliveryLog').find({ at: { $gte: new Date(Date.now() - days * DAY) }, status: { $in: ['sent', 'partial'] } }).select('channel template userId to at').lean();
      const groups = bursts(rows, (r) => `${r.channel}|${r.userId || r.to}|${r.template}`, MIN);
      return { count: groups.length, samples: groups.slice(0, 20).map((g) => ({ ref: g.key.split('|')[0], detail: `${g.n}× ${g.key.split('|')[2]}`, at: g.last })) };
    },
  },
];

async function runChecks({ days = 30 } = {}) {
  const results = await Promise.all(
    CHECKS.map(async (c) => {
      const started = Date.now();
      try {
        const r = await c.run({ days });
        return { key: c.key, area: c.area, kind: c.kind, severity: c.severity, title: c.title, why: c.why, ms: Date.now() - started, count: r.count ?? 0, checked: r.checked ?? null, skipped: r.skipped || null, samples: r.samples || [] };
      } catch (e) {
        return { key: c.key, area: c.area, kind: c.kind, severity: c.severity, title: c.title, why: c.why, ms: Date.now() - started, count: 0, error: e.message, samples: [] };
      }
    })
  );
  return { days, at: new Date(), checks: results };
}

module.exports = { outOfOrder, orderSequence, bursts, runChecks, CHECKS };
