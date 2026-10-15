const crypto = require('crypto');
const StripeBillingOperation = require('../../models/StripeBillingOperation');

const ACTIVE_STATES = ['pending', 'reconciliation_required'];

async function getOrCreateBillingOperation({
  fingerprint,
  operationType,
  userId,
  subscriptionId,
  targetPlanId,
  testMode,
}) {
  const existing = await StripeBillingOperation.findOne({
    fingerprint,
    status: { $in: ACTIVE_STATES },
  });
  if (existing) return existing;

  const operationId = crypto.randomUUID();
  const activeSubscriptionKey = `${testMode ? 'test' : 'live'}:${subscriptionId}`;
  try {
    return await StripeBillingOperation.create({
      operationId,
      fingerprint,
      activeSubscriptionKey,
      idempotencyKey: `jobblo_billing_${operationType}_${operationId}`,
      operationType,
      userId,
      subscriptionId,
      targetPlanId,
      stripeMode: testMode ? 'test' : 'live',
      status: 'pending',
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const claimed = await StripeBillingOperation.findOne({
      fingerprint,
      status: { $in: ACTIVE_STATES },
    });
    if (claimed) return claimed;
    const inFlight = await StripeBillingOperation.findOne({
      activeSubscriptionKey,
      status: { $in: ACTIVE_STATES },
    });
    if (inFlight) {
      const conflict = new Error('Another subscription operation requires completion or reconciliation.');
      conflict.code = 'BILLING_OPERATION_IN_PROGRESS';
      throw conflict;
    }
    throw error;
  }
}

function findActiveBillingOperation(fingerprint) {
  return StripeBillingOperation.findOne({
    fingerprint,
    status: { $in: ACTIVE_STATES },
  });
}

async function finishBillingOperation(operation, status, details = {}) {
  const update = {
    $set: {
      status,
      ...(details.stripeObjectId ? { stripeObjectId: details.stripeObjectId } : {}),
      ...(details.failureCode ? { failureCode: details.failureCode } : { failureCode: null }),
    },
  };
  if (!ACTIVE_STATES.includes(status)) update.$unset = { activeSubscriptionKey: 1 };
  await StripeBillingOperation.updateOne(
    { _id: operation._id, status: { $in: ACTIVE_STATES } },
    update
  );
}

function operationIdempotencyKey(operation, suffix = '') {
  return suffix
    ? `${operation.idempotencyKey}_${suffix}`
    : operation.idempotencyKey;
}

module.exports = {
  getOrCreateBillingOperation,
  findActiveBillingOperation,
  finishBillingOperation,
  operationIdempotencyKey,
};
