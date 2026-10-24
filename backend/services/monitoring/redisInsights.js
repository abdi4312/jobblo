/**
 * Redis management for the developer console: overview, memory, cache, keys, workers,
 * realtime (socket.io adapter), rate limits, performance, alerts and configuration.
 *
 * Read-only towards Redis except three audited writes (cache invalidation, single cache
 * key delete, rate-limit reset — the last through the step-up action flow). There is no
 * "run a command" endpoint and no value viewer: keys are listed only under Jobblo's own
 * prefixes, values never leave the server (job data and rate-limit keys hold emails and
 * IPs), slowlog arguments are cut to the command and its key, and CONFIG is read through
 * an allowlist that never includes requirepass or masterauth.
 */
const redis = require('../../config/redis');

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** INFO text → { section: { key: value } } with numbers as numbers; "a=1,b=2" values become objects. */
function parseInfo(text) {
  const out = {};
  let section = 'default';
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      section = line.slice(1).trim().toLowerCase();
      out[section] = out[section] || {};
      continue;
    }
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i);
    const value = line.slice(i + 1);
    out[section] = out[section] || {};
    out[section][key] = /^[\w.]+=/.test(value) && value.includes('=') && !/^\d/.test(value)
      ? Object.fromEntries(value.split(',').map((kv) => kv.split('=')).map(([k, v]) => [k, toNum(v)]))
      : toNum(value);
  }
  return out;
}
const toNum = (v) => (v !== '' && v !== undefined && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);

/** A search string inside a SCAN MATCH pattern is literal text, never a glob. */
const escapeGlob = (s) => String(s).replace(/[*?[\]\\]/g, '\\$&');

/** The prefixes the console may list; everything else in the database is not shown. */
const keyGroups = (prefix = redis.PREFIX) => ({
  cache: { label: 'Response cache', match: `${prefix}:cache:` },
  rateLimits: { label: 'Rate-limit counters', match: `${prefix}:rl:` },
  queues: { label: 'BullMQ queues', match: `${prefix}:bull:` },
  sockets: { label: 'socket.io adapter', match: `${prefix}:socket.io` },
});

/** Slowlog entry → what a developer may see: command + key, never the values. */
function redactSlowlog(entry) {
  const [id, at, micros, args = [], client, name] = entry;
  const [cmd = '?', key, ...rest] = args.map(String);
  return {
    id,
    at: new Date(Number(at) * 1000),
    ms: Math.round(Number(micros) / 10) / 100,
    command: cmd.toUpperCase(),
    key: key ? key.slice(0, 120) : null,
    args: rest.length,
    client: name || null,
    clientAddr: client ? String(client).replace(/:\d+$/, '') : null,
  };
}

/** The settings the console reads (CONFIG GET). Passwords are never in this list. */
const SAFE_CONFIG = ['maxmemory', 'maxmemory-policy', 'appendonly', 'appendfsync', 'save', 'maxclients', 'timeout', 'tcp-keepalive', 'protected-mode', 'slowlog-log-slower-than', 'slowlog-max-len', 'latency-monitor-threshold', 'notify-keyspace-events', 'databases'];

/** Pure: running settings → checks against what Jobblo needs. */
function reviewConfig(cfg, { production = process.env.NODE_ENV === 'production' } = {}) {
  const c = cfg || {};
  const checks = [];
  const add = (key, ok, expected, why, severity = 'warning') => checks.push({ key, value: c[key] ?? null, expected, ok, severity: ok ? 'ok' : severity, why });
  add('maxmemory-policy', c['maxmemory-policy'] === 'noeviction', 'noeviction', 'BullMQ requires noeviction: any other policy can silently delete queued jobs under memory pressure.', 'critical');
  add('maxmemory', Number(c.maxmemory) > 0 || !production, '> 0 in production', 'Without a limit Redis grows until the host runs out of memory; with one (and noeviction) writes fail loudly instead.');
  add('appendonly', c.appendonly === 'yes' || Boolean(c.save) || !production, "'yes', or RDB 'save' rules", 'Queued jobs survive a Redis restart only with persistence.');
  add('protected-mode', c['protected-mode'] !== 'no' || production, "'yes' unless a password/ACL is set", 'Protected mode refuses outside connections to an unauthenticated server.');
  add('slowlog-log-slower-than', Number(c['slowlog-log-slower-than']) > 0 && Number(c['slowlog-log-slower-than']) <= 20000, '1–20000 µs', 'So slow commands show up on the Performance page.', 'info');
  add('notify-keyspace-events', !c['notify-keyspace-events'] || !/[KE].*[Ax]/.test(c['notify-keyspace-events']), "'' (off) or narrow", 'Broad keyspace events add a publish to every write.', 'info');
  return checks;
}

/** REDIS_URL without the password: what the Configuration page may show. */
function describeUrl(url = process.env.REDIS_URL) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return { scheme: u.protocol.replace(':', ''), tls: u.protocol === 'rediss:', host: u.hostname, port: Number(u.port) || 6379, db: Number(u.pathname.replace('/', '')) || 0, user: u.username || null, password: u.password ? 'set' : 'not set' };
  } catch {
    return { invalid: true };
  }
}

/** Pure: metrics → firing Redis alerts (wired into services/monitoring/alerts.js). */
function evaluateRedisAlerts(m, t) {
  const out = [];
  if (!m?.enabled) return out;
  const fire = (fingerprint, severity, title, detail) => out.push({ fingerprint, severity, service: 'redis', title, detail });
  if (!m.ok) {
    fire('redis_down', 'critical', 'Redis unreachable', `${m.error || 'No answer'} — jobs run in-process and rate limits fail open until it returns`);
    return out;
  }
  if (m.memoryPct !== null && m.memoryPct >= t.redisMemoryPct) fire('redis_memory', 'high', 'Redis memory near its limit', `${m.memoryPct}% of maxmemory used`);
  if (m.evictedKeys > 0 && m.policy !== 'noeviction') fire('redis_evictions', 'high', 'Redis is evicting keys', `${m.evictedKeys} keys evicted since start (policy ${m.policy}) — queued jobs can be lost`);
  for (const q of m.backlog || []) if (q.waiting >= t.queueBacklog) fire(`queue_backlog:${q.name}`, 'medium', `Queue backlog growing: ${q.name}`, `${q.waiting} jobs waiting (threshold ${t.queueBacklog})`);
  return out;
}

// ── Reads ────────────────────────────────────────────────────────────────────

const client = () => redis.getRedis();

/**
 * One INFO per second at most, however many developers have the pages open.
 * ponytail: per process; fine for a handful of viewers.
 */
let infoCache = { at: 0, value: null };
async function info() {
  if (Date.now() - infoCache.at < 1000 && infoCache.value) return infoCache.value;
  const [all, commandstats] = await Promise.all([client().info(), client().info('commandstats')]);
  infoCache = { at: Date.now(), value: { ...parseInfo(all), ...parseInfo(commandstats) } };
  return infoCache.value;
}

async function pingStats(n = 5) {
  const times = [];
  for (let i = 0; i < n; i += 1) {
    const t = process.hrtime.bigint();
    await client().ping();
    times.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  return { min: round(Math.min(...times)), avg: round(times.reduce((a, b) => a + b, 0) / n), max: round(Math.max(...times)) };
}
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

/** Shared answer when Redis is off or down: what the in-process fallback is doing. */
async function status() {
  const ping = await redis.pingRedis();
  return {
    enabled: ping.enabled !== false,
    ok: Boolean(ping.ok),
    error: ping.error || null,
    ms: ping.ms ?? null,
    state: { status: redis.state.status, lastError: redis.state.lastError, lastErrorAt: redis.state.lastErrorAt },
    prefix: redis.PREFIX,
  };
}

async function overview() {
  const s = await status();
  if (!s.ok) return { ...s, connections: redis.connectionStates() };
  const [i, latency] = await Promise.all([info(), pingStats()]);
  const sv = i.server || {};
  const st = i.stats || {};
  const mem = memoryOf(i);
  const hits = st.keyspace_hits || 0;
  const misses = st.keyspace_misses || 0;
  const checks = [
    { key: 'ping', ok: latency.avg < 20, label: `Ping ${latency.avg} ms` },
    { key: 'memory', ok: mem.pct === null || mem.pct < 85, label: mem.pct === null ? 'No maxmemory limit' : `${mem.pct}% of maxmemory` },
    { key: 'evictions', ok: !st.evicted_keys, label: `${st.evicted_keys || 0} evicted keys` },
    { key: 'rejected', ok: !st.rejected_connections, label: `${st.rejected_connections || 0} rejected connections` },
    { key: 'policy', ok: mem.policy === 'noeviction', label: `maxmemory-policy ${mem.policy}` },
  ];
  return {
    ...s,
    server: { version: sv.redis_version, mode: sv.redis_mode, os: sv.os, uptimeSec: sv.uptime_in_seconds, port: sv.tcp_port },
    clients: { connected: i.clients?.connected_clients ?? null, blocked: i.clients?.blocked_clients ?? null, maxclients: i.clients?.maxclients ?? null },
    latency,
    opsPerSec: st.instantaneous_ops_per_sec ?? null,
    hitRate: hits + misses ? round((hits / (hits + misses)) * 100, 1) : null,
    memory: mem,
    keyspace: i.keyspace || {},
    health: { score: Math.round((checks.filter((c) => c.ok).length / checks.length) * 100), checks },
    connections: redis.connectionStates(),
  };
}

function memoryOf(i) {
  const m = i.memory || {};
  const max = Number(m.maxmemory) || 0;
  return {
    used: m.used_memory ?? null,
    peak: m.used_memory_peak ?? null,
    rss: m.used_memory_rss ?? null,
    dataset: m.used_memory_dataset ?? null,
    luaAndScripts: (m.used_memory_vm_eval || 0) + (m.used_memory_scripts_eval || 0) || m.used_memory_lua || null,
    max: max || null,
    system: m.total_system_memory || null,
    pct: max ? round((m.used_memory / max) * 100, 1) : null,
    policy: m.maxmemory_policy ?? null,
    fragmentation: m.mem_fragmentation_ratio ?? null,
    allocator: m.mem_allocator ?? null,
    evictedKeys: i.stats?.evicted_keys ?? 0,
    expiredKeys: i.stats?.expired_keys ?? 0,
  };
}

/** SCAN under one MATCH, at most `limit` keys and `rounds` round trips (never KEYS). */
async function scanKeys(match, { limit = 100, rounds = 20, cursor = '0', count = 500 } = {}) {
  const keys = [];
  let next = String(cursor);
  let n = 0;
  do {
    const [c, batch] = await client().scan(next, 'MATCH', match, 'COUNT', count);
    next = c;
    keys.push(...batch);
    n += 1;
  } while (next !== '0' && keys.length < limit && n < rounds);
  return { keys: keys.slice(0, limit), cursor: next, complete: next === '0' };
}

/** TYPE, PTTL and MEMORY USAGE for a list of keys, in one pipeline. */
async function describeKeys(keys) {
  if (!keys.length) return [];
  const p = client().pipeline();
  for (const k of keys) p.type(k).pttl(k).call('MEMORY', 'USAGE', k);
  const r = await p.exec();
  return keys.map((key, i) => ({ key, type: r[i * 3][1], ttlMs: r[i * 3 + 1][1] >= 0 ? r[i * 3 + 1][1] : null, bytes: r[i * 3 + 2][1] ?? null }));
}

async function memory() {
  const s = await status();
  if (!s.ok) return s;
  const i = await info();
  // Memory by prefix group from a bounded sample, so the page stays cheap on a big database.
  const groups = await Promise.all(
    Object.entries(keyGroups()).map(async ([id, g]) => {
      const { keys, complete } = await scanKeys(`${escapeGlob(g.match)}*`, { limit: 300, rounds: 10 });
      const described = await describeKeys(keys);
      return { id, label: g.label, sampledKeys: keys.length, complete, bytes: described.reduce((a, k) => a + (k.bytes || 0), 0) };
    })
  );
  return { ...s, memory: memoryOf(i), groups, dbsize: await client().dbsize() };
}

async function cacheInfo() {
  const cache = require('../../utils/cache');
  const s = await status();
  const now = Date.now();
  const namespaces = await Promise.all(
    [...cache.namespaces.entries()].map(async ([name, st]) => {
      let keys;
      if (s.ok) {
        const { keys: found } = await scanKeys(`${escapeGlob(cache.fullKey(name))}:*`, { limit: 50, rounds: 10 });
        keys = (await describeKeys(found)).map((k) => ({ ...k, key: k.key.slice(cache.fullKey('').length) }));
      } else {
        keys = [...cache._local.entries()].filter(([k]) => k.startsWith(`${name}:`)).slice(0, 50).map(([key, v]) => ({ key, type: 'memory', ttlMs: Math.max(0, v.expires - now), bytes: null }));
      }
      const total = st.hits + st.misses;
      return { name, ttlSec: st.ttlSec, hits: st.hits, misses: st.misses, hitRate: total ? round((st.hits / total) * 100, 1) : null, keys };
    })
  );
  return { ...s, store: s.ok ? 'redis' : 'memory', localEntries: cache._local.size, namespaces };
}

async function keys({ group, q, cursor = '0' }) {
  const groups = keyGroups();
  if (!groups[group]) throw Object.assign(new Error(`group must be one of ${Object.keys(groups).join(', ')}.`), { status: 400 });
  if (!/^\d{1,20}$/.test(String(cursor))) throw Object.assign(new Error('Invalid cursor.'), { status: 400 });
  const s = await status();
  if (!s.ok) return { ...s, groups: Object.entries(groups).map(([id, g]) => ({ id, ...g })), keys: [] };
  const search = typeof q === 'string' ? q.slice(0, 100) : '';
  const match = `${escapeGlob(groups[group].match)}*${search ? `${escapeGlob(search)}*` : ''}`;
  const found = await scanKeys(match, { limit: 100, rounds: 20, cursor });
  return { ...s, group, groups: Object.entries(groups).map(([id, g]) => ({ id, ...g })), keys: await describeKeys(found.keys), cursor: found.cursor, complete: found.complete, dbsize: await client().dbsize() };
}

async function performance() {
  const s = await status();
  if (!s.ok) return s;
  const [i, slow, latency, latest] = await Promise.all([
    info(),
    client().call('SLOWLOG', 'GET', 25).catch(() => []),
    pingStats(10),
    client().call('LATENCY', 'LATEST').catch(() => []),
  ]);
  const st = i.stats || {};
  const commands = Object.entries(i.commandstats || {})
    .map(([k, v]) => ({ command: k.replace(/^cmdstat_/, '').toUpperCase(), calls: v.calls, usec: v.usec, usecPerCall: v.usec_per_call, failed: (v.failed_calls || 0) + (v.rejected_calls || 0) }))
    .sort((a, b) => b.usec - a.usec)
    .slice(0, 20);
  return {
    ...s,
    opsPerSec: st.instantaneous_ops_per_sec ?? null,
    totalCommands: st.total_commands_processed ?? null,
    inputKbps: st.instantaneous_input_kbps ?? null,
    outputKbps: st.instantaneous_output_kbps ?? null,
    connections: { connected: i.clients?.connected_clients ?? null, blocked: i.clients?.blocked_clients ?? null, received: st.total_connections_received ?? null, rejected: st.rejected_connections ?? 0 },
    keyspace: { hits: st.keyspace_hits ?? 0, misses: st.keyspace_misses ?? 0 },
    latency,
    latencyEvents: (latest || []).map(([event, at, last, max]) => ({ event, at: new Date(at * 1000), lastMs: last, maxMs: max })),
    commands,
    slowlog: (slow || []).map(redactSlowlog),
  };
}

async function config() {
  const s = await status();
  const base = { ...s, url: describeUrl(), prefix: redis.PREFIX, environment: process.env.NODE_ENV || 'development', workersEnabled: String(process.env.ENABLE_WORKERS || 'true').toLowerCase() !== 'false' };
  if (!s.ok) return { ...base, settings: null, checks: [] };
  let settings = {};
  let configError = null;
  try {
    const flat = await client().call('CONFIG', 'GET', ...SAFE_CONFIG); // [k1, v1, k2, v2…]; managed Redis may refuse
    for (let i = 0; i < flat.length; i += 2) if (SAFE_CONFIG.includes(flat[i])) settings[flat[i]] = flat[i + 1];
  } catch (err) {
    configError = `CONFIG GET is not permitted on this server (${err.message}) — common on managed Redis; check the provider's settings instead.`;
    const mem = memoryOf(await info());
    settings = { 'maxmemory-policy': mem.policy, maxmemory: String(mem.max || 0) };
  }
  return { ...base, settings, configError, checks: reviewConfig(settings) };
}

async function rateLimits() {
  const { LIMITERS } = require('../../middleware/rateLimiter');
  const SecurityEvent = require('../../models/SecurityEvent');
  const s = await status();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [byRoute, byIp, total] = await Promise.all([
    SecurityEvent.aggregate([{ $match: { type: 'rate_limited', at: { $gte: since } } }, { $group: { _id: '$route', n: { $sum: 1 }, last: { $max: '$at' } } }, { $sort: { n: -1 } }, { $limit: 20 }]),
    SecurityEvent.aggregate([{ $match: { type: 'rate_limited', at: { $gte: since } } }, { $group: { _id: '$ip', n: { $sum: 1 }, last: { $max: '$at' } } }, { $sort: { n: -1 } }, { $limit: 20 }]),
    SecurityEvent.countDocuments({ type: 'rate_limited', at: { $gte: since } }),
  ]);
  const limiters = [...LIMITERS.values()].map(({ name, windowMs, max, failedOnly }) => ({ name, windowMs, max, failedOnly }));
  let counters = [];
  let complete = true;
  if (s.ok) {
    const prefix = `${redis.PREFIX}:rl:`;
    const found = await scanKeys(`${escapeGlob(prefix)}*`, { limit: 1000, rounds: 20 });
    complete = found.complete;
    if (found.keys.length) {
      const p = client().pipeline();
      for (const k of found.keys) p.get(k).pttl(k);
      const r = await p.exec();
      const names = [...LIMITERS.keys()].sort((a, b) => b.length - a.length); // "otp-send" before "otp"
      counters = found.keys
        .map((key, i) => {
          const rest = key.slice(prefix.length);
          const name = names.find((n) => rest.startsWith(`${n}:`)) || rest.split(':')[0];
          const lim = LIMITERS.get(name);
          const hits = Number(r[i * 2][1]) || 0;
          return { limiter: name, client: rest.slice(name.length + 1), hits, max: lim?.max ?? null, resetInMs: r[i * 2 + 1][1] >= 0 ? r[i * 2 + 1][1] : null, blocked: lim?.max != null && hits > lim.max };
        })
        .sort((a, b) => (b.max ? b.hits / b.max : 0) - (a.max ? a.hits / a.max : 0))
        .slice(0, 200);
    }
  }
  return { ...s, store: s.ok ? 'redis' : 'memory', limiters, counters, complete, blocked: { total, byRoute: byRoute.map((x) => ({ route: x._id, n: x.n, last: x.last })), byIp: byIp.map((x) => ({ ip: x._id, n: x.n, last: x.last })) } };
}

async function workers() {
  const queue = require('../queue');
  const s = await status();
  const base = { ...s, mode: queue.usingRedis() ? 'redis' : 'inline', inline: queue.inlineStats };
  if (!s.ok || !queue.usingRedis()) return { ...base, queues: Object.entries(queue.QUEUES).map(([name, cfg]) => ({ name, concurrency: cfg.concurrency, workers: [], here: false })) };
  const queues = await Promise.all(
    Object.entries(queue.QUEUES).map(async ([name, cfg]) => {
      const q = queue.getQueue(name);
      const [list, counts, completed, failed, recent, paused] = await Promise.all([
        q.getWorkers().catch(() => []),
        q.getJobCounts('waiting', 'active', 'delayed', 'failed'),
        q.getMetrics('completed', 0, 59).catch(() => null),
        q.getMetrics('failed', 0, 59).catch(() => null),
        q.getCompleted(0, 49).catch(() => []),
        q.isPaused(),
      ]);
      const durations = recent.filter((j) => j?.processedOn && j.finishedOn).map((j) => j.finishedOn - j.processedOn);
      // data = closed minutes, newest first; the running minute is meta.count − meta.prevCount.
      const perMinute = (m) => (m ? [...m.data.slice(0, 59)].reverse().concat(Math.max(0, m.meta.count - m.meta.prevCount)) : []);
      const sum = (m) => perMinute(m).reduce((a, b) => a + b, 0);
      return {
        name,
        concurrency: cfg.concurrency,
        attempts: cfg.attempts,
        paused,
        here: queue.workers.has(name),
        counts,
        workers: list.map((w) => ({ id: w.id, name: w.name, addr: w.addr ? String(w.addr).replace(/:\d+$/, '') : null, ageSec: Number(w.age) || 0, idleSec: Number(w.idle) || 0 })),
        lastHour: { completed: sum(completed), failed: sum(failed), perMinute: perMinute(completed) },
        total: { completed: completed?.meta.count ?? null, failed: failed?.meta.count ?? null },
        avgMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
        maxMs: durations.length ? Math.max(...durations) : null,
      };
    })
  );
  return { ...base, queues };
}

async function realtime() {
  const io = require('../../sockets/io').getIO();
  const s = await status();
  if (!io) return { ...s, running: false };
  const nsp = io.of('/');
  const adapter = nsp.adapter;
  const usingRedis = adapter.constructor.name !== 'Adapter';
  const local = { sockets: io.engine.clientsCount, rooms: adapter.rooms.size, onlineUsers: require('../../sockets/chat.socket').onlineCount() };
  const out = { ...s, running: true, adapter: usingRedis ? 'redis' : 'memory', local };
  if (!usingRedis || !s.ok) return { ...out, cluster: null, pubsub: null };
  const timeout = (p) => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 3000).unref())]);
  const started = Date.now();
  const [servers, all, channels] = await Promise.all([
    timeout(adapter.serverCount()).catch(() => null),
    timeout(io.fetchSockets()).catch(() => null),
    client().call('PUBSUB', 'CHANNELS', `${escapeGlob(`${redis.PREFIX}:socket.io`)}*`).catch(() => []),
  ]);
  const roundTripMs = Date.now() - started;
  const numsub = channels.length ? await client().call('PUBSUB', 'NUMSUB', ...channels).catch(() => []) : [];
  const subs = [];
  for (let i = 0; i < numsub.length; i += 2) subs.push({ channel: numsub[i], subscribers: numsub[i + 1] });
  return {
    ...out,
    cluster: { servers, sockets: all ? all.length : null, roundTripMs },
    pubsub: { channels: subs, connections: redis.connectionStates().filter((c) => c.label.startsWith('socket:')) },
  };
}

/** Metrics for the alert evaluator (cheap: one ping, one INFO, queue counts). */
async function alertMetrics() {
  const s = await status();
  if (!s.enabled) return { enabled: false };
  if (!s.ok) return { enabled: true, ok: false, error: s.error };
  const mem = memoryOf(await info());
  const queue = require('../queue');
  const backlog = queue.usingRedis()
    ? await Promise.all(Object.keys(queue.QUEUES).map(async (name) => ({ name, waiting: (await queue.getQueue(name).getJobCounts('waiting')).waiting || 0 })))
    : [];
  return { enabled: true, ok: true, memoryPct: mem.pct, evictedKeys: mem.evictedKeys, policy: mem.policy, backlog };
}

async function alerts() {
  const { getThresholds } = require('./alerts');
  const Incident = require('../../models/Incident');
  const [t, m, incidents] = await Promise.all([
    getThresholds(),
    alertMetrics(),
    Incident.find({ $or: [{ service: 'redis' }, { fingerprint: /^queue_/ }], createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }).sort({ createdAt: -1 }).limit(50).select('title severity status detail fingerprint startedAt lastSeenAt recoveredAt occurrences').lean(),
  ]);
  const firing = evaluateRedisAlerts(m, t);
  const rules = [
    { key: 'redis_down', label: 'Redis unreachable', severity: 'critical', threshold: 'any failed ping' },
    { key: 'redis_memory', label: 'Memory near maxmemory', severity: 'high', threshold: `≥ ${t.redisMemoryPct}%`, thresholdKey: 'redisMemoryPct' },
    { key: 'redis_evictions', label: 'Keys being evicted', severity: 'high', threshold: 'any eviction with a policy other than noeviction' },
    { key: 'queue_backlog', label: 'Queue backlog growing', severity: 'medium', threshold: `≥ ${t.queueBacklog} waiting jobs`, thresholdKey: 'queueBacklog' },
  ].map((r) => ({ ...r, firing: firing.filter((f) => f.fingerprint === r.key || f.fingerprint.startsWith(`${r.key}:`)).map((f) => f.detail) }));
  return { enabled: m.enabled, metrics: m, rules, incidents };
}

async function audit({ limit = 50 } = {}) {
  const AdminActivity = require('../../models/AdminActivity');
  return AdminActivity.find({ $or: [{ 'metadata.area': { $in: ['developer.redis', 'developer.queues'] } }, { 'metadata.type': 'rate_limit_reset' }] })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200))
    .populate('adminId', 'name email role')
    .select('description metadata createdAt adminId ip')
    .lean();
}

// ── Writes (audited by the controller) ───────────────────────────────────────

async function invalidateNamespace(name) {
  const cache = require('../../utils/cache');
  if (!cache.namespaces.has(name)) throw Object.assign(new Error('Unknown cache namespace.'), { status: 404 });
  await cache.invalidate(name);
  return { namespace: name };
}

async function deleteCacheKey(key) {
  const cache = require('../../utils/cache');
  const k = typeof key === 'string' ? key : '';
  const ns = k.split(':')[0];
  if (!cache.namespaces.has(ns) || k.length > 500 || !k.startsWith(`${ns}:`)) throw Object.assign(new Error('Only keys of a known cache namespace can be deleted.'), { status: 400 });
  await cache.deleteKey(k);
  return { key: k };
}

/**
 * Page reads are shared for 2 s and computed once however many developers ask at the same
 * moment (the load test: 50 developers polling = 14k Redis commands/s without this). Writes
 * clear it so a page never shows the state from before an action.
 * ponytail: per process; each instance computes its own copy.
 */
const MEMO_MS = 2000;
const memo = new Map(); // key → { at, promise }
const clearMemo = () => memo.clear();
const shared = (name, fn) => (args) => {
  const key = `${name}:${JSON.stringify(args ?? null)}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.promise;
  if (memo.size > 500) memo.clear(); // key explorer searches are the only open-ended keys
  const promise = fn(args);
  memo.set(key, { at: Date.now(), promise });
  promise.catch(() => memo.delete(key)); // never keep a failure
  return promise;
};

module.exports = {
  clearMemo,
  _shared: shared,
  parseInfo,
  escapeGlob,
  keyGroups,
  redactSlowlog,
  reviewConfig,
  describeUrl,
  evaluateRedisAlerts,
  SAFE_CONFIG,
  overview: shared('overview', overview),
  memory: shared('memory', memory),
  cacheInfo: shared('cache', cacheInfo),
  keys: shared('keys', keys),
  performance: shared('performance', performance),
  config: shared('config', config),
  rateLimits: shared('rate-limits', rateLimits),
  workers: shared('workers', workers),
  realtime: shared('realtime', realtime),
  alertMetrics,
  alerts: shared('alerts', alerts),
  audit: shared('audit', audit),
  invalidateNamespace: (name) => invalidateNamespace(name).finally(clearMemo),
  deleteCacheKey: (key) => deleteCacheKey(key).finally(clearMemo),
};
