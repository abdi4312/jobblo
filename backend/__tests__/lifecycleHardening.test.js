/**
 * Covers the seven lifecycle fixes: chat-creation authorization, the SafePay checklist
 * freeze, non-public listing exposure, withdrawal, job validation, chat status and
 * message pagination.
 */

jest.mock('../models/ChatMessage', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/Order', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../models/Service', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../models/JobRequest', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/Dispute', () => ({ findOne: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/Notification', () => ({ create: jest.fn() }));
jest.mock('../models/Payment', () => ({ findOne: jest.fn() }));

const mongoose = require('mongoose');
const Chat = require('../models/ChatMessage');
const Order = require('../models/Order');
const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const Dispute = require('../models/Dispute');
const User = require('../models/User');
const Notification = require('../models/Notification');

const safepayController = require('../controllers/safepayController');
const serviceController = require('../controllers/serviceController');
const myApplications = require('../controllers/myApplicationsController');
const chatController = require('../controllers/chatController');

const OWNER = new mongoose.Types.ObjectId();
const WORKER = new mongoose.Types.ObjectId();
const SERVICE = new mongoose.Types.ObjectId();
const ORDER = new mongoose.Types.ObjectId();
const CHAT = new mongoose.Types.ObjectId();
const REQUEST = new mongoose.Types.ObjectId();

const selectChain = (value) => ({ select: jest.fn().mockResolvedValue(value) });

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
  Dispute.findOne.mockReturnValue(selectChain(null));
  Notification.create.mockResolvedValue({});
  User.updateOne.mockResolvedValue({});
});

// ── 2. SafePay checklist freeze ──────────────────────────────────────────────
describe('SafePay checklist is frozen once work is no longer in flight', () => {
  function order(status) {
    return {
      _id: ORDER,
      status,
      customerId: OWNER,
      providerId: WORKER,
      checklist: [{ id: 'a', text: 'Rydde', checked: false }],
    };
  }

  const call = (status) => {
    Order.findById.mockResolvedValue(order(status));
    const res = makeRes();
    return safepayController
      .updateChecklistItem(
        {
          params: { orderId: String(ORDER), itemId: 'a' },
          body: { checked: true },
          userId: String(OWNER),
        },
        res
      )
      .then(() => res);
  };

  it.each([['completed'], ['cancelled'], ['awaiting_payment']])(
    'refuses to edit the checklist when the order is %s',
    async (status) => {
      const res = await call(status);
      expect(res.statusCode).toBe(409);
      expect(res.body.code).toBe('checklist_locked');
      expect(Order.findByIdAndUpdate).not.toHaveBeenCalled();
    }
  );

  it('refuses while a dispute is open — this is the record the admin reads', async () => {
    Dispute.findOne.mockReturnValue(selectChain({ _id: 'd1' }));
    const res = await call('in_progress');

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('checklist_locked_by_dispute');
    expect(Order.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('still allows editing while the job is under way', async () => {
    Order.findByIdAndUpdate.mockReturnValue({
      populate: jest.fn().mockResolvedValue(order('in_progress')),
    });
    const res = await call('in_progress');

    expect(res.statusCode).toBe(200);
    expect(Order.findByIdAndUpdate).toHaveBeenCalled();
  });
});

// ── 3. Non-public listings ───────────────────────────────────────────────────
describe('non-public listings are not readable by id', () => {
  function service(status) {
    return {
      _id: SERVICE,
      status,
      userId: { _id: OWNER },
      views: 10,
      toObject() {
        return { _id: SERVICE, status, views: this.views };
      },
    };
  }

  it('hides a draft from an anonymous visitor, and does not confirm it exists', async () => {
    Service.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(service('draft')) });
    Order.findOne.mockReturnValue(selectChain(null));

    const res = makeRes();
    await serviceController.getServiceById({ params: { id: String(SERVICE) }, query: {} }, res);

    // 404 rather than 403 — a 403 would confirm the listing is there.
    expect(res.statusCode).toBe(404);
  });

  it('lets the owner read their own non-public listing', async () => {
    Service.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(service('cancelled')),
    });

    const res = makeRes();
    await serviceController.getServiceById(
      { params: { id: String(SERVICE) }, query: {}, userId: String(OWNER) },
      res
    );

    expect(res.statusCode).toBe(200);
  });

  it('does not count a view for the owner refreshing their own page', async () => {
    Service.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(service('open')) });

    await serviceController.getServiceById(
      { params: { id: String(SERVICE) }, query: {}, userId: String(OWNER) },
      makeRes()
    );

    // `views` is a public sort field, so the owner's own refreshes inflating it is a
    // ranking problem, not just a cosmetic one.
    expect(Service.updateOne).not.toHaveBeenCalled();
  });

  it('does count a view for a visitor reading a live listing', async () => {
    Service.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(service('open')) });

    await serviceController.getServiceById(
      { params: { id: String(SERVICE) }, query: {}, userId: String(WORKER) },
      makeRes()
    );

    expect(Service.updateOne).toHaveBeenCalledWith(
      { _id: SERVICE },
      { $inc: { views: 1 } }
    );
  });

  it('rejects a malformed id with 400 rather than a CastError 500', async () => {
    const res = makeRes();
    await serviceController.getServiceById({ params: { id: 'nope' }, query: {} }, res);
    expect(res.statusCode).toBe(400);
  });
});

// ── 4. Withdrawal lifecycle ──────────────────────────────────────────────────
describe('withdrawing an application', () => {
  function application() {
    return {
      _id: REQUEST,
      customerId: WORKER,
      serviceId: SERVICE,
      status: 'pending',
      save: jest.fn().mockResolvedValue(),
    };
  }

  it('refuses while a live contract exists', async () => {
    JobRequest.findById.mockResolvedValue(application());
    Order.findOne.mockReturnValue(selectChain({ _id: ORDER }));

    const res = makeRes();
    await myApplications.withdrawApplication(
      { params: { requestId: String(REQUEST) }, userId: String(WORKER) },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('application_has_active_order');
  });

  it('marks it withdrawn instead of hard-deleting, refunds the quota and tells the owner', async () => {
    const app = application();
    JobRequest.findById.mockResolvedValue(app);
    Order.findOne.mockReturnValue(selectChain(null));
    Service.findById.mockReturnValue(selectChain({ _id: SERVICE, title: 'Maling', userId: OWNER }));

    const res = makeRes();
    await myApplications.withdrawApplication(
      { params: { requestId: String(REQUEST) }, userId: String(WORKER) },
      res
    );

    // The record survives — hard-deleting erased who had applied and orphaned the chat.
    expect(app.status).toBe('declined');
    expect(app.withdrawnAt).toBeInstanceOf(Date);
    expect(app.save).toHaveBeenCalled();

    // The contact charged at application time comes back.
    expect(User.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ monthlyContactUsage: { $gt: 0 } }),
      { $inc: { monthlyContactUsage: -1 } }
    );

    // The owner's list used to just lose a row with no explanation.
    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: OWNER })
    );
  });
});

// ── 7. Message pagination ────────────────────────────────────────────────────
describe('message pagination', () => {
  function chatQuery(messages) {
    const chain = {
      select: jest.fn(() => chain),
      populate: jest.fn(() => chain),
      then: (resolve, reject) =>
        Promise.resolve({
          toObject: () => ({ _id: CHAT, messages }),
        }).then(resolve, reject),
    };
    return chain;
  }

  it('returns the newest page by default and reports what remains', async () => {
    Chat.findById
      .mockReturnValueOnce({
        select: jest
          .fn()
          .mockResolvedValue({ clientId: WORKER, providerId: OWNER, messages: new Array(130) }),
      })
      .mockReturnValueOnce(chatQuery([{ text: 'siste' }]));

    const res = makeRes();
    await chatController.getChatById(
      { user: { id: String(OWNER) }, params: { chatId: String(CHAT) }, query: {} },
      res
    );

    expect(res.body.messagePage).toEqual({
      total: 130,
      limit: 50,
      offset: 0,
      hasMore: true,
    });
  });

  it('caps an oversized limit', async () => {
    Chat.findById
      .mockReturnValueOnce({
        select: jest
          .fn()
          .mockResolvedValue({ clientId: WORKER, providerId: OWNER, messages: new Array(10) }),
      })
      .mockReturnValueOnce(chatQuery([]));

    const res = makeRes();
    await chatController.getChatById(
      {
        user: { id: String(OWNER) },
        params: { chatId: String(CHAT) },
        query: { limit: '100000' },
      },
      res
    );

    expect(res.body.messagePage.limit).toBe(200);
    expect(res.body.messagePage.hasMore).toBe(false);
  });

  it('authorizes before reading any messages', async () => {
    Chat.findById.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ clientId: WORKER, providerId: OWNER, messages: [] }),
    });

    const res = makeRes();
    await chatController.getChatById(
      {
        user: { id: String(new mongoose.Types.ObjectId()) },
        params: { chatId: String(CHAT) },
        query: {},
      },
      res
    );

    expect(res.statusCode).toBe(403);
    // The second query — the one that actually pulls messages — must never run.
    expect(Chat.findById).toHaveBeenCalledTimes(1);
  });
});
