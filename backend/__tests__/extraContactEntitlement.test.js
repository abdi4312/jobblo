/**
 * The contact paywall.
 *
 * Two holes are closed here:
 *   1. Any paid Stripe session id replayed in the request body granted unlimited
 *      bypass — no ownership, type, service or redemption check.
 *   2. A genuine extra-contact purchase was never marked consumed, so one purchase
 *      unlocked that service for that user permanently and without limit.
 */

jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/SubscriptionPlan', () => ({ findOne: jest.fn() }));
jest.mock('../models/Subscription', () => ({ findOne: jest.fn() }));
jest.mock('../models/Transaction', () => ({ findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/Service', () => ({ findById: jest.fn() }));
jest.mock('../models/JobRequest', () => ({ findOne: jest.fn() }));
jest.mock('../models/GlobalConfig', () => ({ findOne: jest.fn() }));

const User = require('../models/User');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const Transaction = require('../models/Transaction');
const GlobalConfig = require('../models/GlobalConfig');
const JobRequest = require('../models/JobRequest');
const { checkSubscription } = require('../middleware/checkSubscription');

const USER_ID = 'user_1';
const SERVICE_ID = 'service_1';

function makeReq(body = {}) {
  return { user: { _id: USER_ID }, body };
}

function makeRes() {
  const listeners = {};
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    on(event, cb) {
      listeners[event] = cb;
    },
    _finish(code) {
      this.statusCode = code;
      listeners.finish?.();
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockResolvedValue({
    _id: USER_ID,
    monthlyContactUsage: 99,
    lastContactReset: new Date(),
    createdAt: new Date(),
    planType: 'private',
    save: jest.fn().mockResolvedValue(),
  });
  Subscription.findOne.mockResolvedValue(null);
  SubscriptionPlan.findOne.mockReturnValue({
    sort: jest.fn().mockResolvedValue({
      entitlements: { freeContact: 0, perContactPrice: 49, ContactUnlock: 60 },
    }),
  });
  SubscriptionPlan.findOne.mockResolvedValue({
    entitlements: { freeContact: 0, perContactPrice: 49, ContactUnlock: 60 },
  });
  GlobalConfig.findOne.mockResolvedValue(null);
  JobRequest.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
  Transaction.updateOne.mockResolvedValue({});
});

describe('replay protection', () => {
  it('ignores a Stripe sessionId in the body entirely', async () => {
    // No entitlement row exists; a paid session id must not help.
    Transaction.findOneAndUpdate.mockResolvedValue(null);

    const req = makeReq({ serviceId: SERVICE_ID, sessionId: 'cs_someone_elses_paid_session' });
    const res = makeRes();
    const next = jest.fn();

    await checkSubscription(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(402);
    expect(res.body).toEqual(expect.objectContaining({ paymentRequired: true }));
  });
});

describe('entitlement consumption', () => {
  it('claims the entitlement atomically, requiring it to be unconsumed', async () => {
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn_1' });

    const req = makeReq({ serviceId: SERVICE_ID });
    const next = jest.fn();

    await checkSubscription(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
    expect(Transaction.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        serviceId: SERVICE_ID,
        status: 'succeeded',
        type: 'extra_contact',
        consumedAt: null, // the guard that makes it single-use
      }),
      { $set: { consumedAt: expect.any(Date) } },
      expect.objectContaining({ new: true })
    );
    expect(req.consumedEntitlementId).toBe('txn_1');
  });

  it('refuses a second use of the same purchase', async () => {
    // First call claims it; the second finds nothing unconsumed.
    Transaction.findOneAndUpdate.mockResolvedValueOnce({ _id: 'txn_1' }).mockResolvedValueOnce(null);

    const firstNext = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), makeRes(), firstNext);
    expect(firstNext).toHaveBeenCalled();

    const secondRes = makeRes();
    const secondNext = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), secondRes, secondNext);

    expect(secondNext).not.toHaveBeenCalled();
    expect(secondRes.statusCode).toBe(402);
  });

  it('releases the entitlement if the request it was claimed for fails', async () => {
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn_1' });

    const res = makeRes();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), res, jest.fn());

    res._finish(500); // downstream controller blew up

    expect(Transaction.updateOne).toHaveBeenCalledWith(
      { _id: 'txn_1' },
      { $set: { consumedAt: null } }
    );
  });

  it('keeps the entitlement spent when the request succeeds', async () => {
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn_1' });

    const res = makeRes();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), res, jest.fn());

    res._finish(201);

    expect(Transaction.updateOne).not.toHaveBeenCalled();
  });
});

describe('independence from Stripe configuration', () => {
  it('does not construct a Stripe client — a misconfigured key must not break applying', async () => {
    // config/stripe is deliberately NOT mocked here. If the middleware still called
    // getStripe() this would attempt real configuration lookup; instead it must not
    // be referenced at all.
    Transaction.findOneAndUpdate.mockResolvedValue({ _id: 'txn_1' });

    const next = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), makeRes(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('free monthly quota still works', () => {
  it('lets a user through while they have free contacts left', async () => {
    User.findById.mockResolvedValue({
      _id: USER_ID,
      monthlyContactUsage: 1,
      lastContactReset: new Date(),
      createdAt: new Date(),
      planType: 'private',
      save: jest.fn().mockResolvedValue(),
    });
    SubscriptionPlan.findOne.mockResolvedValue({
      entitlements: { freeContact: 5, perContactPrice: 49, ContactUnlock: 60 },
    });
    Transaction.findOneAndUpdate.mockResolvedValue(null);

    const next = jest.fn();
    await checkSubscription(makeReq({ serviceId: SERVICE_ID }), makeRes(), next);

    expect(next).toHaveBeenCalled();
  });
});
