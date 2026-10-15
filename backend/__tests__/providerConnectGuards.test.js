jest.mock('../models/Order', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../models/Service', () => ({ findById: jest.fn() }));
jest.mock('../models/JobRequest', () => ({ findOne: jest.fn(), create: jest.fn() }));
jest.mock('../models/User', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Dispute', () => ({ findOne: jest.fn() }));
jest.mock('../models/ChatMessage', () => ({ findById: jest.fn() }));
jest.mock('../services/notifications', () => ({ notify: jest.fn(), emitToUser: jest.fn() }));
jest.mock('../services/stripeConnectReadiness', () => ({
  getConnectReadiness: jest.fn().mockResolvedValue({ ready: false }),
  sendConnectReadinessFailure: jest.fn((res) =>
    res.status(403).json({ code: 'STRIPE_CONNECT_REQUIRED' })
  ),
}));

const Order = require('../models/Order');
const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const User = require('../models/User');
const orderController = require('../controllers/orderController');
const providerWorkController = require('../controllers/providerWorkController');
const Dispute = require('../models/Dispute');
const { getConnectReadiness } = require('../services/stripeConnectReadiness');
const { ensureProviderConnectReady } = require('../middleware/requireProviderConnect');

function makeRes() {
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
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getConnectReadiness.mockResolvedValue({ ready: false });
  Order.findOne.mockResolvedValue(null);
  Service.findById.mockResolvedValue({
    _id: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439012',
    status: 'open',
  });
  JobRequest.findOne.mockResolvedValue(null);
});

it('rejects an applicant before creating a request or consuming contact usage', async () => {
  const res = makeRes();
  await orderController.createJobRequest(
    {
      userId: '507f1f77bcf86cd799439013',
      body: { serviceId: '507f1f77bcf86cd799439011', message: 'I can do it' },
    },
    res
  );

  expect(res.statusCode).toBe(403);
  expect(res.body.code).toBe('STRIPE_CONNECT_REQUIRED');
  expect(JobRequest.create).not.toHaveBeenCalled();
  expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
});

it('rejects starting work before changing the order when Connect is not ready', async () => {
  const workerId = '507f1f77bcf86cd799439013';
  Order.findById.mockResolvedValue({
    _id: '507f1f77bcf86cd799439014',
    providerId: workerId,
    customerId: '507f1f77bcf86cd799439015',
    status: 'paid',
    paymentStatus: 'paid',
  });
  Dispute.findOne.mockResolvedValue(null);
  const res = makeRes();

  await providerWorkController.startJob(
    { userId: workerId, params: { orderId: '507f1f77bcf86cd799439014' } },
    res
  );

  expect(res.statusCode).toBe(403);
  expect(res.body.code).toBe('STRIPE_CONNECT_REQUIRED');
  expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
});

it('returns a support-directed conflict when the saved account is missing in the selected mode', async () => {
  getConnectReadiness.mockRejectedValue(
    Object.assign(new Error('No such account'), {
      code: 'STRIPE_CONNECT_ACCOUNT_NOT_FOUND',
    })
  );
  const res = makeRes();

  await expect(ensureProviderConnectReady({}, res, 'provider-id')).resolves.toBe(false);
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('STRIPE_CONNECT_ACCOUNT_NOT_FOUND');
  expect(res.body.error).toContain('Kontakt kundestøtte');
});
