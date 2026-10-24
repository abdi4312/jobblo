const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const fraud = require('../../services/monitoring/fraud');
const FraudCase = require('../../models/FraudCase');

/** Developer dashboard — fraud & abuse detection. Flags are computed live (cached 10 min). */
const getFraud = asyncHandler(async (req, res) => {
  const data = await fraud.scan({ force: req.query.refresh === 'true' });
  return sendSuccess(res, {
    ...data,
    flagged: data.flagged.map(({ hits, ...f }) => ({ ...f, topEvidence: hits.slice(0, 2).map((h) => h.evidence) })),
    summary: {
      high: data.flagged.filter((f) => f.level === 'high' && f.status === 'open').length,
      medium: data.flagged.filter((f) => f.level === 'medium' && f.status === 'open').length,
      investigating: data.flagged.filter((f) => f.status === 'investigating').length,
      confirmed: data.flagged.filter((f) => f.status === 'confirmed').length,
      dismissed: data.flagged.filter((f) => f.status === 'dismissed').length,
    },
  });
});

const getFraudCase = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return sendError(res, 'Invalid id.', 400);
  const data = await fraud.scan();
  const f = data.flagged.find((x) => x.userId === req.params.userId);
  if (!f) return sendError(res, 'This user is not currently flagged.', 404);
  const relatedIds = [...new Set(f.hits.flatMap((h) => h.related || []))].filter((id) => mongoose.isValidObjectId(id));
  const [related, history] = await Promise.all([
    require('../../models/User').find({ _id: { $in: relatedIds } }).select('name email role accountStatus createdAt').lean(),
    FraudCase.findOne({ userId: req.params.userId }).populate('history.by', 'name').lean(),
  ]);
  const flaggedIds = new Set(data.flagged.map((x) => x.userId));
  return sendSuccess(res, {
    ...f,
    related: related.map((u) => ({ ...u, _id: String(u._id), flagged: flaggedIds.has(String(u._id)) })),
    history: (history?.history || []).slice().reverse(),
    rules: f.rules.map((k) => ({ key: k, title: fraud.RULES[k].title, category: fraud.RULES[k].category })),
  });
});

const updateFraudCase = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return sendError(res, 'Invalid id.', 400);
  const status = String(req.body?.status || '');
  if (!['open', 'investigating', 'confirmed', 'dismissed'].includes(status)) return sendError(res, 'Invalid status.', 400);
  const note = req.body?.note ? String(req.body.note).trim().slice(0, 1000) : null;
  if (['confirmed', 'dismissed'].includes(status) && (!note || note.length < 5)) return sendError(res, 'Explain the decision in a note (at least 5 characters).', 400);
  const data = await fraud.scan();
  const current = data.flagged.find((x) => x.userId === req.params.userId);
  const now = new Date();
  await FraudCase.updateOne(
    { userId: req.params.userId },
    { $set: { status, note, scoreAtReview: current?.score ?? null, reviewedBy: req.user._id, reviewedAt: now }, $push: { history: { at: now, by: req.user._id, status, note, score: current?.score ?? null } } },
    { upsert: true }
  );
  fraud.invalidate();
  await logActivity({
    adminId: req.user._id,
    action: 'other',
    targetModel: 'User',
    targetId: req.params.userId,
    description: `Developer marked fraud case ${status}`,
    metadata: { area: 'developer.fraud', status, note, score: current?.score ?? null, rules: current?.rules || [] },
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown',
  });
  return sendSuccess(res, { status }, 'Case updated.');
});

module.exports = { getFraud, getFraudCase, updateFraudCase };
