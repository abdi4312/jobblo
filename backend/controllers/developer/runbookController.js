const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const rb = require('../../services/monitoring/runbooks');
const RunbookRun = require('../../models/RunbookRun');
const Incident = require('../../models/Incident');

/** Developer dashboard — runbook center. Checks are read-only; runs and step notes are audited. */

const audit = (req, description, metadata = {}) =>
  logActivity({ adminId: req.user._id, action: 'other', description, metadata: { area: 'developer.runbooks', ...metadata }, ip: req.ip, userAgent: req.get('user-agent') || 'unknown' });
const find = (key) => rb.RUNBOOKS.find((r) => r.key === key);

const listRunbooks = asyncHandler(async (req, res) => {
  const [open, lastRuns] = await Promise.all([
    Incident.find({ status: { $ne: 'resolved' } }).sort({ startedAt: -1 }).limit(50).select('title fingerprint severity status startedAt').lean(),
    RunbookRun.aggregate([{ $sort: { createdAt: -1 } }, { $group: { _id: '$runbook', at: { $first: '$createdAt' }, state: { $first: '$state' }, runs: { $sum: 1 } } }]),
  ]);
  const last = Object.fromEntries(lastRuns.map((r) => [r._id, r]));
  const incidents = open.map((i) => ({ ...i, runbooks: rb.forFingerprint(i.fingerprint) }));
  return sendSuccess(res, {
    runbooks: rb.RUNBOOKS.map((r) => ({ ...rb.describe(r), lastRun: last[r.key] || null, openIncidents: incidents.filter((i) => i.runbooks.includes(r.key)).length })),
    incidents,
  });
});

const getRunbook = asyncHandler(async (req, res) => {
  const r = find(req.params.key);
  if (!r) return sendError(res, 'Runbook not found.', 404);
  const runs = await RunbookRun.find({ runbook: r.key }).sort({ createdAt: -1 }).limit(10).populate('startedBy', 'name').populate('steps.doneBy', 'name').populate('incidentId', 'title status').lean();
  return sendSuccess(res, { runbook: rb.describe(r), runs });
});

const startRun = asyncHandler(async (req, res) => {
  const r = find(req.params.key);
  if (!r) return sendError(res, 'Runbook not found.', 404);
  const { incidentId } = req.body || {};
  if (incidentId && !mongoose.isValidObjectId(incidentId)) return sendError(res, 'Invalid incident.', 400);
  const incident = incidentId ? await Incident.findById(incidentId) : null;
  if (incidentId && !incident) return sendError(res, 'Incident not found.', 404);
  const checks = await rb.runChecks(r);
  const state = rb.overall(checks);
  const stored = checks.map((c) => ({ ...c, state: c.state === 'error' ? 'fail' : c.state }));
  // Re-running while a run is open refreshes its checks instead of opening a second run.
  const run =
    (await RunbookRun.findOneAndUpdate({ runbook: r.key, incidentId: incident?._id || null, closedAt: null }, { $set: { state, checks: stored } }, { new: true, sort: { createdAt: -1 } })) ||
    (await RunbookRun.create({ runbook: r.key, incidentId: incident?._id || null, startedBy: req.user._id, state, checks: stored }));
  if (incident) {
    const failing = checks.filter((c) => c.state !== 'pass').map((c) => c.title);
    incident.timeline.push({ by: req.user._id, kind: 'note', text: `Runbook "${r.title}" run: ${state}${failing.length ? ` — ${failing.join('; ')}` : ''}`.slice(0, 2000) });
    await incident.save();
  }
  audit(req, `Ran runbook ${r.title}`, { runbook: r.key, runId: String(run._id), incidentId: incidentId || null, state });
  return sendSuccess(res, { run }, 'Runbook checks finished.');
});

const updateRun = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 'Invalid run.', 400);
  const run = await RunbookRun.findById(req.params.id);
  if (!run) return sendError(res, 'Run not found.', 404);
  if (run.closedAt) return sendError(res, 'This run is closed.', 409);
  const r = find(run.runbook);
  const { step, note, close, outcome } = req.body || {};
  if (close) {
    run.closedAt = new Date();
    run.closedBy = req.user._id;
    run.outcome = typeof outcome === 'string' ? outcome.slice(0, 2000) : null;
  } else {
    if (!Number.isInteger(step) || step < 0 || step >= r.steps.length) return sendError(res, 'Invalid step.', 400);
    if (run.steps.some((s) => s.index === step)) return sendError(res, 'Step already marked done.', 409);
    run.steps.push({ index: step, doneBy: req.user._id, doneAt: new Date(), note: typeof note === 'string' ? note.slice(0, 1000) : undefined });
  }
  await run.save();
  if (run.incidentId) {
    const text = close ? `Runbook "${r.title}" closed${run.outcome ? `: ${run.outcome}` : ''}` : `Runbook step done: ${r.steps[step].text}${note ? ` — ${note}` : ''}`;
    await Incident.updateOne({ _id: run.incidentId }, { $push: { timeline: { at: new Date(), by: req.user._id, kind: 'note', text: text.slice(0, 2000) } } });
  }
  audit(req, close ? `Closed runbook run ${r.title}` : `Runbook step ${step + 1} done: ${r.title}`, { runbook: r.key, runId: String(run._id), step: close ? null : step });
  return sendSuccess(res, { run });
});

module.exports = { listRunbooks, getRunbook, startRun, updateRun };
