jest.mock('../models/Order', () => ({ findOne: jest.fn() }));
jest.mock('../models/Service', () => ({ findById: jest.fn() }));
jest.mock('../models/ChatMessage', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/JobRequest', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  exists: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../models/Notification', () => ({}));
jest.mock('../models/Payment', () => ({}));
jest.mock('../models/User', () => ({}));
jest.mock('../utils/points', () => ({ calculatePointsFromService: jest.fn() }));
jest.mock('../middleware/requireProviderConnect', () => ({
  ensureProviderConnectReady: jest.fn(async () => true),
}));
jest.mock('../services/notifications', () => ({ notify: jest.fn(async () => {}) }));
jest.mock('../services/subscriptions/v2Entitlements', () => ({
  consumeApplicationContact: jest.fn(async ({ jobRequestId }) => ({
    enabled: true,
    newlyConsumed: true,
    operationId: `job-request:${jobRequestId}`,
    usagePeriodId: 'usage-period',
  })),
  releaseContact: jest.fn(async (_consumption, actionExists) => actionExists()),
  V2EntitlementError: class V2EntitlementError extends Error {
    constructor(status, code, message) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Chat = require('../models/ChatMessage');
const JobRequest = require('../models/JobRequest');
const { notify } = require('../services/notifications');
const {
  consumeApplicationContact,
  releaseContact,
} = require('../services/subscriptions/v2Entitlements');
const orderController = require('../controllers/orderController');
let sessions;

const applicantId = new mongoose.Types.ObjectId();
const ownerId = new mongoose.Types.ObjectId();
const serviceId = new mongoose.Types.ObjectId();
const otherServiceId = new mongoose.Types.ObjectId();

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function request(service = serviceId) {
  return {
    userId: String(applicantId),
    body: { serviceId: String(service), message: 'Please contact me' },
  };
}

function application(data) {
  return {
    ...data,
    serviceId: { _id: data.serviceId, title: 'Painting', price: 12000 },
    customerId: { _id: data.customerId, name: 'Applicant' },
    populate: jest.fn(async function populate() { return this; }),
    toObject() { return { _id: this._id, serviceId: this.serviceId, customerId: this.customerId }; },
  };
}

function setup() {
  jest.clearAllMocks();
  sessions = [];
  jest.spyOn(mongoose, 'startSession').mockImplementation(async () => {
    const session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(async () => {}),
    };
    sessions.push(session);
    return session;
  });
  const service = {
    _id: serviceId,
    userId: ownerId,
    title: 'Painting',
    price: 12000,
    status: 'open',
  };
  Service.findById.mockResolvedValue(service);
  Order.findOne.mockResolvedValue(null);
  JobRequest.findOne.mockResolvedValue(null);
  JobRequest.exists.mockResolvedValue(false);
  JobRequest.create.mockImplementation(async ([data]) => [application(data)]);
  Chat.findOne.mockResolvedValue(null);
  Chat.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
  notify.mockResolvedValue(undefined);
  return service;
}

describe('contact usage is tied only to successful JobRequests', () => {
  beforeEach(() => setup());

  test('a successful first application consumes once using its actual JobRequest ID', async () => {
    const res = response();
    await orderController.createJobRequest(request(), res);

    expect(res.statusCode).toBe(201);
    const created = JobRequest.create.mock.calls[0][0][0];
    expect(consumeApplicationContact).toHaveBeenCalledWith({
      userId: String(applicantId),
      jobRequestId: created._id,
      servicePrice: 12000,
      serviceId: expect.anything(),
    }, { session: sessions[0] });
    expect(JobRequest.create).toHaveBeenCalledWith([expect.objectContaining({
      _id: created._id,
    })], { session: sessions[0] });
    expect(sessions[0].withTransaction).toHaveBeenCalledTimes(1);
    expect(sessions[0].endSession).toHaveBeenCalledTimes(1);
    expect(res.body._id).toEqual(created._id);
  });

  test('a different job application by the same applicant consumes a distinct contact', async () => {
    const secondService = { _id: otherServiceId, userId: ownerId, title: 'Other', price: 12000, status: 'open' };
    Service.findById.mockResolvedValueOnce({
      _id: serviceId, userId: ownerId, title: 'Painting', price: 12000, status: 'open',
    }).mockResolvedValueOnce(secondService);

    const first = response();
    await orderController.createJobRequest(request(serviceId), first);
    const second = response();
    await orderController.createJobRequest(request(otherServiceId), second);

    const firstRequestId = JobRequest.create.mock.calls[0][0][0]._id;
    const secondRequestId = JobRequest.create.mock.calls[1][0][0]._id;
    expect(firstRequestId).not.toEqual(secondRequestId);
    expect(consumeApplicationContact.mock.calls.map(([call]) => call.jobRequestId))
      .toEqual([firstRequestId, secondRequestId]);
  });

  test('invalid and duplicate pending applications consume nothing', async () => {
    const invalid = response();
    await orderController.createJobRequest({
      userId: String(applicantId),
      body: { serviceId: 'bad-id' },
    }, invalid);
    expect(invalid.statusCode).toBe(400);

    JobRequest.findOne.mockResolvedValueOnce({ _id: new mongoose.Types.ObjectId() });
    const duplicate = response();
    await orderController.createJobRequest(request(), duplicate);
    expect(duplicate.statusCode).toBe(400);
    expect(consumeApplicationContact).not.toHaveBeenCalled();
  });

  test('an interrupted transaction can retry without retaining an orphaned contact charge', async () => {
    const events = [];
    consumeApplicationContact.mockImplementationOnce(async () => {
      events.push('contact-reserved-in-transaction');
      return { newlyConsumed: true };
    });
    JobRequest.create.mockImplementationOnce(async () => {
      events.push('application-write-failed');
      throw new Error('write failed');
    });
    sessions = [];
    mongoose.startSession.mockImplementationOnce(async () => {
      const session = {
        withTransaction: jest.fn(async (callback) => {
          events.push('transaction-start');
          await callback();
        }),
        endSession: jest.fn(async () => {}),
      };
      sessions.push(session);
      return session;
    });
    const res = response();
    await orderController.createJobRequest(request(), res);

    expect(res.statusCode).toBe(503);
    expect(events).toEqual([
      'transaction-start',
      'contact-reserved-in-transaction',
      'application-write-failed',
    ]);
    expect(releaseContact).not.toHaveBeenCalled();
    expect(Chat.create).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
    expect(sessions[0].endSession).toHaveBeenCalledTimes(1);

    const retry = response();
    await orderController.createJobRequest(request(), retry);

    expect(retry.statusCode).toBe(201);
    expect(sessions).toHaveLength(2);
    expect(sessions[1].withTransaction).toHaveBeenCalledTimes(1);
  });

  test('concurrent duplicate submissions persist one application in separate transactions', async () => {
    const persisted = new Set();
    JobRequest.create.mockImplementation(async ([data]) => {
      const key = `${data.serviceId}:${data.customerId}`;
      if ([...persisted].some((entry) => entry.key === key)) {
        const error = new Error('duplicate pending application');
        error.code = 11000;
        throw error;
      }
      persisted.add({ key, id: data._id });
      return [application(data)];
    });
    JobRequest.exists.mockImplementation(async ({ _id }) =>
      [...persisted].some((entry) => String(entry.id) === String(_id))
    );

    const results = await Promise.all([request(), request()].map(async (req) => {
      const res = response();
      await orderController.createJobRequest(req, res);
      return res;
    }));

    expect(results.map((res) => res.statusCode).sort()).toEqual([201, 400]);
    expect(JobRequest.create).toHaveBeenCalledTimes(2);
    expect(consumeApplicationContact).toHaveBeenCalledTimes(2);
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => session.withTransaction.mock.calls.length === 1)).toBe(true);
    expect(persisted.size).toBe(1);
  });

  test('a durable application remains charged if notification fails and retry cannot charge again', async () => {
    const saved = application({
      _id: new mongoose.Types.ObjectId(),
      serviceId,
      customerId: applicantId,
      providerId: ownerId,
    });
    JobRequest.create.mockResolvedValueOnce([saved]);
    notify.mockRejectedValueOnce(new Error('notification failed'));

    const first = response();
    await orderController.createJobRequest(request(), first);
    expect(first.statusCode).toBe(500);
    expect(releaseContact).not.toHaveBeenCalled();

    JobRequest.findOne.mockResolvedValueOnce(saved);
    const retry = response();
    await orderController.createJobRequest(request(), retry);
    expect(retry.statusCode).toBe(400);
    expect(consumeApplicationContact).toHaveBeenCalledTimes(1);
  });

  test('a legacy entitlement result keeps the application flow available', async () => {
    consumeApplicationContact.mockResolvedValueOnce({
      enabled: false,
      newlyConsumed: false,
    });
    const res = response();
    await orderController.createJobRequest(request(), res);
    expect(res.statusCode).toBe(201);
    expect(consumeApplicationContact).toHaveBeenCalledTimes(1);
  });

  test('an entitlement preflight failure creates no request, chat or notification', async () => {
    const error = new (require('../services/subscriptions/v2Entitlements').V2EntitlementError)(
      503,
      'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED',
      'Subscription entitlements are unavailable.'
    );
    consumeApplicationContact.mockRejectedValueOnce(error);

    const res = response();
    await orderController.createJobRequest(request(), res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      code: 'SUBSCRIPTION_V2_ENTITLEMENTS_DISABLED',
      message: 'Subscription entitlements are unavailable.',
    });
    expect(JobRequest.create).not.toHaveBeenCalled();
    expect(Chat.create).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  test.each(['accepted', 'declined'])('owner %s does not consume another contact', async (status) => {
    const jobRequest = {
      _id: new mongoose.Types.ObjectId(),
      customerId: applicantId,
      providerId: ownerId,
      serviceId,
      status: 'pending',
      save: jest.fn(async function save() { return this; }),
      populate: jest.fn(async function populate() {
        this.serviceId = { _id: serviceId, title: 'Painting' };
        return this;
      }),
    };
    JobRequest.findById.mockResolvedValue(jobRequest);
    Chat.findOne.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });

    const res = response();
    await orderController.updateJobRequestStatus({
      userId: String(ownerId),
      params: { id: String(jobRequest._id) },
      body: { status },
    }, res);

    expect(jobRequest.status).toBe(status);
    expect(consumeApplicationContact).not.toHaveBeenCalled();
  });
});
