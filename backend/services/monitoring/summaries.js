/**
 * Aggregations shared by several developer-console pages: API totals for a window and the
 * scheduler's run summary.
 */
const scheduler = require('../scheduler');
const ApiMetricMinute = require('../../models/ApiMetricMinute');
const SchedulerRun = require('../../models/SchedulerRun');

/** Aggregates ApiMetricMinute over a window into one totals object. */
async function apiTotals(from, to) {
  const [t] = await ApiMetricMinute.aggregate([
    { $match: { minute: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        count: { $sum: '$count' },
        failed: { $sum: '$failed' },
        c5xx: { $sum: '$c5xx' },
        durSum: { $sum: '$durSum' },
        p95w: { $sum: { $multiply: ['$p95', '$count'] } },
        p99w: { $sum: { $multiply: ['$p99', '$count'] } },
      },
    },
  ]);
  if (!t || !t.count) return { count: 0, failed: 0, successRate: null, errorRate: null, avgMs: null, p95: null, p99: null, rps: 0 };
  return {
    count: t.count,
    failed: t.failed,
    successRate: Math.round((1 - t.c5xx / t.count) * 10000) / 100,
    errorRate: Math.round((t.failed / t.count) * 10000) / 100,
    avgMs: Math.round(t.durSum / t.count),
    p95: Math.round(t.p95w / t.count),
    p99: Math.round(t.p99w / t.count),
    rps: Math.round((t.count / ((to - from) / 1000)) * 10000) / 10000,
  };
}

async function schedulerSummary(since) {
  const rows = await SchedulerRun.aggregate([
    { $match: { startedAt: { $gte: since } } },
    { $sort: { startedAt: -1 } },
    {
      $group: {
        _id: '$job',
        runs: { $sum: 1 },
        failures: { $sum: { $cond: ['$ok', 0, 1] } },
        avgMs: { $avg: '$durationMs' },
        last: { $first: '$$ROOT' },
      },
    },
  ]);
  const byJob = Object.fromEntries(rows.map((r) => [r._id, r]));
  const now = Date.now();
  return scheduler.SCHEDULE.map((job) => {
    const r = byJob[job.name];
    const lastAt = r?.last?.startedAt ? new Date(r.last.startedAt).getTime() : null;
    const nextAt = lastAt ? lastAt + job.everyMs : null;
    // Missed = timers running but no run for 1.5× the interval.
    const missed = Boolean(scheduler.state.enabled && lastAt && now - lastAt > job.everyMs * 1.5);
    let status = 'idle';
    if (!scheduler.state.enabled) status = 'disabled';
    else if (missed) status = 'missed';
    else if (r?.last && !r.last.ok) status = 'failing';
    else if (r?.last) status = 'healthy';
    return {
      name: job.name,
      everyMs: job.everyMs,
      runs: r?.runs || 0,
      failures: r?.failures || 0,
      avgMs: r ? Math.round(r.avgMs) : null,
      lastRunAt: r?.last?.startedAt || null,
      lastOk: r?.last ? r.last.ok : null,
      lastError: r?.last?.error || null,
      lastDurationMs: r?.last?.durationMs ?? null,
      nextRunAt: nextAt ? new Date(Math.max(nextAt, now)) : null,
      status,
    };
  });
}

module.exports = { apiTotals, schedulerSummary };
