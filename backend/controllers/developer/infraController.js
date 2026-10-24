const os = require('os');
const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { redactSensitive } = require('../../utils/sanitizer');
const { liveSnapshot } = require('../../middleware/requestMetrics');
const { getStripeWebhookReadiness } = require('../../services/stripe/webhookReadiness');
const { getIO } = require('../../sockets/io');
const scheduler = require('../../services/scheduler');
const AdminActivity = require('../../models/AdminActivity');
const StripeEvent = require('../../models/StripeEvent');
const SchedulerRun = require('../../models/SchedulerRun');
const { parseRange, bucketExpr, escapeRegex, pageParams, pagination } = require('../../utils/devQuery');
const { mongoPing, cpuPercent, diskUsage } = require('../../services/monitoring/system');
const { schedulerSummary } = require('../../services/monitoring/summaries');

/** Developer console — server, MongoDB, scheduler, Stripe webhooks and audit log (read-only). Read-only unless noted; no exec, no arbitrary queries, no secrets. */

// ── 6. Server monitoring ────────────────────────────────────────────────────
const getServer = asyncHandler(async (req, res) => {
  const mem = process.memoryUsage();
  const io = getIO();
  return sendSuccess(res, {
    host: {
      hostname: os.hostname(),
      environment: process.env.NODE_ENV || 'development',
      platform: process.platform,
      release: os.release(),
      type: os.type(),
      arch: os.arch(),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || null,
      uptime: os.uptime(),
    },
    cpu: { percent: cpuPercent(), loadavg: os.loadavg() },
    memory: { total: os.totalmem(), free: os.freemem(), used: os.totalmem() - os.freemem() },
    disk: diskUsage(),
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      uptime: process.uptime(),
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      pm2: process.env.pm_id !== undefined ? { id: process.env.pm_id, name: process.env.name || null, restarts: Number(process.env.restart_time) || 0 } : null,
    },
    network: Object.entries(os.networkInterfaces())
      .flatMap(([name, addrs]) => (addrs || []).filter((a) => !a.internal).map((a) => ({ name, family: a.family })))
      .slice(0, 10),
    sockets: io ? io.engine.clientsCount : null,
    live: liveSnapshot(),
  });
});

// ── 7. MongoDB center (read-only stats) ─────────────────────────────────────
const getMongo = asyncHandler(async (req, res) => {
  const ping = await mongoPing();
  if (!ping.ok) return sendSuccess(res, { connected: false, ping });
  const db = mongoose.connection.db;
  const admin = db.admin();

  const [stats, build, serverStatus, replSet, collections] = await Promise.all([
    db.stats(),
    admin.buildInfo().catch(() => null),
    admin.serverStatus().catch(() => null),
    admin.command({ replSetGetStatus: 1 }).catch(() => null),
    db.listCollections({}, { nameOnly: true }).toArray(),
  ]);

  const collStats = await Promise.all(
    collections.map(async ({ name }) => {
      try {
        const [s] = await db
          .collection(name)
          .aggregate([{ $collStats: { storageStats: {} } }])
          .toArray();
        const st = s?.storageStats || {};
        return { name, count: st.count ?? null, size: st.size ?? null, storageSize: st.storageSize ?? null, indexSize: st.totalIndexSize ?? null, indexes: st.nindexes ?? null };
      } catch {
        return { name, count: await db.collection(name).estimatedDocumentCount().catch(() => null) };
      }
    })
  );

  return sendSuccess(res, {
    connected: true,
    ping,
    database: { name: db.databaseName, version: build?.version || null },
    stats: {
      collections: stats.collections,
      objects: stats.objects,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexSize: stats.indexSize,
      indexes: stats.indexes,
    },
    connections: serverStatus?.connections || null,
    opcounters: serverStatus?.opcounters || null,
    replicaSet: replSet
      ? { set: replSet.set, members: replSet.members.map((m) => ({ name: m.name, state: m.stateStr, health: m.health })) }
      : null,
    collections: collStats.sort((a, b) => (b.size || 0) - (a.size || 0)),
  });
});

/** Index usage for one collection (whitelisted against the real collection list). */
const getMongoIndexes = asyncHandler(async (req, res) => {
  const db = mongoose.connection.db;
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
  if (!names.includes(req.params.name)) return sendError(res, 'Unknown collection.', 404);
  const indexes = await db
    .collection(req.params.name)
    .aggregate([{ $indexStats: {} }])
    .toArray()
    .catch(() => []);
  return sendSuccess(res, {
    indexes: indexes.map((i) => ({ name: i.name, key: i.key, ops: Number(i.accesses?.ops || 0), since: i.accesses?.since || null })),
  });
});

// ── 9. Scheduler ────────────────────────────────────────────────────────────
const getScheduler = asyncHandler(async (req, res) => {
  const { from, to } = parseRange({ range: req.query.range || '7d', ...req.query });
  const runQuery = { startedAt: { $gte: from, $lte: to } };
  if (req.query.job) runQuery.job = String(req.query.job);
  if (req.query.ok === 'false') runQuery.ok = false;
  const { page, limit, skip } = pageParams(req.query);
  const [jobs, runs, total] = await Promise.all([
    schedulerSummary(from),
    SchedulerRun.find(runQuery).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
    SchedulerRun.countDocuments(runQuery),
  ]);
  return sendSuccess(
    res,
    { enabled: scheduler.state.enabled, startedAt: scheduler.state.startedAt, jobs, runs: runs.map((r) => ({ ...r, result: redactSensitive(r.result) })) },
    'Scheduler retrieved.',
    pagination(page, limit, total)
  );
});

// ── 13. Stripe webhooks ─────────────────────────────────────────────────────
const getWebhooks = asyncHandler(async (req, res) => {
  const { from, to, bucketMs } = parseRange(req.query);
  const { page, limit, skip } = pageParams(req.query);
  const match = { createdAt: { $gte: from, $lte: to } };
  if (req.query.type) match.type = { $regex: escapeRegex(req.query.type), $options: 'i' };
  if (req.query.status === 'failed') {
    match.lastError = { $ne: null };
    match.status = 'processing';
  } else if (req.query.status) match.status = req.query.status;
  if (req.query.q) match.$or = [{ eventId: req.query.q }, { objectId: req.query.q }];

  const [events, total, summary, types, series, readiness] = await Promise.all([
    StripeEvent.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    StripeEvent.countDocuments(match),
    StripeEvent.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          processed: { $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] } },
          processing: { $sum: { $cond: [{ $eq: ['$status', 'processing'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'processing'] }, { $ne: ['$lastError', null] }] }, 1, 0] } },
          retried: { $sum: { $cond: [{ $gt: ['$attempts', 1] }, 1, 0] } },
          avgMs: { $avg: { $cond: ['$processedAt', { $subtract: ['$processedAt', '$createdAt'] }, null] } },
        },
      },
    ]),
    StripeEvent.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$type', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 15 },
    ]),
    StripeEvent.aggregate([
      { $match: { createdAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: bucketExpr('$createdAt', bucketMs),
          received: { $sum: 1 },
          failed: { $sum: { $cond: [{ $ne: ['$lastError', null] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    getStripeWebhookReadiness().catch(() => ({ status: 'configuration_unavailable' })),
  ]);

  return sendSuccess(
    res,
    {
      range: { from, to, bucketMs },
      readiness,
      summary: summary[0] ? { ...summary[0], _id: undefined, avgMs: summary[0].avgMs ? Math.round(summary[0].avgMs) : null } : { total: 0, processed: 0, processing: 0, failed: 0, retried: 0, avgMs: null },
      types: types.map((t) => ({ type: t._id, count: t.n })),
      series: series.map((s) => ({ t: s._id, received: s.received, failed: s.failed })),
      events: events.map((e) => ({
        ...e,
        durationMs: e.processedAt ? new Date(e.processedAt) - new Date(e.createdAt) : null,
        derivedStatus: e.status === 'processed' ? 'processed' : e.lastError ? 'failed' : 'pending',
      })),
    },
    'Webhooks retrieved.',
    pagination(page, limit, total)
  );
});

// ── 20. Audit logs ──────────────────────────────────────────────────────────
const getAudit = asyncHandler(async (req, res) => {
  const { from, to } = parseRange({ range: req.query.range || '30d', ...req.query });
  const { page, limit, skip } = pageParams(req.query);
  const query = { type: 'audit', createdAt: { $gte: from, $lte: to } };
  if (req.query.action) query.action = req.query.action;
  if (req.query.actor && mongoose.isValidObjectId(req.query.actor)) query.adminId = req.query.actor;
  if (req.query.q) query.description = { $regex: escapeRegex(req.query.q), $options: 'i' };
  const [logs, total] = await Promise.all([
    AdminActivity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('adminId', 'name email role')
      .select('-stack -userAgent')
      .lean(),
    AdminActivity.countDocuments(query),
  ]);
  return sendSuccess(
    res,
    {
      logs: logs.map((l) => ({ ...l, metadata: redactSensitive(l.metadata || {}) })),
      actions: AdminActivity.schema.path('action').enumValues,
    },
    'Audit logs retrieved.',
    pagination(page, limit, total)
  );
});

module.exports = { getServer, getMongo, getMongoIndexes, getScheduler, getWebhooks, getAudit };
