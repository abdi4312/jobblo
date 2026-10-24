const mongoose = require('mongoose');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const ledger = require('../../services/monitoring/ledger');

/** Developer dashboard — financial ledger inspector. Read-only; amounts in øre. */
const getLedger = asyncHandler(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : null;
  return sendSuccess(res, await ledger.inspect({ month }));
});

const getOrderJournal = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.orderId)) return sendError(res, 'Invalid id.', 400);
  const j = await ledger.orderJournal(req.params.orderId);
  if (!j) return sendError(res, 'Order not found.', 404);
  return sendSuccess(res, j);
});

module.exports = { getLedger, getOrderJournal };
