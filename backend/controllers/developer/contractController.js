const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const contracts = require('../../services/monitoring/contracts');

/** Developer dashboard — API contract monitoring. Shapes only; response values are never stored. */
const getContracts = asyncHandler(async (req, res) => {
  if (req.query.flush === 'true') await contracts.flush();
  return sendSuccess(res, await contracts.getContracts());
});

const getContract = asyncHandler(async (req, res) => {
  const { method, route, status } = req.query;
  if (!method || !route || !['2xx', '4xx'].includes(status)) return sendError(res, 'method, route and status are required.', 400);
  const c = await contracts.getContract(String(method).toUpperCase(), String(route), status);
  if (!c) return sendError(res, 'No contract recorded for this endpoint yet.', 404);
  return sendSuccess(res, c);
});

/** Acknowledge a change as intended (operations access, audited). */
const acknowledge = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 'Invalid id.', 400);
  const note = req.body?.note ? String(req.body.note).slice(0, 300) : null;
  const e = await require('../../models/ContractEvent').findOneAndUpdate({ _id: req.params.id, acknowledgedAt: null }, { $set: { acknowledgedAt: new Date(), acknowledgedBy: req.user._id, note } }, { new: true });
  if (!e) return sendError(res, 'Change not found or already acknowledged.', 404);
  await logActivity({ adminId: req.user._id, action: 'other', description: `Developer acknowledged API contract change ${e.kind} ${e.path} on ${e.method} ${e.route}`, metadata: { area: 'developer.contracts', eventId: String(e._id), note }, ip: req.ip, userAgent: req.get('user-agent') || 'unknown' });
  return sendSuccess(res, { acknowledged: true });
});

module.exports = { getContracts, getContract, acknowledge };
