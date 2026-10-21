const mongoose = require('mongoose');
const { processVerifiedEvent } = require('../services/subscriptions/v2WebhookProcessor');

const userId = new mongoose.Types.ObjectId();
const subscriptionRecordId = new mongoose.Types.ObjectId();
const currentPlanId = new mongoose.Types.ObjectId();
const targetPlanId = new mongoose.Types.ObjectId();
const operationId = 'schedule-operation-1';
const scheduleId = 'sub_sched_v2';
const subscriptionId = 'sub_v2_schedule';
const customerId = 'cus_v2_schedule';
const currentPriceId = 'price_plus_test';
const targetPriceId = 'price_pro_test';
const periodStart = Math.floor(new Date('2026-10-16T21:48:09Z').getTime() / 1000);
const periodEnd = Math.floor(new Date('2026-11-16T21:48:09Z').getTime() / 1000);
const nextPeriodEnd = Math.floor(new Date('2026-12-16T21:48:09Z').getTime() / 1000);

function query(value) {
  return { lean: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) };
}

function fixture({ status = 'active', pending = null } = {}) {
  const metadata = {
    subscriptionV2: 'true',
    userId: String(userId),
    subscriptionId: String(subscriptionRecordId),
    planId: String(targetPlanId),
    operationId,
    stripeMode: 'test',
  };
  const currentPlan = {
    _id: currentPlanId,
    type: 'private',
    stripePriceIdTest: currentPriceId,
  };
  const targetPlan = {
    _id: targetPlanId,
    type: 'private',
    stripePriceIdTest: targetPriceId,
  };
  const record = {
    _id: subscriptionRecordId,
    userId,
    planId: currentPlanId,
    planType: 'private',
    stripeMode: 'test',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: currentPriceId,
    status: 'active',
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    pendingPlanChange: pending,
  };
  const operation = {
    operationId,
    operationType: 'downgrade',
    status: 'succeeded',
    lifecycleLock: false,
    userId,
    subscriptionId: subscriptionRecordId,
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
    stripeMode: 'test',
    targetPlanId,
    stripePriceId: targetPriceId,
    stripeScheduleId: scheduleId,
  };
  const schedule = {
    id: scheduleId,
    status,
    livemode: false,
    subscription: subscriptionId,
    metadata,
    phases: [
      {
        start_date: periodStart,
        end_date: periodEnd,
        items: [{ price: currentPriceId, quantity: 1 }],
      },
      {
        start_date: periodEnd,
        end_date: nextPeriodEnd,
        items: [{ price: targetPriceId, quantity: 1 }],
        metadata: {
          subscriptionV2: 'true',
          userId: String(userId),
          planId: String(targetPlanId),
          operationId,
          stripeMode: 'test',
        },
      },
    ],
  };
  const subscription = {
    id: subscriptionId,
    status: 'active',
    livemode: false,
    customer: customerId,
    cancel_at_period_end: false,
    metadata: { subscriptionV2: 'true' },
    items: {
      data: [{
        current_period_start: periodStart,
        current_period_end: periodEnd,
        quantity: 1,
        price: {
          id: currentPriceId,
          active: true,
          livemode: false,
          currency: 'nok',
          type: 'recurring',
          recurring: { interval: 'month', interval_count: 1 },
        },
      }],
    },
  };
  const eventDoc = { _id: new mongoose.Types.ObjectId(), status: 'processing' };
  const SubscriptionModel = {
    findOne: jest.fn(() => query(record)),
    updateOne: jest.fn(async () => ({ matchedCount: 1, modifiedCount: 1 })),
  };
  const PlanModel = {
    findById: jest.fn((id) => query(String(id) === String(currentPlanId) ? currentPlan : targetPlan)),
  };
  const OperationModel = { findOne: jest.fn(() => query(operation)) };
  const EventModel = {
    create: jest.fn(async () => eventDoc),
    updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
  };
  const stripe = {
    subscriptionSchedules: { retrieve: jest.fn(async () => schedule) },
    subscriptions: { retrieve: jest.fn(async () => subscription) },
    prices: { retrieve: jest.fn(async () => ({
      id: targetPriceId,
      active: true,
      livemode: false,
      currency: 'nok',
      type: 'recurring',
      recurring: { interval: 'month', interval_count: 1 },
    })) },
  };
  const event = {
    id: `evt_schedule_${status}`,
    type: status === 'canceled' ? 'subscription_schedule.canceled' : 'subscription_schedule.updated',
    livemode: false,
    data: { object: { id: scheduleId, metadata } },
  };
  const overrides = {
    SubscriptionModel,
    PlanModel,
    OperationModel,
    EventModel,
    RecoveryEmailModel: {},
  };
  return {
    event,
    record,
    schedule,
    subscription,
    operation,
    SubscriptionModel,
    EventModel,
    OperationModel,
    stripe,
    overrides,
  };
}

test('synchronizes a verified active V2 schedule to the pending local plan change', async () => {
  const f = fixture();

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides)).resolves.toEqual({
    handled: 'subscription_schedule_synchronized',
  });

  expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
    expect.objectContaining({
      _id: subscriptionRecordId,
      userId,
      planId: currentPlanId,
      currentPeriodEnd: new Date(periodEnd * 1000),
      pendingPlanChange: null,
    }),
    {
      $set: {
        pendingPlanChange: {
          targetPlanId,
          targetPlanType: 'private',
          targetStripePriceId: targetPriceId,
          effectiveAt: new Date(periodEnd * 1000),
          operationId,
          stripeScheduleId: scheduleId,
        },
      },
    }
  );
  expect(f.EventModel.updateOne).toHaveBeenLastCalledWith(
    expect.any(Object),
    expect.objectContaining({ $set: expect.objectContaining({ status: 'processed' }) })
  );
});

test('acknowledges schedule creation and waits for the target-phase update', async () => {
  const f = fixture();
  f.event.type = 'subscription_schedule.created';
  f.event.data.object.metadata = {};
  f.schedule.metadata = {};
  f.subscription.metadata = {
    subscriptionV2: 'true',
    userId: String(userId),
    planId: String(currentPlanId),
    operationId: 'existing-operation',
    stripeMode: 'test',
  };

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides)).resolves.toEqual({
    handled: 'subscription_schedule_created_awaiting_update',
  });

  expect(f.stripe.subscriptionSchedules.retrieve).toHaveBeenCalledWith(scheduleId);
  expect(f.stripe.subscriptions.retrieve).toHaveBeenCalledWith(
    subscriptionId,
    { expand: ['latest_invoice', 'items.data.price'] }
  );
  expect(f.SubscriptionModel.findOne).toHaveBeenCalledWith({
    userId,
    stripeMode: 'test',
    stripeSubscriptionId: subscriptionId,
    stripeCustomerId: customerId,
  });
  expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
  expect(f.OperationModel.findOne).not.toHaveBeenCalled();
});

test('does not process a metadata-less schedule creation when canonical ownership cannot be verified', async () => {
  const f = fixture();
  f.event.type = 'subscription_schedule.created';
  f.event.data.object.metadata = {};
  f.schedule.metadata = {};
  f.subscription.metadata = {
    subscriptionV2: 'true',
    userId: String(userId),
    planId: String(currentPlanId),
    operationId: 'existing-operation',
    stripeMode: 'test',
  };
  f.SubscriptionModel.findOne.mockReturnValue(query(null));

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides))
    .rejects.toThrow('subscription_schedule_owner_mismatch');

  expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
  expect(f.EventModel.updateOne).toHaveBeenLastCalledWith(
    expect.any(Object),
    expect.objectContaining({
      $set: expect.objectContaining({ status: 'failed' }),
    })
  );
});

test('ignores a metadata-less schedule creation after canonical Stripe verification shows it is not V2', async () => {
  const f = fixture();
  f.event.type = 'subscription_schedule.created';
  f.event.data.object.metadata = {};
  f.schedule.metadata = {};
  f.subscription.metadata = {};

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides)).resolves.toEqual({
    handled: 'subscription_event_ignored',
  });

  expect(f.stripe.subscriptions.retrieve).toHaveBeenCalledWith(
    subscriptionId,
    { expand: ['latest_invoice', 'items.data.price'] }
  );
  expect(f.SubscriptionModel.findOne).not.toHaveBeenCalled();
  expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
});

test('clears only the matching pending change when Stripe cancels its schedule', async () => {
  const pending = {
    targetPlanId,
    targetPlanType: 'private',
    targetStripePriceId: targetPriceId,
    effectiveAt: new Date(periodEnd * 1000),
    operationId,
    stripeScheduleId: scheduleId,
  };
  const f = fixture({ status: 'canceled', pending });

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides)).resolves.toEqual({
    handled: 'subscription_schedule_cleared',
  });

  expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
    expect.objectContaining({
      _id: subscriptionRecordId,
      'pendingPlanChange.operationId': operationId,
      'pendingPlanChange.stripeScheduleId': scheduleId,
    }),
    { $set: { pendingPlanChange: null } }
  );
});

test('clears a matching schedule aborted after the underlying subscription is canceled', async () => {
  const pending = {
    targetPlanId,
    targetPlanType: 'private',
    targetStripePriceId: targetPriceId,
    effectiveAt: new Date(periodEnd * 1000),
    operationId,
    stripeScheduleId: scheduleId,
  };
  const f = fixture({ status: 'aborted', pending });
  f.event.type = 'subscription_schedule.aborted';
  f.subscription.status = 'canceled';

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides)).resolves.toEqual({
    handled: 'subscription_schedule_cleared',
  });

  expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
    expect.objectContaining({
      _id: subscriptionRecordId,
      'pendingPlanChange.operationId': operationId,
      'pendingPlanChange.stripeScheduleId': scheduleId,
    }),
    { $set: { pendingPlanChange: null } }
  );
});

test('clears a schedule released in Stripe (e.g. billing portal), where Stripe nulls `subscription`', async () => {
  const pending = {
    targetPlanId,
    targetPlanType: 'private',
    targetStripePriceId: targetPriceId,
    effectiveAt: new Date(periodEnd * 1000),
    operationId,
    stripeScheduleId: scheduleId,
  };
  const f = fixture({ status: 'released', pending });
  f.event.type = 'subscription_schedule.released';
  // What Stripe actually returns for a released schedule.
  f.schedule.subscription = null;
  f.schedule.released_subscription = subscriptionId;
  f.event.data.object.subscription = null;

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides)).resolves.toEqual({
    handled: 'subscription_schedule_cleared',
  });
  expect(f.SubscriptionModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ stripeSubscriptionId: subscriptionId }));
  expect(f.SubscriptionModel.updateOne).toHaveBeenCalledWith(
    expect.objectContaining({ _id: subscriptionRecordId, 'pendingPlanChange.stripeScheduleId': scheduleId }),
    { $set: { pendingPlanChange: null } }
  );
});

test('clears a released schedule on a record activated without stripePriceId (never changed plan)', async () => {
  const pending = {
    targetPlanId,
    targetPlanType: 'private',
    targetStripePriceId: targetPriceId,
    effectiveAt: new Date(periodEnd * 1000),
    operationId,
    stripeScheduleId: scheduleId,
  };
  const f = fixture({ status: 'released', pending });
  f.event.type = 'subscription_schedule.released';
  f.schedule.subscription = null;
  f.schedule.released_subscription = subscriptionId;
  // Activation never stored the top-level price, so this stayed "transition pending" forever.
  f.SubscriptionModel.findOne.mockImplementation(() => query({
    _id: subscriptionRecordId, userId, planId: currentPlanId, planType: 'private', stripeMode: 'test',
    stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, status: 'active',
    currentPeriodStart: new Date(periodStart * 1000), currentPeriodEnd: new Date(periodEnd * 1000), pendingPlanChange: pending,
  }));

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides)).resolves.toEqual({
    handled: 'subscription_schedule_cleared',
  });
});

describe('the two simultaneous release events (released + updated)', () => {
  const pending = () => ({
    targetPlanId, targetPlanType: 'private', targetStripePriceId: targetPriceId,
    effectiveAt: new Date(periodEnd * 1000), operationId, stripeScheduleId: scheduleId,
  });
  const released = () => {
    const f = fixture({ status: 'released', pending: pending() });
    f.event.type = 'subscription_schedule.updated';
    f.schedule.subscription = null;
    f.schedule.released_subscription = subscriptionId;
    f.SubscriptionModel.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 }); // the other event won
    return f;
  };

  it('the loser finds the change already cleared and succeeds instead of answering 500', async () => {
    const f = released();
    const first = f.SubscriptionModel.findOne.getMockImplementation();
    f.SubscriptionModel.findOne
      .mockImplementationOnce(first) // initial read: pending still set
      .mockImplementationOnce(() => query({ _id: subscriptionRecordId, userId, pendingPlanChange: null }));
    await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides)).resolves.toEqual({
      handled: 'subscription_schedule_already_cleared',
    });
  });

  it('still fails if the record now holds a different pending change', async () => {
    const f = released();
    const first = f.SubscriptionModel.findOne.getMockImplementation();
    f.SubscriptionModel.findOne
      .mockImplementationOnce(first)
      .mockImplementationOnce(() => query({ _id: subscriptionRecordId, userId, pendingPlanChange: { ...pending(), operationId: 'newer', stripeScheduleId: 'sub_sched_new' } }));
    await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides))
      .rejects.toThrow('subscription_schedule_state_changed');
  });
});

test('a released schedule pointing at another subscription is still rejected', async () => {
  const f = fixture({ status: 'released' });
  f.event.type = 'subscription_schedule.released';
  f.schedule.subscription = null;
  f.schedule.released_subscription = 'sub_someone_else';
  f.SubscriptionModel.findOne.mockImplementation((q) => query(q.stripeSubscriptionId === subscriptionId ? {} : null));

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides))
    .rejects.toThrow('subscription_schedule_owner_mismatch');
  expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
});

test('ignores an out-of-order schedule snapshot after canonical metadata changes', async () => {
  const f = fixture();
  f.schedule.metadata = { ...f.schedule.metadata, operationId: 'newer-operation' };

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides)).resolves.toEqual({
    handled: 'subscription_schedule_stale_event',
  });

  expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
  expect(f.OperationModel.findOne).not.toHaveBeenCalled();
});

test('rejects a canonical Stripe customer mismatch without changing the pending plan', async () => {
  const f = fixture();
  f.subscription.customer = 'cus_someone_else';

  await expect(processVerifiedEvent(f.event, 'test', f.stripe, f.overrides))
    .rejects.toThrow('subscription_schedule_owner_mismatch');

  expect(f.SubscriptionModel.updateOne).not.toHaveBeenCalled();
  expect(f.EventModel.updateOne).toHaveBeenLastCalledWith(
    expect.any(Object),
    expect.objectContaining({
      $set: expect.objectContaining({
        status: 'failed',
        lastErrorCode: 'subscription_webhook_failed',
      }),
    })
  );
});
