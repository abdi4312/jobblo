/**
 * Awarding a job is the service owner's decision.
 *
 * The chat contract endpoint only checked that the caller was a participant in the
 * conversation. In an owner-initiated chat the applicant sits in `chat.providerId`,
 * so the applicant could award themselves the contract — at a price taken from their
 * own request body.
 */

jest.mock('../models/ChatMessage', () => ({ findById: jest.fn() }));
jest.mock('../models/Order', () => ({ findOne: jest.fn(), findById: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/Service', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Dispute', () => ({ findOne: jest.fn() }));
jest.mock('../config/stripe', () => ({ getStripe: jest.fn() }));
jest.mock('../services/stripe/customers', () => ({ resolveStripeCustomer: jest.fn() }));

const mongoose = require('mongoose');
const Chat = require('../models/ChatMessage');
const Order = require('../models/Order');
const Dispute = require('../models/Dispute');
const chatController = require('../controllers/chatController');

const OWNER_ID = new mongoose.Types.ObjectId();
const APPLICANT_ID = new mongoose.Types.ObjectId();
const SERVICE_ID = new mongoose.Types.ObjectId();
const CHAT_ID = new mongoose.Types.ObjectId();

/** Owner-initiated chat: clientId = owner, providerId = applicant. */
function ownerInitiatedChat(overrides = {}) {
  return {
    _id: CHAT_ID,
    clientId: { _id: OWNER_ID },
    providerId: { _id: APPLICANT_ID },
    serviceId: {
      _id: SERVICE_ID,
      userId: OWNER_ID, // the owner owns the listing
      price: 1000,
      checklist: [],
    },
    orderId: null,
    agreedPrice: 1000,
    messages: [],
    save: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

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
    end() {
      return this;
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Order.findOne.mockResolvedValue(null);
  Dispute.findOne.mockResolvedValue(null);
});

describe('createContract authorization', () => {
  it('refuses when the caller is the APPLICANT, not the service owner', async () => {
    Chat.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(ownerInitiatedChat()),
    });

    const req = {
      user: { id: String(APPLICANT_ID) },
      params: { chatId: String(CHAT_ID) },
      body: { agreedPrice: 99999 }, // and at a price of their choosing
    };
    const res = makeRes();

    await chatController.createContract(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/oppdragsgiveren/i);
  });

  it('refuses a chat participant who owns neither side of the listing', async () => {
    const stranger = new mongoose.Types.ObjectId();
    Chat.findById.mockReturnValue({
      populate: jest
        .fn()
        .mockResolvedValue(ownerInitiatedChat({ providerId: { _id: stranger } })),
    });

    const req = {
      user: { id: String(stranger) },
      params: { chatId: String(CHAT_ID) },
      body: {},
    };
    const res = makeRes();

    await chatController.createContract(req, res);

    expect(res.statusCode).toBe(403);
  });

  it('refuses when a contract-bearing order already exists for the service', async () => {
    Chat.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(ownerInitiatedChat()),
    });
    Order.findOne.mockResolvedValue({ _id: 'existing_order' });

    const req = {
      user: { id: String(OWNER_ID) },
      params: { chatId: String(CHAT_ID) },
      body: {},
    };
    const res = makeRes();

    await chatController.createContract(req, res);

    expect(res.statusCode).toBe(400);
    // Only genuinely blocking statuses count — a stray `pending` order must not
    // brick the listing.
    expect(Order.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        status: {
          $in: ['awaiting_payment', 'paid', 'in_progress', 'ready_for_review', 'disputed', 'completed'],
        },
      })
    );
  });
});

describe('deleteChat protects dispute evidence', () => {
  function chatWithOrder(orderId) {
    return {
      _id: CHAT_ID,
      clientId: OWNER_ID,
      providerId: APPLICANT_ID,
      orderId,
    };
  }

  it('refuses to delete a conversation attached to a paid order', async () => {
    Chat.findById.mockResolvedValue(chatWithOrder('order_1'));
    Order.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ status: 'ready_for_review', paymentStatus: 'paid' }),
      }),
    });

    const req = { user: { id: String(APPLICANT_ID) }, params: { chatId: String(CHAT_ID) } };
    const res = makeRes();

    await chatController.deleteChat(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('chat_locked_by_order');
  });

  it('refuses to delete a conversation with an active dispute', async () => {
    Chat.findById.mockResolvedValue(chatWithOrder('order_1'));
    Order.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ status: 'completed', paymentStatus: 'unpaid' }),
      }),
    });
    Dispute.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: 'd1' }) });

    const req = { user: { id: String(APPLICANT_ID) }, params: { chatId: String(CHAT_ID) } };
    const res = makeRes();

    await chatController.deleteChat(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('chat_locked_by_dispute');
  });

  it('still allows deleting a chat with no order attached', async () => {
    Chat.findById.mockResolvedValue(chatWithOrder(null));
    Chat.findByIdAndDelete = jest.fn().mockResolvedValue({});

    const req = { user: { id: String(OWNER_ID) }, params: { chatId: String(CHAT_ID) } };
    const res = makeRes();

    await chatController.deleteChat(req, res);

    expect(Chat.findByIdAndDelete).toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
  });
});
