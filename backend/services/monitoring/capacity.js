const os = require('os');
const mongoose = require('mongoose');

/**
 * Capacity planning: how fast each resource grows and when it runs out.
 *
 * Sources:
 *   - hourly CapacitySnapshot (disk, memory, load, Mongo sizes, blob bytes) — starts now;
 *   - ApiMetricMinute (30 days) for daily requests and the busiest minute per day;
 *   - document growth per collection reconstructed from ObjectId timestamps, so there is
 *     history from day one without waiting for snapshots.
 * Forecasts are a least-squares line over daily points (ponytail: linear — fine for steady
 * growth, wrong for step changes and seasonality; switch to a seasonal model once there is
 * a year of data).
 *
 * Limits: disk and RAM from the host; Mongo storage from CAPACITY_MONGO_LIMIT_GB (an Atlas
 * tier cap; on a VPS it shares the disk); traffic from CAPACITY_MAX_RPS (measured load-test
 * ceiling for one API instance).
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const model = (name) => require(`../../models/${name}`);

async function sample() {
  if (mongoose.connection.readyState !== 1) return null;
  const disk = require('./system').diskUsage();
  const db = await mongoose.connection.db.stats().catch(() => null);
  const blob = await require('./costs').blobUsage().catch(() => null);
  return model('CapacitySnapshot').create({
    at: new Date(),
    host: os.hostname(),
    diskUsed: disk?.used ?? null,
    diskTotal: disk?.total ?? null,
    memUsed: os.totalmem() - os.freemem(),
    memTotal: os.totalmem(),
    load1: os.loadavg()[0],
    cpus: os.cpus().length,
    mongoData: db?.dataSize ?? null,
    mongoStorage: db ? db.storageSize + db.indexSize : null,
    mongoIndex: db?.indexSize ?? null,
    blobBytes: blob?.bytes ?? null,
  });
}

function startCapacity() {
  if (process.env.NODE_ENV === 'test') return;
  const run = () => sample().catch((e) => console.error('[capacity] sample failed:', e.message));
  setTimeout(run, 60_000).unref();
  setInterval(run, HOUR).unref();
}

/** Pure: least-squares line through [{x (ms), y}]. Unit-tested. */
function linearFit(points) {
  const pts = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n;
  const my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of pts) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
  }
  if (!sxx) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy ? (sxy * sxy) / (sxx * syy) : 1, n };
}

/** Pure: daily growth, value in 30/90 days and days until `limit` (null when not growing or no limit). */
function forecast(points, limit, now = Date.now()) {
  const fit = linearFit(points);
  const last = points.length ? points[points.length - 1].y : null;
  if (!fit || points.length < 3) return { current: last, perDay: null, in30: null, in90: null, daysToLimit: null, confidence: 'insufficient', points: points.length };
  const at = (t) => fit.slope * t + fit.intercept;
  const perDay = fit.slope * DAY;
  let daysToLimit = null;
  if (limit && perDay > 0) {
    const t = (limit - fit.intercept) / fit.slope;
    daysToLimit = Math.max(0, (t - now) / DAY);
  }
  return {
    current: last,
    perDay,
    in30: at(now + 30 * DAY),
    in90: at(now + 90 * DAY),
    daysToLimit,
    confidence: points.length < 7 ? 'low' : fit.r2 >= 0.7 ? 'high' : fit.r2 >= 0.4 ? 'medium' : 'low',
    points: points.length,
  };
}

/** Last snapshot per day → daily points for each resource. */
async function dailySnapshots(days) {
  const rows = await model('CapacitySnapshot').aggregate([
    { $match: { at: { $gte: new Date(Date.now() - days * DAY) } } },
    { $sort: { at: 1 } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$at' } },
        at: { $last: '$at' },
        diskUsed: { $last: '$diskUsed' },
        diskTotal: { $last: '$diskTotal' },
        memUsed: { $max: '$memUsed' },
        memTotal: { $last: '$memTotal' },
        load1: { $max: '$load1' },
        cpus: { $last: '$cpus' },
        mongoStorage: { $last: '$mongoStorage' },
        blobBytes: { $last: '$blobBytes' },
      },
    },
    { $sort: { at: 1 } },
  ]);
  return rows;
}

/** Requests per day and the busiest minute of each day (all routes summed), last 30 days. */
async function dailyTraffic() {
  return model('ApiMetricMinute').aggregate([
    { $match: { minute: { $gte: new Date(Date.now() - 30 * DAY) } } },
    { $group: { _id: '$minute', n: { $sum: '$count' } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$_id' } }, at: { $max: '$_id' }, requests: { $sum: '$n' }, peakPerMin: { $max: '$n' } } },
    { $sort: { at: 1 } },
  ]);
}

/** Per-collection growth from ObjectId creation time (last 90 days), biggest collections first. */
async function collectionGrowth(limit = 12) {
  const db = mongoose.connection.db;
  const names = (await db.listCollections({ type: 'collection' }, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith('system.'));
  const stats = await Promise.all(
    names.map(async (name) => {
      const [s] = await db.collection(name).aggregate([{ $collStats: { storageStats: {} } }]).toArray().catch(() => []);
      return { name, count: s?.storageStats?.count ?? 0, size: s?.storageStats?.size ?? 0, avgObjSize: s?.storageStats?.avgObjSize ?? 0, storage: (s?.storageStats?.storageSize ?? 0) + (s?.storageStats?.totalIndexSize ?? 0) };
    })
  );
  const since = mongoose.Types.ObjectId.createFromTime(Math.floor((Date.now() - 90 * DAY) / 1000));
  const top = stats.sort((a, b) => b.size - a.size).slice(0, limit);
  return Promise.all(
    top.map(async (c) => {
      // Uses the _id index; documents with non-ObjectId ids are skipped.
      const perDay = await db
        .collection(c.name)
        .aggregate([
          { $match: { _id: { $gte: since, $type: 'objectId' } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: { $toDate: '$_id' } } }, n: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ])
        .toArray()
        .catch(() => []);
      // Cumulative document count per day, ending at today's count.
      const added = perDay.reduce((a, d) => a + d.n, 0);
      let running = Math.max(0, c.count - added);
      const points = perDay.map((d) => ({ x: Date.parse(`${d._id}T23:59:59Z`), y: (running += d.n) }));
      const f = forecast(points.length >= 3 ? points : [], null);
      return {
        name: c.name,
        documents: c.count,
        bytes: c.size,
        storage: c.storage,
        avgObjSize: Math.round(c.avgObjSize),
        addedLast90d: added,
        docsPerDay: f.perDay,
        bytesPerDay: f.perDay !== null ? f.perDay * c.avgObjSize : null,
        docsIn90: f.in90,
        confidence: f.confidence,
      };
    })
  );
}

const pts = (rows, key) => rows.filter((r) => r[key] !== null && r[key] !== undefined).map((r) => ({ x: new Date(r.at).getTime(), y: r[key] }));

let cache = { at: 0, value: null };
async function getCapacity({ force = false } = {}) {
  if (!force && cache.value && Date.now() - cache.at < 10 * 60 * 1000) return cache.value;
  const [snaps, traffic, collections, latest] = await Promise.all([
    dailySnapshots(90),
    dailyTraffic(),
    collectionGrowth(),
    model('CapacitySnapshot').findOne().sort({ at: -1 }).lean(),
  ]);
  const disk = require('./system').diskUsage();
  const dbStats = await mongoose.connection.db.stats().catch(() => null);
  const mongoLimitGb = Number(process.env.CAPACITY_MONGO_LIMIT_GB) || null;
  const maxRps = Number(process.env.CAPACITY_MAX_RPS) || null;
  const DISK_ALARM = 0.9;

  // Mongo has history from day one via collection growth; snapshots refine it over time.
  const mongoNow = dbStats ? dbStats.storageSize + dbStats.indexSize : null;
  const mongoPoints = pts(snaps, 'mongoStorage');

  const resources = [
    {
      key: 'disk',
      name: 'Disk',
      unit: 'bytes',
      current: disk?.used ?? null,
      limit: disk ? disk.total * DISK_ALARM : null,
      limitLabel: disk ? `${Math.round(DISK_ALARM * 100)}% of ${(disk.total / 1024 ** 3).toFixed(0)} GB` : null,
      ...forecast(pts(snaps, 'diskUsed'), disk ? disk.total * DISK_ALARM : null),
      series: snaps.map((r) => ({ t: r.at, value: r.diskUsed })),
    },
    {
      key: 'memory',
      name: 'Memory (daily peak)',
      unit: 'bytes',
      current: os.totalmem() - os.freemem(),
      limit: os.totalmem() * 0.9,
      limitLabel: `90% of ${(os.totalmem() / 1024 ** 3).toFixed(0)} GB RAM`,
      ...forecast(pts(snaps, 'memUsed'), os.totalmem() * 0.9),
      series: snaps.map((r) => ({ t: r.at, value: r.memUsed })),
    },
    {
      key: 'mongo',
      name: 'MongoDB storage',
      unit: 'bytes',
      current: mongoNow,
      limit: mongoLimitGb ? mongoLimitGb * 1024 ** 3 : null,
      limitLabel: mongoLimitGb ? `${mongoLimitGb} GB (CAPACITY_MONGO_LIMIT_GB)` : 'shares the disk on a VPS — set CAPACITY_MONGO_LIMIT_GB for Atlas',
      ...forecast(mongoPoints, mongoLimitGb ? mongoLimitGb * 1024 ** 3 : null),
      series: snaps.map((r) => ({ t: r.at, value: r.mongoStorage })),
    },
    {
      key: 'blob',
      name: 'Blob storage',
      unit: 'bytes',
      current: latest?.blobBytes ?? null,
      limit: null,
      limitLabel: 'no hard limit — growth drives cost',
      ...forecast(pts(snaps, 'blobBytes'), null),
      series: snaps.map((r) => ({ t: r.at, value: r.blobBytes })),
    },
  ];
  // Until there are 3 days of snapshots, estimate Mongo growth from per-collection document
  // growth × average document size (ObjectId history goes back 90 days).
  const mongo = resources.find((r) => r.key === 'mongo');
  if (mongo.perDay === null && mongoNow !== null) {
    const perDay = collections.reduce((a, c) => a + (c.bytesPerDay > 0 ? c.bytesPerDay : 0), 0);
    if (perDay > 0) {
      Object.assign(mongo, {
        perDay,
        in30: mongoNow + perDay * 30,
        in90: mongoNow + perDay * 90,
        daysToLimit: mongo.limit ? Math.max(0, (mongo.limit - mongoNow) / perDay) : null,
        confidence: 'estimated',
      });
    }
  }
  // A disk/RAM forecast without snapshots still has a current value.
  for (const r of resources) {
    if (r.current === null && r.series.length) r.current = r.series[r.series.length - 1].value;
    // Already past the limit: that is "now", whatever the trend says.
    if (r.limit && r.current !== null && r.current >= r.limit) r.daysToLimit = 0;
  }

  const peakRps = traffic.map((d) => ({ x: new Date(d.at).getTime(), y: d.peakPerMin / 60 }));
  const trafficForecast = forecast(peakRps, maxRps);
  const value = {
    generatedAt: new Date(),
    snapshots: { days: snaps.length, latestAt: latest?.at || null },
    resources,
    traffic: {
      maxRps,
      ...trafficForecast,
      requestsPerDay: forecast(traffic.map((d) => ({ x: new Date(d.at).getTime(), y: d.requests })), null),
      series: traffic.map((d) => ({ t: d.at, requests: d.requests, peakRps: Math.round((d.peakPerMin / 60) * 100) / 100 })),
      headroom: maxRps && trafficForecast.current ? Math.round((1 - trafficForecast.current / maxRps) * 100) : null,
    },
    // Windows has no load average (always 0).
    host: { cpus: os.cpus().length, loadPerCpu: process.platform === 'win32' ? null : Math.round((os.loadavg()[0] / os.cpus().length) * 100) / 100, totalMem: os.totalmem() },
    collections,
  };
  cache = { at: Date.now(), value };
  return value;
}

module.exports = { sample, startCapacity, linearFit, forecast, getCapacity };
