/**
 * Guards on the two chat endpoints that touch money, plus message hygiene.
 *
 * The price and the payment button both sit inside the conversation, and both were
 * open in ways that let the wrong person act, or let the agreed number drift away
 * from the order the escrow is calculated from.
 */

jest.mock('../models/ChatMessage', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));
jest.mock('../models/Order', () => {
  const Order = jest.fn(function (doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
  });
  Order.findOne = jest.fn();
  Order.findById = jest.fn();
  Order.findByIdAndUpdate = jest.fn();
  return Order;
});
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/Service', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Dispute', () => ({ findOne: jest.fn() }));
jest.mock('../models/ChatReport', () => ({ findOne: jest.fn() }));
jest.mock('../config/stripe', () => ({ getStripe: jest.fn() }));
jest.mock('../services/stripe/customers', () => ({ resolveStripeCustomer: jest.fn() }));

const mongoose = require('mongoose');
const Chat = require('../models/ChatMessage');
const User = require('../models/User');
const { getStripe } = require('../config/stripe');
const { resolveStripeCustomer } = require('../services/stripe/customers');
const chatController = require('../controllers/chatController');

const OWNER = new mongoose.Types.ObjectId();
const WORKER = new mongoose.Types.ObjectId();
const SERVICE = new mongoose.Types.ObjectId();
const CHAT = new mongoose.Types.ObjectId();
const ORDER = new mongoose.Types.ObjectId();

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

function populateChain(value) {
  const chain = {};
  chain.populate = jest.fn(() => chain);
  chain.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(value).catch(reject);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateAgreedPrice', () => {
  function chatDoc(overrides = {}) {
    return {
      _id: CHAT,
      clientId: WORKER,
      providerId: OWNER,
      orderId: null,
      status: 'requested',
      messages: [],
      save: jest.fn().mockResolvedValue(),
      ...overrides,
    };
  }

  it('refuses to change the price once a contract exists', async () => {
    // The escrow amount comes from the order; the payment endpoint prefers the chat
    // value. Letting these diverge meant agreeing 5000, setting the chat to 3, paying
    // 3 kr, and still having the 5000 kr order marked fully paid.
    Chat.findById.mockResolvedValue(chatDoc({ orderId: ORDER }));

    const res = makeRes();
    await chatController.updateAgreedPrice(
      { user: { id: String(OWNER) }, params: { chatId: String(CHAT) }, body: { agreedPrice: 3 } },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('price_locked_by_contract');
  });

  it.each([
    ['zero', 0],
    ['negative', -100],
    ['not a number', 'gratis'],
    ['infinite', Infinity],
  ])('rejects %s', async (_label, agreedPrice) => {
    Chat.findById.mockResolvedValue(chatDoc());

    const res = makeRes();
    await chatController.updateAgreedPrice(
      { user: { id: String(OWNER) }, params: { chatId: String(CHAT) }, body: { agreedPrice } },
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('rejects a price above the ceiling that would overflow Stripe', async () => {
    Chat.findById.mockResolvedValue(chatDoc());

    const res = makeRes();
    await chatController.updateAgreedPrice(
      {
        user: { id: String(OWNER) },
        params: { chatId: String(CHAT) },
        body: { agreedPrice: 1e12 },
      },
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('does not drag a live job back to "agreed"', async () => {
    const chat = chatDoc({ status: 'in_progress' });
    Chat.findById.mockResolvedValue(chat);
    Chat.findById.mockResolvedValueOnce(chat);

    await chatController.updateAgreedPrice(
      {
        user: { id: String(OWNER) },
        params: { chatId: String(CHAT) },
        body: { agreedPrice: 1200 },
      },
      makeRes()
    );

    expect(chat.status).toBe('in_progress');
    expect(chat.agreedPrice).toBe(1200);
  });

  it('refuses a non-participant', async () => {
    Chat.findById.mockResolvedValue(chatDoc());

    const res = makeRes();
    await chatController.updateAgreedPrice(
      {
        user: { id: String(new mongoose.Types.ObjectId()) },
        params: { chatId: String(CHAT) },
        body: { agreedPrice: 500 },
      },
      res
    );

    expect(res.statusCode).toBe(403);
  });
});

describe('createPaymentSession', () => {
  function chatWithOrder(order) {
    return {
      _id: CHAT,
      clientId: { _id: WORKER },
      providerId: { _id: OWNER },
      serviceId: { _id: SERVICE, title: 'Maling', price: 1000 },
      orderId: order,
      agreedPrice: 1000,
    };
  }

  const payableOrder = {
    _id: ORDER,
    customerId: OWNER,
    providerId: WORKER,
    status: 'awaiting_payment',
    paymentStatus: 'unpaid',
    agreedPrice: 1000,
  };

  beforeEach(() => {
    User.findById.mockResolvedValue({ _id: OWNER, email: 'o@x.no', name: 'Owner' });
    resolveStripeCustomer.mockResolvedValue('cus_1');
    getStripe.mockResolvedValue({
      checkout: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://stripe/x' }) } },
    });
  });

  it('refuses the WORKER — only the payer may open a checkout', async () => {
    // The worker is a participant, so the old participant-only check let them start a
    // session. metadata.userId then carried their id, confirmPaidSession rejected it
    // as a customer mismatch, and the charge sat at Stripe unrecorded and unrefunded.
    Chat.findById.mockReturnValue(populateChain(chatWithOrder(payableOrder)));

    const res = makeRes();
    await chatController.createPaymentSession(
      { user: { id: String(WORKER) }, params: { chatId: String(CHAT) } },
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('not_the_payer');
  });

  it.each([
    ['already paid', { ...payableOrder, paymentStatus: 'paid' }],
    ['in progress', { ...payableOrder, status: 'in_progress' }],
    ['completed', { ...payableOrder, status: 'completed' }],
  ])('refuses to open a second checkout when the order is %s', async (_label, order) => {
    Chat.findById.mockReturnValue(populateChain(chatWithOrder(order)));

    const res = makeRes();
    await chatController.createPaymentSession(
      { user: { id: String(OWNER) }, params: { chatId: String(CHAT) } },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('order_not_payable');
  });

  it('lets the owner pay a payable order', async () => {
    Chat.findById.mockReturnValue(populateChain(chatWithOrder(payableOrder)));

    const res = makeRes();
    await chatController.createPaymentSession(
      { user: { id: String(OWNER) }, params: { chatId: String(CHAT) } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.url).toBe('https://stripe/x');
  });
});

describe('sendMessage hygiene', () => {
  function chatDoc() {
    return {
      _id: CHAT,
      clientId: { _id: WORKER, toString: () => String(WORKER) },
      providerId: { _id: OWNER, toString: () => String(OWNER) },
      messages: [],
      deletedFor: [String(OWNER)],
      save: jest.fn().mockResolvedValue(),
    };
  }

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('rejects a %s message instead of storing undefined', async (_label, text) => {
    Chat.findById.mockResolvedValue(chatDoc());

    const res = makeRes();
    await chatController.sendMessage(
      { user: { id: String(OWNER) }, params: { chatId: String(CHAT) }, body: { text }, app: { get: () => null } },
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('rejects an oversized message that could push the document past the 16 MB limit', async () => {
    Chat.findById.mockResolvedValue(chatDoc());

    const res = makeRes();
    await chatController.sendMessage(
      {
        user: { id: String(OWNER) },
        params: { chatId: String(CHAT) },
        body: { text: 'a'.repeat(50000) },
        app: { get: () => null },
      },
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('un-hides the conversation for someone who had deleted it', async () => {
    const chat = chatDoc();
    Chat.findById.mockResolvedValue(chat);

    await chatController.sendMessage(
      {
        user: { id: String(WORKER) },
        params: { chatId: String(CHAT) },
        body: { text: 'Hei, er du der?' },
        app: { get: () => null },
      },
      makeRes()
    );

    // Otherwise the reply lands in an inbox the recipient can no longer see, forever.
    expect(chat.deletedFor).toEqual([]);
    expect(chat.messages).toHaveLength(1);
    expect(chat.messages[0].text).toBe('Hei, er du der?');
  });
});

describe('deleteForMe authorization', () => {
  it('refuses a stranger appending themselves to a chat they are not in', async () => {
    Chat.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: CHAT, clientId: WORKER, providerId: OWNER }),
    });

    const res = makeRes();
    await chatController.deleteForMe(
      { user: { id: String(new mongoose.Types.ObjectId()) }, params: { chatId: String(CHAT) } },
      res
    );

    expect(res.statusCode).toBe(403);
    expect(Chat.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('lets a participant hide their own copy', async () => {
    Chat.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: CHAT, clientId: WORKER, providerId: OWNER }),
    });
    Chat.findByIdAndUpdate.mockResolvedValue({});

    const res = makeRes();
    await chatController.deleteForMe(
      { user: { id: String(OWNER) }, params: { chatId: String(CHAT) } },
      res
    );

    expect(res.body.success).toBe(true);
    expect(Chat.findByIdAndUpdate).toHaveBeenCalled();
  });
});
