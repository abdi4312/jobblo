const net = require('net');
const mongoose = require('mongoose');

/**
 * Fraud & abuse detection: explainable rules over data the platform already has, scored
 * per user. Each hit says which rule fired and why, with links to the records — no black
 * box. Nothing here changes an account; developers review and hand confirmed cases to admins.
 *
 * Privacy: chat messages are pattern-matched inside MongoDB; only counts and chat ids leave
 * the database (reading the messages goes through the admin chat review, which logs access).
 * IP-based rules ignore private, loopback and link-local addresses (shared by everyone
 * behind a NAT / in development).
 */

const DAY = 24 * 60 * 60 * 1000;
const model = (name) => require(`../../models/${name}`);
const since = (days) => new Date(Date.now() - days * DAY);
const sid = (v) => (v ? String(v) : null);

/** Pure: a routable, non-private address worth correlating on. Unit-tested. */
function isPublicIp(raw) {
  const ip = String(raw || '').replace(/^::ffff:/i, '');
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return !(a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127));
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    return !(s === '::1' || s === '::' || s.startsWith('fc') || s.startsWith('fd') || s.startsWith('fe80'));
  }
  return false;
}

const GENERIC_DEVICES = /^(unknown|desktop|mobile|web|other|browser|smoke-test)?$/i;
/** Pure: build per-user fingerprints (public IPs, specific device names) from sessions. */
function fingerprints(sessions) {
  const byUser = new Map();
  for (const s of sessions) {
    const u = sid(s.userId);
    if (!u) continue;
    if (!byUser.has(u)) byUser.set(u, { ips: new Set(), devices: new Set() });
    const f = byUser.get(u);
    if (isPublicIp(s.ip)) f.ips.add(String(s.ip).replace(/^::ffff:/i, ''));
    const dev = String(s.deviceName || '').trim();
    if (!GENERIC_DEVICES.test(dev)) f.devices.add(`${dev}|${s.os || ''}`.toLowerCase());
  }
  return byUser;
}

/** Pure: shared IPs / devices between two users. */
function overlap(a, b) {
  if (!a || !b) return null;
  const ips = [...a.ips].filter((x) => b.ips.has(x));
  const devices = [...a.devices].filter((x) => b.devices.has(x));
  return ips.length || devices.length ? { ips, devices: devices.map((d) => d.split('|')[0]) } : null;
}

// Off-platform payment / contact circumvention (Norwegian + English).
const OFF_PLATFORM = [
  '(\\+47[\\s-]?)?\\b[49]\\d{2}[\\s-]?\\d{2}[\\s-]?\\d{3}\\b', // NO mobile number
  '[\\w.+-]+@[\\w-]+\\.[a-z]{2,}', // email address
  '\\b\\d{4}[\\s.]?\\d{2}[\\s.]?\\d{5}\\b', // NO bank account
  '\\b(vipps|kontant|kontanter|cash|bankkonto|kontonummer|whatsapp|telegram|snapchat)\\b',
  '(betal|betale|betaler|pay)\\s+(\\w+\\s+)?(utenom|direkte|outside|directly)', // one word may sit between: "pay me directly"
  'utenfor\\s+(appen|jobblo)',
].join('|');

/** Every rule returns hits: { userId, rule, weight, evidence, related?, refs? }. */
const RULES = {
  shared_ip: {
    title: 'Many accounts from one network/device',
    category: 'multi-accounting',
    async run({ sessions }) {
      const groups = new Map();
      for (const s of sessions) {
        const ip = String(s.ip || '').replace(/^::ffff:/i, '');
        if (!isPublicIp(ip)) continue;
        if (!groups.has(ip)) groups.set(ip, new Set());
        groups.get(ip).add(sid(s.userId));
      }
      const hits = [];
      for (const [ip, users] of groups) {
        if (users.size < 3) continue;
        for (const u of users) hits.push({ userId: u, rule: 'shared_ip', weight: Math.min(30, 10 + users.size * 3), evidence: `IP ${ip} used by ${users.size} accounts in 30 days`, related: [...users].filter((x) => x !== u) });
      }
      return hits;
    },
  },
  self_dealing: {
    title: 'Customer and provider look like the same person',
    category: 'collusion',
    async run({ fp }) {
      const orders = await model('Order').find({ createdAt: { $gte: since(90) }, paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } }).select('customerId providerId agreedPrice').lean();
      const hits = [];
      for (const o of orders) {
        const shared = overlap(fp.get(sid(o.customerId)), fp.get(sid(o.providerId)));
        if (!shared) continue;
        const what = [shared.ips.length ? `IP ${shared.ips.join(', ')}` : null, shared.devices.length ? `device ${shared.devices.join(', ')}` : null].filter(Boolean).join(' and ');
        for (const [u, other] of [[o.customerId, o.providerId], [o.providerId, o.customerId]]) {
          hits.push({ userId: sid(u), rule: 'self_dealing', weight: 40, evidence: `Paid order ${String(o._id).slice(-8).toUpperCase()} (${o.agreedPrice ?? '?'} NOK): customer and provider share ${what}`, related: [sid(other)], refs: [{ type: 'order', id: sid(o._id) }] });
        }
      }
      return hits;
    },
  },
  refund_abuse: {
    title: 'Repeated refunds',
    category: 'payments',
    async run() {
      const rows = await model('Order').aggregate([
        { $match: { createdAt: { $gte: since(60) }, paymentStatus: { $in: ['paid', 'partially_refunded', 'refunded'] } } },
        { $group: { _id: '$customerId', paid: { $sum: 1 }, refunded: { $sum: { $cond: [{ $in: ['$paymentStatus', ['refunded', 'partially_refunded']] }, 1, 0] } } } },
        { $match: { refunded: { $gte: 3 } } },
      ]);
      return rows.map((r) => ({ userId: sid(r._id), rule: 'refund_abuse', weight: r.refunded / r.paid >= 0.5 ? 30 : 20, evidence: `${r.refunded} of ${r.paid} paid orders refunded in 60 days` }));
    },
  },
  disputes: {
    title: 'Dispute-heavy account',
    category: 'payments',
    async run() {
      const rows = await model('Dispute').aggregate([
        { $match: { createdAt: { $gte: since(60) } } },
        { $facet: { opened: [{ $group: { _id: '$openedBy', n: { $sum: 1 } } }, { $match: { n: { $gte: 2 } } }], against: [{ $group: { _id: '$openedAgainst', n: { $sum: 1 } } }, { $match: { n: { $gte: 3 } } }] } },
      ]);
      const r = rows[0] || { opened: [], against: [] };
      return [
        ...r.opened.map((x) => ({ userId: sid(x._id), rule: 'disputes', weight: 20, evidence: `Opened ${x.n} disputes in 60 days` })),
        ...r.against.map((x) => ({ userId: sid(x._id), rule: 'disputes', weight: 20, evidence: `${x.n} disputes opened against this account in 60 days` })),
      ];
    },
  },
  chargebacks: {
    title: 'Card chargeback',
    category: 'payments',
    async run() {
      const incidents = await model('StripePaymentIncident').find({ kind: 'charge_dispute', createdAt: { $gte: since(180) } }).select('orderId').lean();
      if (!incidents.length) return [];
      const orders = await model('Order').find({ _id: { $in: incidents.map((i) => i.orderId).filter(Boolean) } }).select('customerId').lean();
      return orders.map((o) => ({ userId: sid(o.customerId), rule: 'chargebacks', weight: 40, evidence: `Bank chargeback on order ${String(o._id).slice(-8).toUpperCase()}`, refs: [{ type: 'order', id: sid(o._id) }] }));
    },
  },
  off_platform: {
    title: 'Pushing payment or contact off the platform',
    category: 'circumvention',
    async run() {
      const rows = await model('ChatMessage').aggregate([
        { $match: { updatedAt: { $gte: since(30) } } },
        { $unwind: '$messages' },
        { $match: { 'messages.type': 'text', 'messages.createdAt': { $gte: since(30) } } },
        { $match: { $expr: { $regexMatch: { input: { $ifNull: ['$messages.text', ''] }, regex: OFF_PLATFORM, options: 'i' } } } },
        { $group: { _id: '$messages.senderId', chats: { $addToSet: '$_id' }, messages: { $sum: 1 } } },
        { $project: { chats: { $slice: ['$chats', 20] }, chatCount: { $size: '$chats' }, messages: 1 } },
        { $match: { chatCount: { $gte: 2 } } },
      ]);
      return rows.map((r) => ({ userId: sid(r._id), rule: 'off_platform', weight: r.chatCount >= 5 ? 30 : 15, evidence: `${r.messages} messages in ${r.chatCount} chats share contact or off-platform payment details (30 days)`, refs: r.chats.map((c) => ({ type: 'chat', id: sid(c) })) }));
    },
  },
  listing_spam: {
    title: 'Listing spam',
    category: 'spam',
    async run() {
      const rows = await model('Service').aggregate([
        { $match: { createdAt: { $gte: since(14) } } },
        { $group: { _id: { u: '$userId', day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } }, n: { $sum: 1 }, titles: { $push: { $toLower: { $trim: { input: { $ifNull: ['$title', ''] } } } } } } },
        { $group: { _id: '$_id.u', maxPerDay: { $max: '$n' }, titles: { $push: '$titles' } } },
      ]);
      const hits = [];
      for (const r of rows) {
        const counts = {};
        for (const t of r.titles.flat()) counts[t] = (counts[t] || 0) + 1;
        const dupes = Object.values(counts).filter((n) => n >= 3).length;
        if (r.maxPerDay >= 10) hits.push({ userId: sid(r._id), rule: 'listing_spam', weight: 20, evidence: `${r.maxPerDay} jobs posted in one day` });
        if (dupes) hits.push({ userId: sid(r._id), rule: 'listing_spam', weight: 15, evidence: `${dupes} job title(s) posted 3+ times in 14 days` });
      }
      return hits;
    },
  },
  new_account_velocity: {
    title: 'Brand-new account moving fast',
    category: 'spam',
    async run() {
      const fresh = await model('User').find({ createdAt: { $gte: since(2) } }).select('_id createdAt').lean();
      if (!fresh.length) return [];
      const ids = fresh.map((u) => u._id);
      const [orders, chats] = await Promise.all([
        model('Order').aggregate([{ $match: { customerId: { $in: ids } } }, { $group: { _id: '$customerId', n: { $sum: 1 } } }]),
        model('ChatMessage').aggregate([{ $match: { clientId: { $in: ids } } }, { $group: { _id: '$clientId', n: { $sum: 1 } } }]),
      ]);
      const o = Object.fromEntries(orders.map((x) => [sid(x._id), x.n]));
      const c = Object.fromEntries(chats.map((x) => [sid(x._id), x.n]));
      return fresh
        .filter((u) => (o[sid(u._id)] || 0) >= 3 || (c[sid(u._id)] || 0) >= 8)
        .map((u) => ({ userId: sid(u._id), rule: 'new_account_velocity', weight: 15, evidence: `Account under 48 h old with ${o[sid(u._id)] || 0} orders and ${c[sid(u._id)] || 0} chats` }));
    },
  },
  reports_received: {
    title: 'Reported by other users',
    category: 'conduct',
    async run() {
      const [chat, job] = await Promise.all([
        model('ChatReport').aggregate([{ $match: { createdAt: { $gte: since(90) } } }, { $group: { _id: '$reportedUser', n: { $sum: 1 }, by: { $addToSet: '$reportedBy' } } }]),
        model('JobReport').aggregate([{ $match: { createdAt: { $gte: since(90) } } }, { $group: { _id: '$reportedUser', n: { $sum: 1 }, by: { $addToSet: '$reportedBy' } } }]),
      ]);
      const by = new Map();
      for (const r of [...chat, ...job]) {
        const k = sid(r._id);
        const cur = by.get(k) || { n: 0, reporters: new Set() };
        cur.n += r.n;
        r.by.forEach((x) => cur.reporters.add(sid(x)));
        by.set(k, cur);
      }
      return [...by]
        .filter(([, v]) => v.reporters.size >= 2)
        .map(([u, v]) => ({ userId: u, rule: 'reports_received', weight: v.reporters.size >= 4 ? 30 : 15, evidence: `${v.n} reports from ${v.reporters.size} different users in 90 days`, related: [...v.reporters] }));
    },
  },
  review_manipulation: {
    title: 'Suspicious reviews',
    category: 'reputation',
    async run({ fp }) {
      const reviews = await model('Review').find({ createdAt: { $gte: since(90) } }).populate('reviewerId', 'createdAt').select('reviewerId revieweeId rating createdAt').lean();
      const hits = [];
      const freshFives = new Map();
      for (const r of reviews) {
        const reviewer = sid(r.reviewerId?._id);
        const reviewee = sid(r.revieweeId);
        if (!reviewer || !reviewee) continue;
        const shared = overlap(fp.get(reviewer), fp.get(reviewee));
        if (shared && r.rating >= 4) hits.push({ userId: reviewee, rule: 'review_manipulation', weight: 25, evidence: `${r.rating}★ review from an account sharing ${shared.ips.length ? 'an IP' : 'a device'} with this user`, related: [reviewer] });
        if (r.rating === 5 && r.reviewerId?.createdAt && new Date(r.createdAt) - new Date(r.reviewerId.createdAt) < DAY) {
          if (!freshFives.has(reviewee)) freshFives.set(reviewee, new Set());
          freshFives.get(reviewee).add(reviewer);
        }
      }
      for (const [u, reviewers] of freshFives) {
        if (reviewers.size >= 2) hits.push({ userId: u, rule: 'review_manipulation', weight: 20, evidence: `${reviewers.size} five-star reviews from accounts less than a day old`, related: [...reviewers] });
      }
      return hits;
    },
  },
  checkout_churn: {
    title: 'Many abandoned checkouts (possible card testing)',
    category: 'payments',
    async run() {
      const rows = await model('Order').aggregate([
        { $match: { createdAt: { $gte: since(1) }, checkoutSessionId: { $nin: [null, ''] }, paymentStatus: { $in: ['unpaid', 'pending'] } } },
        { $group: { _id: '$customerId', n: { $sum: 1 } } },
        { $match: { n: { $gte: 5 } } },
      ]);
      return rows.map((r) => ({ userId: sid(r._id), rule: 'checkout_churn', weight: 20, evidence: `${r.n} checkouts started but not paid in 24 h` }));
    },
  },
};

/** Pure: total score and level from a user's hits (same rule counts once, at its strongest). */
function score(hits) {
  const best = new Map();
  for (const h of hits) best.set(`${h.rule}|${h.evidence.split(':')[0]}`, Math.max(best.get(`${h.rule}|${h.evidence.split(':')[0]}`) || 0, h.weight));
  const perRule = new Map();
  for (const h of hits) perRule.set(h.rule, Math.max(perRule.get(h.rule) || 0, h.weight));
  const total = Math.min(100, [...perRule.values()].reduce((a, w) => a + w, 0));
  return { score: total, level: total >= 60 ? 'high' : total >= 30 ? 'medium' : 'low' };
}

let cache = { at: 0, value: null };

async function scan({ force = false } = {}) {
  if (!force && cache.value && Date.now() - cache.at < 10 * 60 * 1000) return cache.value;
  const sessions = await model('Session').find({ $or: [{ lastUsed: { $gte: since(30) } }, { createdAt: { $gte: since(30) } }] }).select('userId ip deviceName os').lean();
  const ctx = { sessions, fp: fingerprints(sessions) };
  const results = await Promise.all(
    Object.entries(RULES).map(async ([key, r]) => {
      try {
        return { key, hits: await r.run(ctx) };
      } catch (e) {
        return { key, hits: [], error: e.message };
      }
    })
  );
  const byUser = new Map();
  for (const { hits } of results) for (const h of hits) if (h.userId && mongoose.isValidObjectId(h.userId)) (byUser.get(h.userId) || byUser.set(h.userId, []).get(h.userId)).push(h);
  const ids = [...byUser.keys()];
  const [users, cases] = await Promise.all([
    model('User').find({ _id: { $in: ids } }).select('name email role accountStatus isDeleted createdAt avatarUrl').lean(),
    model('FraudCase').find({ userId: { $in: ids } }).populate('reviewedBy', 'name').lean(),
  ]);
  const U = new Map(users.map((u) => [sid(u._id), u]));
  const C = new Map(cases.map((c) => [sid(c.userId), c]));
  const flagged = ids
    .map((id) => {
      const hits = byUser.get(id);
      const s = score(hits);
      const c = C.get(id);
      // A reviewed case comes back only when the score rose since the review.
      const reopened = Boolean(c && ['dismissed', 'confirmed'].includes(c.status) && s.score > (c.scoreAtReview ?? 0));
      return {
        userId: id,
        user: U.get(id) ? { name: U.get(id).name, email: U.get(id).email, role: U.get(id).role, accountStatus: U.get(id).isDeleted ? 'deleted' : U.get(id).accountStatus, createdAt: U.get(id).createdAt, avatarUrl: U.get(id).avatarUrl } : null,
        ...s,
        rules: [...new Set(hits.map((h) => h.rule))],
        hits,
        status: c ? (reopened ? 'open' : c.status) : 'open',
        reopened,
        review: c ? { note: c.note, by: c.reviewedBy?.name || null, at: c.reviewedAt, scoreAtReview: c.scoreAtReview } : null,
      };
    })
    .filter((f) => f.user)
    .sort((a, b) => b.score - a.score);
  const ruleStats = results.map((r) => ({ key: r.key, title: RULES[r.key].title, category: RULES[r.key].category, users: new Set(r.hits.map((h) => h.userId)).size, error: r.error || null }));
  cache = { at: Date.now(), value: { generatedAt: new Date(), sessionsScanned: sessions.length, flagged, ruleStats } };
  return cache.value;
}

/** For the alert engine: high-risk cases nobody has looked at. */
async function openHighRisk() {
  const r = await scan();
  return r.flagged.filter((f) => f.level === 'high' && f.status === 'open').map((f) => ({ userId: f.userId, name: f.user.name, score: f.score, rules: f.rules }));
}

module.exports = { RULES, isPublicIp, fingerprints, overlap, score, scan, openHighRisk, OFF_PLATFORM, invalidate: () => (cache = { at: 0, value: null }) };
