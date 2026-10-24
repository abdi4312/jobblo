const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const scheduler = require('../../services/scheduler');
const { MINUTE } = require('../../utils/devQuery');
const { STUCK_MS, queueStats } = require('../../services/monitoring/workQueues');

/** Developer console — Queues & background jobs: database work queues plus the BullMQ broker, with dead-letter retry (operations, audited). */

// ── 8b. Queues page ───
const getQueues = asyncHandler(async (req, res) => {
  const [queues, broker] = await Promise.all([queueStats(), require('../../services/queue/admin').overview()]);
  return sendSuccess(res, {
    broker,
    queues,
    scheduler: { enabled: scheduler.state.enabled, mode: scheduler.state.mode, jobs: scheduler.SCHEDULE.map((j) => ({ name: j.name, everyMs: j.everyMs })) },
    stuckAfterMinutes: STUCK_MS / MINUTE,
  });
});

// Dead-letter recovery for the BullMQ queues (operations access; audited).
const queueAction = (fn, verb) =>
  asyncHandler(async (req, res) => {
    try {
      const result = await fn(req.params.queue, req.params.id);
      logActivity({ adminId: req.user._id, action: 'other', description: `Queue ${req.params.queue}: ${verb}${req.params.id ? ` job ${req.params.id}` : ''}`, metadata: { area: 'developer.queues', queue: req.params.queue, jobId: req.params.id || null, result }, ip: req.ip, userAgent: req.get('user-agent') || 'unknown' });
      return sendSuccess(res, result, `${verb} done.`);
    } catch (err) {
      return sendError(res, err.message, err.status || 500);
    }
  });
const qa = () => require('../../services/queue/admin');
const retryQueueJob = queueAction((q, id) => qa().retryJob(q, id), 'retried');
const removeQueueJob = queueAction((q, id) => qa().removeJob(q, id), 'removed');
const retryFailedJobs = queueAction((q) => qa().retryAllFailed(q), 'retried all failed');

module.exports = { getQueues, queueAction, qa, retryQueueJob, removeQueueJob, retryFailedJobs };
