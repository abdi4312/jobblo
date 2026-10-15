const mockOperations = new Map();

jest.mock('../models/StripeBillingOperation', () => ({
  findOne: jest.fn((query) =>
    Promise.resolve(
      [...mockOperations.values()].find((operation) =>
        (query.fingerprint ? operation.fingerprint === query.fingerprint : true) &&
        (query.activeSubscriptionKey
          ? operation.activeSubscriptionKey === query.activeSubscriptionKey
          : true) &&
        (!query.status?.$in || query.status.$in.includes(operation.status))
      ) || null
    )
  ),
  create: jest.fn(async (operation) => {
    if ([...mockOperations.values()].some((saved) =>
      (saved.fingerprint === operation.fingerprint ||
        saved.activeSubscriptionKey === operation.activeSubscriptionKey) &&
      ['pending', 'reconciliation_required'].includes(saved.status)
    )) {
      const error = new Error('duplicate active billing operation');
      error.code = 11000;
      throw error;
    }
    const saved = { _id: `operation_${mockOperations.size + 1}`, ...operation };
    mockOperations.set(saved.operationId, saved);
    return saved;
  }),
  updateOne: jest.fn(async ({ _id }, update) => {
    const operation = [...mockOperations.values()].find((saved) => saved._id === _id);
    if (operation) Object.assign(operation, update.$set);
    if (operation && update.$unset) {
      Object.keys(update.$unset).forEach((field) => delete operation[field]);
    }
    return { modifiedCount: operation ? 1 : 0 };
  }),
}));

const {
  getOrCreateBillingOperation,
  finishBillingOperation,
} = require('../services/stripe/billingOperations');

const base = {
  fingerprint: 'test:sub_1:cancel',
  operationType: 'cancel',
  userId: 'user_1',
  subscriptionId: 'sub_1',
  testMode: true,
};

beforeEach(() => mockOperations.clear());

it('reuses retries of one active action and creates a new key after each completed action', async () => {
  const cancelOne = await getOrCreateBillingOperation(base);
  const retry = await getOrCreateBillingOperation(base);
  await finishBillingOperation(cancelOne, 'succeeded', { stripeObjectId: 'sub_1' });

  const resume = await getOrCreateBillingOperation({
    ...base,
    fingerprint: 'test:sub_1:resume',
    operationType: 'resume',
  });
  await finishBillingOperation(resume, 'succeeded', { stripeObjectId: 'sub_1' });

  const cancelAgain = await getOrCreateBillingOperation(base);

  expect(retry.operationId).toBe(cancelOne.operationId);
  expect(retry.idempotencyKey).toBe(cancelOne.idempotencyKey);
  expect(cancelAgain.operationId).not.toBe(cancelOne.operationId);
  expect(cancelAgain.idempotencyKey).not.toBe(cancelOne.idempotencyKey);
});

it('generates unique persisted operation IDs for a separate plan transition', async () => {
  const firstUpgrade = await getOrCreateBillingOperation({
    ...base,
    fingerprint: 'test:sub_1:upgrade:price_a:price_b',
    operationType: 'upgrade',
    targetPlanId: 'plan_b',
  });
  await finishBillingOperation(firstUpgrade, 'succeeded');
  const downgrade = await getOrCreateBillingOperation({
    ...base,
    fingerprint: 'test:sub_1:downgrade:price_b:price_a',
    operationType: 'downgrade',
    targetPlanId: 'plan_a',
  });

  expect(downgrade.operationId).not.toBe(firstUpgrade.operationId);
  expect(downgrade.idempotencyKey).not.toBe(firstUpgrade.idempotencyKey);
});

it('does not allow a concurrent, different mutation on the same subscription', async () => {
  await getOrCreateBillingOperation(base);

  await expect(getOrCreateBillingOperation({
    ...base,
    fingerprint: 'test:sub_1:resume',
    operationType: 'resume',
  })).rejects.toMatchObject({ code: 'BILLING_OPERATION_IN_PROGRESS' });
});
