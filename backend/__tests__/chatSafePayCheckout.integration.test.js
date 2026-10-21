jest.mock('../models/ChatMessage', () => ({ findById: jest.fn() }));
jest.mock('../models/Order', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/Service', () => ({ findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Payment', () => ({ findOne: jest.fn() }));
jest.mock('../models/StripePaymentIncident', () => ({ findOne: jest.fn() }));
jest.mock('../services/stripe/customers', () => ({ resolveStripeCustomer: jest.fn() }));
jest.mock('../services/stripe/webhookReadiness', () => ({
  getStripeWebhookReadiness: jest.fn(),
}));
jest.mock('../config/stripe', () => ({
  getStripeConfiguration: jest.fn(),
  getStripeForMode: jest.fn(),
}));
jest.mock('../services/notifications', () => ({
  notify: jest.fn(),
  emitToUser: jest.fn(),
}));
jest.mock('../controllers/chatReportController', () => ({
  submitChatReport: jest.fn(),
  getMyChatReports: jest.fn(),
  reportSubmitLimiter: (_req, _res, next) => next(),
}));
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    const id = req.get('x-test-user');
    if (!id) return res.status(401).json({ code: 'TOKEN_MISSING' });
    req.user = { id };
    req.userId = id;
    return next();
  },
}));

const express = require('express');
const request = require('supertest');
const Chat = require('../models/ChatMessage');
const Order = require('../models/Order');
const User = require('../models/User');
const StripePaymentIncident = require('../models/StripePaymentIncident');
const { getStripeConfiguration, getStripeForMode } = require('../config/stripe');
const { getStripeWebhookReadiness } = require('../services/stripe/webhookReadiness');
const { resolveStripeCustomer } = require('../services/stripe/customers');
const router = require('../routes/chat');

const CUSTOMER = '507f1f77bcf86cd799439011';
const PROVIDER = '507f1f77bcf86cd799439012';
const CHAT_ID = '507f1f77bcf86cd799439013';
const ORDER_ID = '507f1f77bcf86cd799439014';
const SERVICE_ID = '507f1f77bcf86cd799439015';
let stripeFixture;

const orderBase = () => ({
  _id: ORDER_ID,
  customerId: CUSTOMER,
  providerId: PROVIDER,
  status: 'awaiting_payment',
  paymentStatus: 'unpaid',
  agreedPrice: 1000,
  checkoutSessionId: null,
  checkoutSessionStatus: null,
  serviceId: { _id: SERVICE_ID, title: 'Design mockup' },
});

function queryFor(value) {
  const query = {
    populate: jest.fn(() => query),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
    catch: (reject) => Promise.resolve(value).catch(reject),
  };
  return query;
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/chats', router);
  return app;
}

const app = makeApp();

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = 'https://example.com';

  const order = orderBase();
  const chat = {
    _id: CHAT_ID,
    clientId: { _id: CUSTOMER },
    providerId: { _id: PROVIDER },
    orderId: { _id: ORDER_ID },
  };
  Chat.findById.mockReturnValue(queryFor(chat));
  Order.findById.mockReturnValue({
    populate: jest.fn().mockResolvedValue(order),
  });
  Order.findOneAndUpdate.mockImplementation(async (_filter, update) => ({
    ...order,
    ...update.$set,
  }));
  StripePaymentIncident.findOne.mockReturnValue({
    select: jest.fn().mockResolvedValue(null),
  });
  User.findById.mockResolvedValue({ _id: CUSTOMER, email: 'customer@example.test' });
  resolveStripeCustomer.mockResolvedValue('cus_test_customer');
  getStripeConfiguration.mockResolvedValue({
    testMode: true,
    mode: 'test',
    secretKey: 'sk_test_fixture',
    webhookSecret: 'whsec_fixture',
    keyModeValid: true,
    webhookSecretValid: true,
  });
  getStripeWebhookReadiness.mockResolvedValue({ ready: true });
  stripeFixture = {
    checkout: {
      sessions: {
        retrieve: jest.fn(),
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_chat_checkout',
          status: 'open',
          url: 'https://checkout.stripe.com/test',
        }),
      },
    },
  };
  getStripeForMode.mockResolvedValue(stripeFixture);
});

describe('POST /api/chats/:chatId/payments SafePay integration', () => {
  it('requires authentication before reaching chat checkout', async () => {
    const response = await request(app).post(`/api/chats/${CHAT_ID}/payments`);

    expect(response.status).toBe(401);
    expect(Chat.findById).not.toHaveBeenCalled();
  });

  it('rejects a participant who is not the order customer', async () => {
    const response = await request(app)
      .post(`/api/chats/${CHAT_ID}/payments`)
      .set('x-test-user', PROVIDER);

    expect(response.status).toBe(403);
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
    expect(stripeFixture.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it.each([
    ['already paid', { paymentStatus: 'paid' }],
    ['in progress', { status: 'in_progress' }],
    ['completed', { status: 'completed' }],
  ])('does not check out an order that is %s', async (_name, overrides) => {
    Order.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue({ ...orderBase(), ...overrides }),
    });

    const response = await request(app)
      .post(`/api/chats/${CHAT_ID}/payments`)
      .set('x-test-user', CUSTOMER);

    expect(response.status).toBe(409);
    expect(Order.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('persists one canonical TEST checkout using the order snapshot, not client input', async () => {
    const stripe = stripeFixture;

    const response = await request(app)
      .post(`/api/chats/${CHAT_ID}/payments`)
      .set('x-test-user', CUSTOMER)
      .send({ orderId: '507f1f77bcf86cd799439099', platform: 'mobile' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ url: 'https://checkout.stripe.com/test' });
    expect(getStripeForMode).toHaveBeenCalledWith(true);
    expect(resolveStripeCustomer).toHaveBeenCalledWith(stripe, expect.any(Object), true);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_test_customer',
        mode: 'payment',
        metadata: expect.objectContaining({
          orderId: ORDER_ID,
          userId: CUSTOMER,
          stripeMode: 'test',
        }),
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'nok',
              unit_amount: 103000,
            }),
          }),
        ],
      }),
      { idempotencyKey: expect.stringMatching(`^safepay:${ORDER_ID}:`) }
    );
    expect(Order.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(Order.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({
      checkoutSessionStatus: 'pending',
      checkoutAmountMinor: 103000,
      checkoutCurrency: 'nok',
      checkoutMode: 'test',
      checkoutCustomerId: 'cus_test_customer',
    });
    expect(Order.findOneAndUpdate.mock.calls[1][1].$set).toMatchObject({
      checkoutSessionId: 'cs_test_chat_checkout',
      checkoutSessionStatus: 'open',
    });
  });

  it('admits only one payable session for concurrent chat checkout requests', async () => {
    let reservationTaken = false;
    Order.findOneAndUpdate.mockImplementation(async (_filter, update) => {
      if (update.$set.checkoutSessionStatus === 'pending') {
        if (reservationTaken) return null;
        reservationTaken = true;
      }
      return { ...orderBase(), ...update.$set };
    });

    const checkout = () =>
      request(app)
        .post(`/api/chats/${CHAT_ID}/payments`)
        .set('x-test-user', CUSTOMER);
    const responses = await Promise.all([checkout(), checkout()]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(stripeFixture.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(Order.findOneAndUpdate).toHaveBeenCalledTimes(3);
  });
});
