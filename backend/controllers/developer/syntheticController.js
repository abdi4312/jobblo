const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const SyntheticRun = require('../../models/SyntheticRun');
const SyntheticCheck = require('../../models/SyntheticCheck');
const synthetic = require('../../services/monitoring/synthetic');
const { percentile } = require('../../middleware/requestMetrics');

const HOUR = 60 * 60 * 1000;
const audit = (req, description, metadata = {}) =>
  logActivity({ adminId: req.user._id, action: 'other', description, metadata: { area: 'developer.synthetic', ...metadata }, ip: req.ip, userAgent: req.get('user-agent') || 'unknown' });

/** Every probe with uptime (24 h / 7 d), latency and its last 24 h of runs. */
const getSynthetic = asyncHandler(async (req, res) => {
  const now = Date.now();
  const [probes, customs, stats, recent] = await Promise.all([
    synthetic.probes(),
    SyntheticCheck.find().sort({ createdAt: 1 }).populate('createdBy', 'name').lean(),
    SyntheticRun.aggregate([
      { $match: { at: { $gte: new Date(now - 7 * 24 * HOUR) } } },
      {
        $group: {
          _id: '$key',
          runs7d: { $sum: 1 },
          ok7d: { $sum: { $cond: ['$ok', 1, 0] } },
          runs24h: { $sum: { $cond: [{ $gte: ['$at', new Date(now - 24 * HOUR)] }, 1, 0] } },
          ok24h: { $sum: { $cond: [{ $and: ['$ok', { $gte: ['$at', new Date(now - 24 * HOUR)] }] }, 1, 0] } },
        },
      },
    ]),
    SyntheticRun.find({ at: { $gte: new Date(now - 24 * HOUR) } }).sort({ at: 1 }).select('key at ok latencyMs status error').lean(),
  ]);
  const series = {};
  for (const r of recent) (series[r.key] ||= []).push(r);
  const byKey = Object.fromEntries(stats.map((s) => [s._id, s]));
  const pct = (ok, n) => (n ? Math.round((ok / n) * 10000) / 100 : null);

  const checks = probes.map((p) => {
    const runs = series[p.key] || [];
    const last = runs[runs.length - 1] || null;
    let streak = 0;
    for (let i = runs.length - 1; i >= 0 && !runs[i].ok; i--) streak++;
    const s = byKey[p.key] || {};
    const okLatencies = runs.filter((r) => r.ok).map((r) => r.latencyMs).sort((a, b) => a - b);
    return {
      key: p.key,
      name: p.name,
      describe: p.describe,
      custom: Boolean(p.custom),
      state: !last ? 'pending' : last.ok ? 'up' : 'down',
      failingFor: streak,
      lastRun: last,
      uptime24h: pct(s.ok24h, s.runs24h),
      uptime7d: pct(s.ok7d, s.runs7d),
      p50: okLatencies.length ? percentile(okLatencies, 50) : null,
      p95: okLatencies.length ? percentile(okLatencies, 95) : null,
      series: runs.map((r) => ({ at: r.at, ms: r.ok ? r.latencyMs : null, ok: r.ok })),
    };
  });
  const b = synthetic.bases();
  return sendSuccess(res, {
    checks,
    customs,
    config: {
      api: b.api,
      web: b.web,
      loginJourney: Boolean(process.env.SYNTHETIC_USER_EMAIL && process.env.SYNTHETIC_USER_PASSWORD),
      intervalMin: Math.max(1, Number(process.env.SYNTHETIC_INTERVAL_MIN) || 5),
      enabled: process.env.ENABLE_SYNTHETIC !== 'false',
      allowedHosts: [...synthetic.allowedHosts()],
    },
  });
});

const getRuns = asyncHandler(async (req, res) => {
  const key = String(req.params.key).slice(0, 64);
  const runs = await SyntheticRun.find({ key }).sort({ at: -1 }).limit(100).lean();
  return sendSuccess(res, { runs });
});

const runNow = asyncHandler(async (req, res) => {
  const key = req.body?.key ? String(req.body.key).slice(0, 64) : null;
  const results = await synthetic.runAll({ key, trigger: 'manual' });
  await audit(req, `Developer ran synthetic checks${key ? ` (${key})` : ''}`, { key, failed: results.filter((r) => !r.ok).map((r) => r.key) });
  return sendSuccess(res, { results });
});

function parseCheck(body) {
  const name = String(body?.name || '').trim().slice(0, 80);
  const url = String(body?.url || '').trim().slice(0, 500);
  const method = body?.method === 'HEAD' ? 'HEAD' : 'GET';
  const expectStatus = Number(body?.expectStatus) || 200;
  const expectText = body?.expectText ? String(body.expectText).slice(0, 200) : null;
  if (!name) return { error: 'Name is required.' };
  if (expectStatus < 100 || expectStatus > 599) return { error: 'Expected status must be 100–599.' };
  const blocked = synthetic.checkUrlAllowed(url);
  if (blocked) return { error: blocked };
  return { value: { name, url, method, expectStatus, expectText: method === 'HEAD' ? null : expectText, enabled: body?.enabled !== false } };
}

const createCheck = asyncHandler(async (req, res) => {
  const { value, error } = parseCheck(req.body);
  if (error) return sendError(res, error, 400);
  const check = await SyntheticCheck.create({ ...value, createdBy: req.user._id });
  await audit(req, `Developer added synthetic check "${check.name}"`, { checkId: String(check._id), url: check.url });
  return sendSuccess(res, { check }, 'Check created.', null, 201);
});

const updateCheck = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const { value, error } = parseCheck(req.body);
  if (error) return sendError(res, error, 400);
  const check = await SyntheticCheck.findByIdAndUpdate(req.params.id, value, { new: true });
  if (!check) return sendError(res, 'Check not found.', 404);
  await audit(req, `Developer updated synthetic check "${check.name}"`, { checkId: String(check._id), url: check.url, enabled: check.enabled });
  return sendSuccess(res, { check });
});

const deleteCheck = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const check = await SyntheticCheck.findByIdAndDelete(req.params.id);
  if (!check) return sendError(res, 'Check not found.', 404);
  await audit(req, `Developer deleted synthetic check "${check.name}"`, { checkId: String(check._id), url: check.url });
  return sendSuccess(res, {}, 'Check deleted.');
});

module.exports = { getSynthetic, getRuns, runNow, createCheck, updateCheck, deleteCheck };
