const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');
const costs = require('../../services/monitoring/costs');

/** Developer dashboard — infrastructure cost center. */
const getCosts = asyncHandler(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : null;
  const [current] = costs.monthRange(month);
  const prev = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const [data, previous] = await Promise.all([costs.computeCosts(month), costs.computeCosts(prev)]);
  return sendSuccess(res, { ...data, previous: { month: previous.month, totalNok: previous.totalNok, byCategory: previous.byCategory, income: previous.income } });
});

/** Fixed items, unit prices and budget. Operations access; every change is audited. */
const updateCostConfig = asyncHandler(async (req, res) => {
  const { value, error } = costs.validateConfig(req.body || {});
  if (error) return sendError(res, error, 400);
  const GlobalConfig = require('../../models/GlobalConfig');
  const before = await costs.getConfig();
  const set = {};
  if ('monthlyBudgetNok' in value) set['value.monthlyBudgetNok'] = value.monthlyBudgetNok;
  if (value.fixed) set['value.fixed'] = value.fixed;
  for (const [k, v] of Object.entries(value.prices || {})) set[`value.prices.${k}`] = v;
  await GlobalConfig.updateOne({ key: costs.CONFIG_KEY }, { $set: set, $setOnInsert: { description: 'Developer dashboard cost center' } }, { upsert: true });
  await logActivity({
    adminId: req.user._id,
    action: 'other',
    description: 'Developer updated cost center settings',
    metadata: { area: 'developer.costs', changed: Object.keys(set), before: { monthlyBudgetNok: before.monthlyBudgetNok, fixed: before.fixed, prices: before.prices }, after: value },
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown',
  });
  return sendSuccess(res, { config: await costs.getConfig() }, 'Cost settings saved.');
});

module.exports = { getCosts, updateCostConfig };
