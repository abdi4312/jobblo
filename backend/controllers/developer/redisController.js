const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { audit } = require('../../utils/devQuery');
const redisInsights = require('../../services/monitoring/redisInsights');

/** Developer console — Redis management pages (services/monitoring/redisInsights.js). */

const read = (fn) =>
  asyncHandler(async (req, res) => {
    try {
      return sendSuccess(res, await fn(req));
    } catch (err) {
      return sendError(res, err.status ? err.message : `Redis: ${err.message}`, err.status || 503);
    }
  });

const getRedisOverview = read(() => redisInsights.overview());
const getRedisMemory = read(() => redisInsights.memory());
const getRedisCache = read(() => redisInsights.cacheInfo());
const getRedisKeys = read((req) => redisInsights.keys({ group: req.query.group || 'cache', q: req.query.q, cursor: req.query.cursor || '0' }));
const getRedisPerformance = read(() => redisInsights.performance());
const getRedisConfig = read(() => redisInsights.config());
const getRedisRateLimits = read(() => redisInsights.rateLimits());
const getRedisWorkers = read(() => redisInsights.workers());
const getRedisRealtime = read(() => redisInsights.realtime());
const getRedisAlerts = read(() => redisInsights.alerts());
const getRedisAudit = read((req) => redisInsights.audit({ limit: req.query.limit }).then((logs) => ({ logs })));

// Cache writes: operations access (route), audited.
const write = (fn, describe) =>
  asyncHandler(async (req, res) => {
    try {
      const result = await fn(req);
      await audit(req, describe(result), { area: 'developer.redis', ...result });
      return sendSuccess(res, result, 'Done.');
    } catch (err) {
      return sendError(res, err.message, err.status || 503);
    }
  });

const invalidateCache = write((req) => redisInsights.invalidateNamespace(req.params.namespace), (r) => `Redis cache: invalidated namespace ${r.namespace}`);
const deleteCacheKey = write((req) => redisInsights.deleteCacheKey(req.body?.key), (r) => `Redis cache: deleted key ${r.key}`);

module.exports = { getRedisOverview, getRedisMemory, getRedisCache, getRedisKeys, getRedisPerformance, getRedisConfig, getRedisRateLimits, getRedisWorkers, getRedisRealtime, getRedisAlerts, getRedisAudit, invalidateCache, deleteCacheKey };
