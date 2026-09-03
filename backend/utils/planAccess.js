const ROLE_TO_PLAN_TYPE = {
  user: 'private',
  provider: 'private',
  superAdmin: 'private',
  company: 'business',
};

function resolveAllowedPlanType(user) {
  return ROLE_TO_PLAN_TYPE[user?.role] || null;
}

module.exports = { resolveAllowedPlanType };
