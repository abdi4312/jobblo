const { sendSuccess, asyncHandler } = require('../../utils/apiResponse');
const { redactSensitive } = require('../../utils/sanitizer');
const { liveSnapshot, percentile } = require('../../middleware/requestMetrics');
const apm = require('../../services/monitoring/apm');
const securityEvents = require('../../services/monitoring/securityEvents');
const { getIO } = require('../../sockets/io');
const User = require('../../models/User');
const Order = require('../../models/Order');
const Payment = require('../../models/Payment');
const Session = require('../../models/Session');
const ErrorLog = require('../../models/ErrorLog');
const StripeEvent = require('../../models/StripeEvent');
const Notification = require('../../models/Notification');
const PushToken = require('../../models/PushToken');
const AdminActivity = require('../../models/AdminActivity');
const GlobalConfig = require('../../models/GlobalConfig');
const SchedulerRun = require('../../models/SchedulerRun');
const DeliveryLog = require('../../models/DeliveryLog');
const SecurityEvent = require('../../models/SecurityEvent');
const ApiMetricMinute = require('../../models/ApiMetricMinute');
const SubscriptionWebhookEventV2 = require('../../models/SubscriptionWebhookEventV2');
const { MINUTE, parseRange, bucketExpr, escapeRegex, rx, isId } = require('../../utils/devQuery');

/** Developer dashboard — operations (Phase 3): logs, live, security, flags, APM, delivery. */

const countBy = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? 'none', r.n]));
const shortId = (id) => (id ? `…${String(id).slice(-6)}` : null);

// ── 4. Logs explorer: one normalized, redacted stream over every log source ──
const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const SERVICES = ['api', 'audit', 'auth', 'scheduler', 'webhook', 'subscription', 'delivery'];

const SOURCES = {
  api: {
    model: ErrorLog,
    time: 'createdAt',
    filter: (q) => [
      q.userId && { userId: q.userId },
      q.traceId && { $or: [{ requestId: q.traceId }, { referenceId: q.traceId }] },
      q.orderId && { $or: [{ route: { $regex: escapeRegex(q.orderId) } }, { 'metadata.orderId': q.orderId }] },
      q.paymentId && { 'metadata.paymentIntentId': q.paymentId },
      q.q && { $or: [{ message: rx(q.q) }, { errorCode: rx(q.q) }, { route: rx(q.q) }] },
    ],
    map: (d) => ({
      level: d.severity === 'critical' ? 'fatal' : d.severity === 'warning' ? 'warn' : d.severity === 'info' ? 'info' : 'error',
      service: d.source === 'scheduler' ? 'scheduler' : /webhook/.test(d.source || '') ? 'webhook' : 'api',
      message: `${d.errorCode}: ${d.message}`,
      traceId: d.requestId || d.referenceId,
      userId: d.userId,
      data: { route: d.route, method: d.httpMethod, status: d.statusCode, referenceId: d.referenceId, metadata: d.metadata, stack: d.stack?.split('\n').slice(0, 4).join('\n') },
    }),
  },
  audit: {
    model: AdminActivity,
    time: 'createdAt',
    filter: (q) => [
      { type: 'audit' },
      q.userId && { $or: [{ adminId: q.userId }, { targetId: q.userId }] },
      q.orderId && { targetId: q.orderId },
      q.traceId && { 'metadata.correlationId': q.traceId },
      q.q && { description: rx(q.q) },
    ],
    map: (d) => ({ level: 'info', service: 'audit', message: d.description, traceId: d.metadata?.correlationId, userId: d.adminId, data: { action: d.action, target: d.targetModel, targetId: d.targetId, metadata: d.metadata, ip: d.ip } }),
  },
  auth: {
    model: SecurityEvent,
    time: 'at',
    filter: (q) => [q.userId && { userId: q.userId }, q.q && { $or: [{ type: rx(q.q) }, { route: rx(q.q) }, { ip: q.q }] }],
    map: (d) => ({ level: d.type === 'rate_limited' || d.type === 'login_failed' ? 'warn' : 'info', service: 'auth', message: `${d.type.replace(/_/g, ' ')} · ${d.method} ${d.route} → ${d.status}`, userId: d.userId, data: { ip: d.ip, code: d.code, email: d.email } }),
  },
  scheduler: {
    model: SchedulerRun,
    time: 'startedAt',
    filter: (q) => [q.q && { $or: [{ job: rx(q.q) }, { error: rx(q.q) }] }],
    map: (d) => ({ level: d.ok ? 'info' : 'error', service: 'scheduler', message: `${d.job} ${d.ok ? 'completed' : `failed: ${d.error}`} in ${d.durationMs}ms`, data: { result: d.result, trigger: d.trigger } }),
  },
  webhook: {
    model: StripeEvent,
    time: 'createdAt',
    filter: (q) => [q.traceId && { eventId: q.traceId }, q.paymentId && { objectId: q.paymentId }, q.q && { $or: [{ type: rx(q.q) }, { eventId: q.q }, { objectId: q.q }] }],
    map: (d) => ({ level: d.lastError && d.status !== 'processed' ? 'error' : d.status === 'processed' ? 'info' : 'debug', service: 'webhook', message: `${d.type} ${d.status === 'processed' ? 'processed' : d.lastError ? `failed: ${d.lastError}` : 'processing'}`, traceId: d.eventId, data: { objectId: d.objectId, attempts: d.attempts } }),
  },
  subscription: {
    model: SubscriptionWebhookEventV2,
    time: 'createdAt',
    filter: (q) => [q.traceId && { stripeEventId: q.traceId }, q.q && { eventType: rx(q.q) }],
    map: (d) => ({ level: d.status === 'failed' ? 'error' : 'info', service: 'subscription', message: `${d.eventType} ${d.status}${d.lastErrorCode ? `: ${d.lastErrorCode}` : ''}`, traceId: d.stripeEventId, data: { attempts: d.attempts, mode: d.stripeMode, error: d.lastErrorMessage } }),
  },
  delivery: {
    model: DeliveryLog,
    time: 'at',
    filter: (q) => [q.userId && { userId: q.userId }, q.q && { template: rx(q.q) }],
    map: (d) => ({ level: d.status === 'failed' ? 'error' : d.status === 'partial' ? 'warn' : 'info', service: 'delivery', message: `${d.channel} ${d.status}: ${d.template || ''}`, userId: d.userId, data: { to: d.to, latencyMs: d.latencyMs, error: d.error, errorCode: d.errorCode } }),
  },
};

const getLogs = asyncHandler(async (req, res) => {
  const { from, to } = parseRange(req.query);
  const before = req.query.before ? new Date(req.query.before) : null;
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300);
  const services = String(req.query.services || '').split(',').filter((s) => SERVICES.includes(s));
  const levels = String(req.query.levels || '').split(',').filter((l) => LEVELS.includes(l));
  const q = {
    q: String(req.query.q || '').trim().slice(0, 100) || null,
    userId: isId(req.query.userId) ? req.query.userId : null,
    orderId: isId(req.query.orderId) ? String(req.query.orderId) : null,
    traceId: String(req.query.traceId || '').trim().slice(0, 100) || null,
    paymentId: String(req.query.paymentId || '').trim().slice(0, 100) || null,
  };
  // Sources that cannot honour an entity filter are skipped rather than returning noise.
  const supports = { userId: ['api', 'audit', 'auth', 'delivery'], orderId: ['api', 'audit'], traceId: ['api', 'audit', 'webhook', 'subscription'], paymentId: ['api', 'webhook'] };
  const active = Object.keys(SOURCES).filter(
    (s) => (!services.length || services.includes(s) || (s === 'api' && (services.includes('scheduler') || services.includes('webhook')))) && Object.entries(supports).every(([k, list]) => !q[k] || list.includes(s))
  );

  const rows = (
    await Promise.all(
      active.map(async (name) => {
        const src = SOURCES[name];
        const time = { $gte: from, $lte: to, ...(before && { $lt: before }) };
        const conds = [{ [src.time]: time }, ...src.filter(q).filter(Boolean)];
        const docs = await src.model.find({ $and: conds }).sort({ [src.time]: -1 }).limit(limit).lean();
        return docs.map((d) => ({ id: `${name}:${d._id}`, at: d[src.time], ...src.map(d) }));
      })
    )
  )
    .flat()
    .filter((r) => (!services.length || services.includes(r.service)) && (!levels.length || levels.includes(r.level)))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit)
    .map((r) => ({ ...r, userId: r.userId ? String(r.userId) : null, data: redactSensitive(r.data || {}) }));

  return sendSuccess(res, {
    logs: rows,
    nextBefore: rows.length === limit ? rows[rows.length - 1].at : null,
    services: SERVICES,
    levels: LEVELS,
    unavailable: ['server (stdout)', 'deployment', 'queue worker', 'frontend console (only captured render errors)'],
  });
});

// ── 5. Live activity (polled every few seconds; no personal data) ───────────
const getLive = asyncHandler(async (req, res) => {
  const now = Date.now();
  const since = new Date(now - 2 * MINUTE);
  const [online, loggedIn, orders, payments, signups, errors, security] = await Promise.all([
    Session.countDocuments({ lastUsed: { $gte: new Date(now - 5 * MINUTE) } }),
    Session.distinct('userId', { lastUsed: { $gte: new Date(now - 5 * MINUTE) } }).then((u) => u.length),
    Order.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(20).select('status createdAt').lean(),
    Payment.find({ updatedAt: { $gte: since } }).sort({ updatedAt: -1 }).limit(20).select('status refundStatus updatedAt').lean(),
    User.countDocuments({ createdAt: { $gte: since } }),
    ErrorLog.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(20).select('errorCode severity route createdAt').lean(),
    SecurityEvent.find({ at: { $gte: since } }).sort({ at: -1 }).limit(20).select('type route status at').lean(),
  ]);
  const events = [
    ...orders.map((o) => ({ at: o.createdAt, type: 'job', title: `Order created (${o.status})`, ref: shortId(o._id) })),
    ...payments.map((p) => ({ at: p.updatedAt, type: 'payment', title: `Payment ${p.status}${p.refundStatus !== 'none' ? ` · refund ${p.refundStatus}` : ''}`, ref: shortId(p._id) })),
    ...errors.map((e) => ({ at: e.createdAt, type: 'error', title: `${e.errorCode} (${e.severity})`, ref: e.route })),
    ...security.map((s) => ({ at: s.at, type: 'security', title: `${s.type.replace(/_/g, ' ')} → ${s.status}`, ref: s.route })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const io = getIO();
  const snap = apm.snapshot();
  return sendSuccess(res, {
    at: new Date(now),
    traffic: liveSnapshot(),
    sessions: { online, loggedInUsers: loggedIn },
    sockets: io ? io.engine.clientsCount : null,
    lastTwoMinutes: { orders: orders.length, payments: payments.length, signups, errors: errors.length, security: security.length },
    events: events.slice(0, 50),
    onlineHistory: snap.history.map((h) => ({ t: h.t, sessions: h.sessionsOnline, rps: h.rps })),
  });
});

// ── 19. Security center ─────────────────────────────────────────────────────
const getSecurity = asyncHandler(async (req, res) => {
  const { from, to, bucketMs } = parseRange(req.query);
  const match = { at: { $gte: from, $lte: to } };
  const hourAgo = new Date(Date.now() - 60 * MINUTE);
  const [byType, series, topIps, stuffing, bruteForce, recent, roleChanges, privileged] = await Promise.all([
    SecurityEvent.aggregate([{ $match: match }, { $group: { _id: '$type', n: { $sum: 1 } } }]).then(countBy),
    SecurityEvent.aggregate([
      { $match: match },
      { $group: { _id: { t: bucketExpr('$at', bucketMs), type: '$type' }, n: { $sum: 1 } } },
      { $sort: { '_id.t': 1 } },
    ]),
    SecurityEvent.aggregate([
      { $match: match },
      { $group: { _id: '$ip', n: { $sum: 1 }, types: { $addToSet: '$type' }, last: { $max: '$at' }, routes: { $addToSet: '$route' } } },
      { $sort: { n: -1 } },
      { $limit: 15 },
    ]),
    // Credential stuffing: one IP failing logins for many different accounts in the last hour.
    SecurityEvent.aggregate([
      { $match: { type: 'login_failed', at: { $gte: hourAgo } } },
      { $group: { _id: '$ip', accounts: { $addToSet: { $ifNull: ['$emailHash', '$email'] } }, n: { $sum: 1 } } },
      { $project: { n: 1, accounts: { $size: '$accounts' } } },
      { $match: { accounts: { $gte: 5 } } },
      { $sort: { accounts: -1 } },
    ]),
    // Brute force: one account failing many times in the last hour.
    SecurityEvent.aggregate([
      { $match: { type: 'login_failed', at: { $gte: hourAgo }, email: { $ne: null } } },
      { $group: { _id: { $ifNull: ['$emailHash', '$email'] }, email: { $first: '$email' }, n: { $sum: 1 }, ips: { $addToSet: '$ip' } } },
      { $match: { n: { $gte: 5 } } },
      { $project: { n: 1, email: 1, ips: { $size: '$ips' } } },
      { $sort: { n: -1 } },
    ]),
    SecurityEvent.find(match).sort({ at: -1 }).limit(100).lean(),
    AdminActivity.find({ action: 'role_change', createdAt: { $gte: from, $lte: to } }).sort({ createdAt: -1 }).limit(30).populate('adminId', 'name role').select('description metadata createdAt adminId targetId').lean(),
    AdminActivity.find({ type: 'audit', createdAt: { $gte: from, $lte: to }, 'metadata.area': { $regex: '^developer\\.' } }).sort({ createdAt: -1 }).limit(30).populate('adminId', 'name role').select('description createdAt adminId').lean(),
  ]);

  const alerts = [
    ...stuffing.map((s) => ({ severity: 'critical', title: 'Possible credential stuffing', detail: `IP ${s._id} failed logins for ${s.accounts} accounts (${s.n} attempts) in the last hour` })),
    ...bruteForce.map((b) => ({ severity: 'high', title: 'Repeated failed logins', detail: `${b.email}: ${b.n} failures from ${b.ips} IP(s) in the last hour` })),
    ...topIps.filter((i) => i.n >= 100).map((i) => ({ severity: 'medium', title: 'Noisy client', detail: `IP ${i._id}: ${i.n} rejected requests in range` })),
    ...(securityEvents.droppedCount() ? [{ severity: 'high', title: 'Security event buffer overflowed', detail: `${securityEvents.droppedCount()} events dropped since restart — likely an attack burst` }] : []),
  ];

  const pivot = {};
  for (const s of series) {
    const k = new Date(s._id.t).toISOString();
    pivot[k] = pivot[k] || { t: s._id.t };
    pivot[k][s._id.type] = s.n;
  }
  return sendSuccess(res, {
    range: { from, to, bucketMs },
    byType,
    series: Object.values(pivot),
    topIps: topIps.map((i) => ({ ip: i._id, count: i.n, types: i.types, last: i.last, routes: i.routes.slice(0, 5) })),
    alerts,
    recent,
    roleChanges,
    developerActions: privileged,
  });
});

// ── 19b. IP blocking ────────────────────────────────────────────────────────
const ipBlocks = require('../../services/monitoring/ipBlocks');
const IpBlock = require('../../models/IpBlock');

const getBlocks = asyncHandler(async (req, res) => {
  const blocks = await IpBlock.find({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] })
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name')
    .lean();
  // Requests refused per block target since it was created.
  const hits = await SecurityEvent.aggregate([
    { $match: { type: 'ip_blocked', at: { $gte: new Date(Date.now() - 30 * 24 * 60 * MINUTE) } } },
    { $group: { _id: '$ip', n: { $sum: 1 }, last: { $max: '$at' } } },
  ]);
  return sendSuccess(res, {
    yourIp: securityEvents.clientIp(req),
    blocks: blocks.map((b) => {
      const list = ipBlocks.build([b]);
      const matched = hits.filter((h) => h._id && list.check(h._id, h._id.includes(':') ? 'ipv6' : 'ipv4'));
      return { ...b, blockedRequests: matched.reduce((a, h) => a + h.n, 0), lastBlockedAt: matched.reduce((a, h) => (!a || h.last > a ? h.last : a), null) };
    }),
  });
});

/** Pure: an IP's traffic + security counts → risk verdict with human-readable reasons. */
function ipRisk(r, blocked = false) {
  const sec = r.security || {};
  const reasons = [];
  if ((sec.login_failed || 0) >= 5) reasons.push(`${sec.login_failed} failed logins${r.accounts > 1 ? ` on ${r.accounts} accounts` : ''}`);
  if (sec.rate_limited) reasons.push(`rate limited ${sec.rate_limited}×`);
  if ((sec.permission_denied || 0) >= 10) reasons.push(`${sec.permission_denied} permission denials`);
  if (r.requests >= 20 && r.failed / r.requests >= 0.5) reasons.push(`${Math.round((r.failed / r.requests) * 100)}% of requests fail`);
  const risk = blocked ? 'blocked' : reasons.length >= 2 || (sec.login_failed || 0) >= 20 ? 'high' : reasons.length ? 'suspicious' : 'normal';
  return { blocked, risk, reasons };
}

/**
 * Every client IP seen in range: traffic (ApiMetricMinute.ips) merged with security
 * events and block status, plus a simple risk verdict.
 * ponytail: merges up to 2000 IPs in memory per call; move to a pre-aggregated
 * per-IP collection if traffic ever produces far more distinct IPs than that.
 */
const getIps = asyncHandler(async (req, res) => {
  const { from, to } = parseRange({ range: req.query.range || '24h', ...req.query });
  const [traffic, security, blocks] = await Promise.all([
    ApiMetricMinute.aggregate([
      { $match: { minute: { $gte: from, $lte: to } } },
      { $unwind: '$ips' },
      { $group: { _id: '$ips.ip', requests: { $sum: '$ips.n' }, failed: { $sum: '$ips.failed' }, routes: { $addToSet: '$route' }, firstSeen: { $min: '$minute' }, lastSeen: { $max: '$minute' } } },
      { $sort: { requests: -1 } },
      { $limit: 2000 },
    ]),
    SecurityEvent.aggregate([
      { $match: { at: { $gte: from, $lte: to }, ip: { $ne: null } } },
      { $group: { _id: { ip: '$ip', type: '$type' }, n: { $sum: 1 }, last: { $max: '$at' }, emails: { $addToSet: { $ifNull: ['$emailHash', '$email'] } } } },
    ]),
    IpBlock.find({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).select('target expiresAt').lean(),
  ]);

  const rows = new Map();
  const row = (raw) => {
    const ip = String(raw).replace(/^::ffff:/, '');
    if (!rows.has(ip)) rows.set(ip, { ip, requests: 0, failed: 0, endpoints: 0, firstSeen: null, lastSeen: null, security: {}, securityTotal: 0, accounts: 0 });
    return rows.get(ip);
  };
  for (const t of traffic) {
    const r = row(t._id); // legacy "::ffff:" rows merge into the same IP
    r.requests += t.requests;
    r.failed += t.failed;
    r.endpoints = Math.max(r.endpoints, t.routes.length);
    if (!r.firstSeen || t.firstSeen < r.firstSeen) r.firstSeen = t.firstSeen;
    if (!r.lastSeen || t.lastSeen > r.lastSeen) r.lastSeen = t.lastSeen;
  }
  for (const s of security) {
    const r = row(s._id.ip);
    r.security[s._id.type] = s.n;
    r.securityTotal += s.n;
    if (s._id.type === 'login_failed') r.accounts += s.emails.filter(Boolean).length;
    if (!r.lastSeen || s.last > r.lastSeen) r.lastSeen = s.last;
  }

  const list = ipBlocks.build(blocks);
  const own = securityEvents.clientIp(req);
  const family = (ip) => (ip.includes(':') ? 'ipv6' : 'ipv4');
  let all = [...rows.values()].map((r) => ({ ...r, ...ipRisk(r, list.check(r.ip, family(r.ip))), isYou: r.ip === own }));

  const summary = {
    total: all.length,
    requests: all.reduce((a, r) => a + r.requests, 0),
    blocked: all.filter((r) => r.blocked).length,
    high: all.filter((r) => r.risk === 'high').length,
    suspicious: all.filter((r) => r.risk === 'suspicious').length,
    activeBlocks: blocks.length,
  };

  const q = String(req.query.q || '').trim();
  if (q) all = all.filter((r) => r.ip.includes(q));
  if (req.query.risk === 'flagged') all = all.filter((r) => r.risk === 'high' || r.risk === 'suspicious');
  else if (req.query.risk) all = all.filter((r) => r.risk === req.query.risk);
  const SORTS = { requests: (r) => r.requests, failed: (r) => r.failed, security: (r) => r.securityTotal, lastSeen: (r) => new Date(r.lastSeen || 0).getTime() };
  const key = SORTS[req.query.sort] || SORTS.requests;
  const rank = { blocked: 3, high: 2, suspicious: 1, normal: 0 };
  all.sort((a, b) => (req.query.sort ? key(b) - key(a) : rank[b.risk] - rank[a.risk] || key(b) - key(a)));

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const total = all.length;
  return sendSuccess(
    res,
    { range: { from, to }, yourIp: own, summary, ips: all.slice((page - 1) * limit, page * limit) },
    'IPs retrieved.',
    { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 }
  );
});

// ── 22. Feature flags (GlobalConfig feature_/flag_ keys) ────────────────────
const FLAG_KEY = /^(feature_|flag_)/i;

const getFlags = asyncHandler(async (req, res) => {
  const [flags, history] = await Promise.all([
    GlobalConfig.find({ key: { $regex: FLAG_KEY } }).lean(),
    AdminActivity.find({ 'metadata.key': { $regex: FLAG_KEY } }).sort({ createdAt: -1 }).limit(100).populate('adminId', 'name role').select('description metadata createdAt adminId').lean(),
  ]);
  return sendSuccess(res, {
    environment: process.env.NODE_ENV || 'development',
    flags: flags.map((f) => ({
      key: f.key,
      enabled: f.value === true || f.value === 'true' || f.value === 1,
      rawValue: typeof f.value === 'boolean' ? undefined : f.value,
      description: f.description || null,
      updatedAt: f.updatedAt || null,
      lastChange: history.find((h) => h.metadata?.key === f.key) || null,
    })),
    history,
  });
});

// ── 24. Performance / APM ───────────────────────────────────────────────────
const getPerformance = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 60 * MINUTE);
  const slowest = await ApiMetricMinute.aggregate([
    { $match: { minute: { $gte: since } } },
    { $group: { _id: { method: '$method', route: '$route' }, count: { $sum: '$count' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } }, max: { $max: '$durMax' } } },
    { $project: { count: 1, max: 1, p95: { $round: [{ $divide: ['$p95w', '$count'] }, 0] } } },
    { $sort: { p95: -1 } },
    { $limit: 10 },
  ]);
  const snap = apm.snapshot();
  return sendSuccess(res, {
    ...snap,
    process: { uptime: process.uptime(), pid: process.pid, node: process.version, rss: process.memoryUsage().rss },
    live: liveSnapshot(),
    slowestEndpoints: slowest.map((s) => ({ method: s._id.method, route: s._id.route, count: s.count, p95: s.p95, maxMs: Math.round(s.max) })),
    unavailable: { cache: 'No cache layer configured', tracing: 'Distributed tracing needs OpenTelemetry', deployments: 'Before/after-deploy comparison needs the CI/CD integration' },
  });
});

// ── 18. Notifications & email ───────────────────────────────────────────────
const getNotifications = asyncHandler(async (req, res) => {
  const { from, to, bucketMs } = parseRange({ range: req.query.range || '7d', ...req.query });
  const match = { at: { $gte: from, $lte: to } };
  if (req.query.channel) match.channel = req.query.channel;
  if (req.query.status) match.status = req.query.status;
  const [byChannelStatus, byTemplate, series, latency, failures, recent, inApp, readRate, pushTokens, lastOk] = await Promise.all([
    DeliveryLog.aggregate([{ $match: { at: match.at } }, { $group: { _id: { channel: '$channel', status: '$status' }, n: { $sum: 1 } } }]),
    DeliveryLog.aggregate([
      { $match: match },
      { $group: { _id: { channel: '$channel', template: '$template' }, n: { $sum: 1 }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } },
      { $sort: { n: -1 } },
      { $limit: 20 },
    ]),
    DeliveryLog.aggregate([
      { $match: { at: match.at } },
      { $group: { _id: { t: bucketExpr('$at', bucketMs) }, sent: { $sum: { $cond: [{ $in: ['$status', ['sent', 'partial']] }, 1, 0] } }, failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } } } },
      { $sort: { '_id.t': 1 } },
    ]),
    DeliveryLog.find({ at: match.at, latencyMs: { $ne: null }, status: { $ne: 'skipped' } }).sort({ at: -1 }).limit(500).select('channel latencyMs').lean(),
    DeliveryLog.aggregate([
      { $match: { at: match.at, status: 'failed' } },
      { $group: { _id: { channel: '$channel', code: '$errorCode' }, n: { $sum: 1 }, last: { $max: '$at' }, example: { $last: '$error' } } },
      { $sort: { n: -1 } },
    ]),
    DeliveryLog.find(match).sort({ at: -1 }).limit(50).lean(),
    Notification.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: '$type', n: { $sum: 1 } } }]).then(countBy),
    Notification.aggregate([{ $match: { createdAt: { $gte: from, $lte: to }, isSystem: { $ne: true } } }, { $group: { _id: null, total: { $sum: 1 }, read: { $sum: { $cond: ['$read', 1, 0] } } } }]),
    PushToken.countDocuments({ active: true }),
    DeliveryLog.aggregate([{ $sort: { at: -1 } }, { $group: { _id: { channel: '$channel', ok: { $in: ['$status', ['sent', 'partial']] } }, last: { $first: '$at' }, error: { $first: '$error' } } }]),
  ]);

  const lat = (ch) => {
    const v = latency.filter((l) => l.channel === ch).map((l) => l.latencyMs).sort((a, b) => a - b);
    return v.length ? { avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length), p95: percentile(v, 95) } : null;
  };
  const totals = {};
  for (const r of byChannelStatus) {
    totals[r._id.channel] = totals[r._id.channel] || { sent: 0, partial: 0, failed: 0, skipped: 0 };
    totals[r._id.channel][r._id.status] = r.n;
  }
  const health = ['email', 'push'].map((channel) => {
    const ok = lastOk.find((l) => l._id.channel === channel && l._id.ok);
    const bad = lastOk.find((l) => l._id.channel === channel && !l._id.ok);
    const failing = bad && (!ok || new Date(bad.last) > new Date(ok.last));
    return { channel, lastSuccess: ok?.last || null, lastFailure: bad?.last || null, lastError: bad?.error || null, status: !ok && !bad ? 'unknown' : failing ? 'failing' : 'healthy' };
  });

  return sendSuccess(res, {
    range: { from, to, bucketMs },
    totals,
    latency: { email: lat('email'), push: lat('push') },
    health,
    templates: byTemplate.map((t) => ({ channel: t._id.channel, template: t._id.template, count: t.n, failed: t.failed })),
    series: series.map((s) => ({ t: s._id.t, sent: s.sent, failed: s.failed })),
    failures: failures.map((f) => ({ channel: f._id.channel, code: f._id.code, count: f.n, last: f.last, example: f.example })),
    recent,
    inApp: { byType: inApp, readRate: readRate[0]?.total ? Math.round((readRate[0].read / readRate[0].total) * 1000) / 10 : null, total: readRate[0]?.total || 0 },
    pushTokens,
    notConfigured: { sms: 'No SMS provider is used', queue: 'Emails and pushes are sent inline (no queue)', bounces: 'Bounce tracking needs a provider webhook (SMTP has none)' },
  });
});

module.exports = { ipRisk, getLogs, getLive, getSecurity, getIps, getBlocks, getFlags, getPerformance, getNotifications };
