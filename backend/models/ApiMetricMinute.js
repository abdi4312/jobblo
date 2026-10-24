const mongoose = require('mongoose');

/**
 * One row per (minute, method, route) — flushed by middleware/requestMetrics.js.
 * Percentiles are computed per minute at flush time; ranges combine them
 * count-weighted (approximate, see the ponytail note in requestMetrics.js).
 * Status codes are flat fields so aggregations stay simple.
 */
const n = { type: Number, default: 0 };

const apiMetricMinuteSchema = new mongoose.Schema(
  {
    minute: { type: Date, required: true },
    method: { type: String, required: true },
    route: { type: String, required: true },
    count: n,
    failed: n,
    slow: n, // requests slower than SLO_LATENCY_MS (default 1000 ms)
    durSum: n,
    durMax: n,
    p50: n,
    p95: n,
    p99: n,
    c2xx: n,
    c3xx: n,
    c4xx: n,
    c5xx: n,
    c400: n,
    c401: n,
    c403: n,
    c404: n,
    c429: n,
    c500: n,
    // Top client IPs this minute (capped); the rest are summed into ipsOther.
    ips: [{ _id: false, ip: String, n: Number, failed: Number }],
    ipsOther: n,
  },
  { versionKey: false }
);

apiMetricMinuteSchema.index({ minute: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
apiMetricMinuteSchema.index({ route: 1, method: 1, minute: -1 });
apiMetricMinuteSchema.index({ 'ips.ip': 1, minute: -1 });

module.exports = mongoose.model('ApiMetricMinute', apiMetricMinuteSchema);
