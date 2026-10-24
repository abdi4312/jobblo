const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const faults = require('../../services/monitoring/faults');

/** Developer dashboard — staging failure simulator. */

const MINUTE = 60 * 1000;
const model = (name) => require(`../../models/${name}`);
const audit = (req, description, metadata) =>
  logActivity({ adminId: req.user._id, action: 'other', description, metadata: { area: 'developer.failure-simulator', ...metadata }, ip: req.ip, userAgent: req.get('user-agent') || 'unknown' });

async function api(from, to) {
  const [r] = await model('ApiMetricMinute').aggregate([
    { $match: { minute: { $gte: from, $lt: to }, route: { $not: /^\/api\/developer/ } } },
    { $group: { _id: null, n: { $sum: '$count' }, c5xx: { $sum: '$c5xx' }, p95w: { $sum: { $multiply: ['$p95', '$count'] } } } },
  ]);
  return r ? { requests: r.n, c5xx: r.c5xx, p95: r.n ? Math.round(r.p95w / r.n) : null } : { requests: 0, c5xx: 0, p95: null };
}

/** What the experiment did and whether monitoring noticed. */
async function impact(exp) {
  const from = new Date(exp.startedAt);
  const end = new Date(Math.min(Date.now(), new Date(exp.stoppedAt || exp.endsAt).getTime()));
  const span = Math.max(end - from, MINUTE);
  const grace = new Date(end.getTime() + 5 * MINUTE); // alerts evaluate every minute; allow a few
  const [during, before, incidents, deliveries, jobs, synthetic] = await Promise.all([
    api(from, end),
    api(new Date(from - span), from),
    model('Incident').find({ startedAt: { $gte: from, $lt: grace } }).sort({ startedAt: 1 }).select('title service severity startedAt fingerprint').lean(),
    model('DeliveryLog').aggregate([{ $match: { at: { $gte: from, $lt: end }, status: 'failed' } }, { $group: { _id: '$channel', n: { $sum: 1 } } }]),
    model('SchedulerRun').countDocuments({ startedAt: { $gte: from, $lt: end }, ok: false }),
    model('SyntheticRun').countDocuments({ at: { $gte: from, $lt: end }, ok: false }),
  ]);
  const first = incidents[0];
  return {
    window: { from, to: end },
    api: { during, before },
    incidents,
    detected: Boolean(first),
    detectionSeconds: first ? Math.round((new Date(first.startedAt) - from) / 1000) : null,
    deliveryFailures: Object.fromEntries(deliveries.map((d) => [d._id, d.n])),
    schedulerFailures: jobs,
    syntheticFailures: synthetic,
  };
}

const getFailures = asyncHandler(async (req, res) => {
  await faults.refreshStripeMode();
  const experiments = await model('FailureExperiment').find().sort({ startedAt: -1 }).limit(20).populate('startedBy stoppedBy', 'name').lean();
  const now = Date.now();
  const rows = await Promise.all(
    experiments.map(async (e) => ({
      ...e,
      status: e.stoppedAt ? 'stopped' : new Date(e.endsAt).getTime() > now ? 'running' : 'ended',
      label: faults.TYPES[e.type]?.label || e.type,
      impact: await impact(e),
    }))
  );
  const jobs = require('../../services/scheduler').SCHEDULE?.map((j) => j.name) || [];
  return sendSuccess(res, { availability: faults.availability(), types: faults.TYPES, maxMinutes: faults.MAX_MINUTES, schedulerJobs: jobs, experiments: rows });
});

const startFailure = asyncHandler(async (req, res) => {
  const r = await faults.startExperiment(req.body, req.user._id);
  if (r.error) return sendError(res, r.error, r.status);
  await audit(req, `Developer started failure experiment: ${faults.TYPES[r.experiment.type].label}`, { experimentId: String(r.experiment._id), type: r.experiment.type, target: r.experiment.target, minutes: req.body.durationMinutes, reason: r.experiment.reason });
  return sendSuccess(res, { experiment: r.experiment }, 'Experiment started.', null, 201);
});

const stopFailure = asyncHandler(async (req, res) => {
  const all = req.params.id === 'all';
  if (!all && !mongoose.isValidObjectId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const n = await faults.stopExperiments(all ? {} : { _id: req.params.id }, req.user._id);
  await audit(req, all ? 'Developer stopped all failure experiments' : 'Developer stopped a failure experiment', { experimentId: all ? 'all' : req.params.id, stopped: n });
  return sendSuccess(res, { stopped: n });
});

module.exports = { getFailures, startFailure, stopFailure };
