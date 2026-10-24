/**
 * Small JSON cache for hot public reads. Redis when REDIS_URL is set (shared by every
 * instance), otherwise a bounded in-process map. A Redis error is a cache miss, never a
 * failed request.
 *
 *   router.get('/', cacheJson('categories', 300), controller.list)   // response cache
 *   await invalidate('categories')                                    // after a write
 */
const redis = require('../config/redis');

const MAX_LOCAL = 500;
const local = new Map(); // key → { value, expires }

const fullKey = (key) => `${redis.PREFIX}:cache:${key}`;
// Every cacheJson namespace with its TTL and hit/miss counts (Cache Manager page).
// ponytail: counts are per process since start; with several instances each shows its own share.
const namespaces = new Map(); // name → { ttlSec, hits, misses }

async function get(key) {
  const client = redis.getRedis();
  if (client) {
    try {
      const raw = await client.get(fullKey(key));
      return raw ? JSON.parse(raw) : undefined;
    } catch {
      return undefined;
    }
  }
  const hit = local.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    local.delete(key);
    return undefined;
  }
  return hit.value;
}

async function set(key, value, ttlSec) {
  const client = redis.getRedis();
  if (client) {
    try {
      await client.set(fullKey(key), JSON.stringify(value), 'EX', ttlSec);
    } catch {
      /* cache is best effort */
    }
    return;
  }
  if (local.size >= MAX_LOCAL) local.delete(local.keys().next().value); // oldest first
  local.set(key, { value, expires: Date.now() + ttlSec * 1000 });
}

/** Drop every key under a namespace ("categories" clears "categories:*"). */
async function invalidate(namespace) {
  for (const k of local.keys()) if (k === namespace || k.startsWith(`${namespace}:`)) local.delete(k);
  const client = redis.getRedis();
  if (!client) return;
  try {
    const keys = [];
    let cursor = '0';
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', `${fullKey(namespace)}:*`, 'COUNT', 200);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length) await client.del(...keys);
  } catch {
    /* entries expire on their own */
  }
}

/**
 * Express middleware: cache a successful JSON response for `ttlSec`, keyed by the full URL.
 * Only for responses that are the same for every caller (public, no per-user data).
 */
function cacheJson(namespace, ttlSec) {
  // Several routes can share a namespace: they share its counters.
  const stats = namespaces.get(namespace) || { ttlSec, hits: 0, misses: 0 };
  namespaces.set(namespace, stats);
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();
    const key = `${namespace}:${req.originalUrl}`;
    const hit = await get(key);
    if (hit !== undefined) {
      stats.hits += 1;
      res.set('X-Cache', 'HIT');
      return res.json(hit);
    }
    stats.misses += 1;
    const json = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode === 200) void set(key, body, ttlSec);
      res.set('X-Cache', 'MISS');
      return json(body);
    };
    return next();
  };
}

/** Drop one cached response (key without the prefix, e.g. "categories:/api/categories"). */
async function deleteKey(key) {
  local.delete(key);
  const client = redis.getRedis();
  if (client) await client.del(fullKey(key));
}

module.exports = { get, set, invalidate, deleteKey, cacheJson, namespaces, fullKey, _local: local };
