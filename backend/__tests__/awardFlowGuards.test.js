/**
 * The award path — POST /api/safepay/create-contract.
 *
 * Two defects: a DECLINED application could still be awarded (and the award flipped it
 * back to accepted), and the chat lookup used one specific slot arrangement, so on the
 * normal flow — applicant applies, owner awards — it matched nothing. Order.chatId was
 * never set, and because startJob and markReadyForReview both guard on `if (chatId)`,
 * the entire conversation timeline went silent the moment a job was awarded.
 */

jest.mock('../models/Order', () => {
  const realMongoose = require('mongoose');
  const Order = jest.fn(function (doc) {
    Object.assign(this, doc);
    // Mongoose assigns _id at construction; the controller reads order._id straight
    // after save() to link the chat, so the stub has to do the same.
    this._id = new realMongoose.Types.ObjectId();
    this.save = jest.fn().mockResolvedValue(this);
  });
  Order.findOne = jest.fn();
  Order.findById = jest.fn();
  Order.findByIdAndUpdate = jest.fn();
  return Order;
});
jest.mock('../models/Service', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/JobRequest', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
}));
jest.mock('../models/ChatMessage', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../models/Notification', () => ({ create: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));

const mongoose = require('mongoose');
const Order = require('../models/Order');
const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const Chat = require('../models/ChatMessage');
const Notification = require('../models/Notification');
const safepayController = require('../controllers/safepayController');

const OWNER = new mongoose.Types.ObjectId();
const APPLICANT = new mongoose.Types.ObjectId();
const SERVICE = new mongoose.Types.ObjectId();
const REQUEST = new mongoose.Types.ObjectId();
const CHAT = new mongoose.Types.ObjectId();

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

function req() {
  return {
    user: { _id: OWNER },
    userId: String(OWNER),
    body: {
      serviceId: String(SERVICE),
      applicantId: String(APPLICANT),
      requestId: String(REQUEST),
    },
    app: { get: () => null },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Service.findById.mockResolvedValue({
    _id: SERVICE,
    userId: OWNER,
    status: 'open',
    price: 2500,
    checklist: [],
    title: 'Maling',
  });
  Service.findByIdAndUpdate.mockResolvedValue({});
  JobRequest.find.mockResolvedValue([]);
  JobRequest.findOneAndUpdate.mockResolvedValue({});
  JobRequest.updateMany.mockResolvedValue({});
  Order.findOne.mockResolvedValue(null);
  Order.findByIdAndUpdate.mockResolvedValue({});
  Notification.create.mockResolvedValue({});
  Chat.findOneAndUpdate.mockResolvedValue(null);
});

describe('only a live application can be awarded', () => {
  it('refuses a DECLINED applicant', async () => {
    JobRequest.findOne.mockResolvedValue({ _id: REQUEST, status: 'declined' });

    const res = makeRes();
    await safepayController.createContract(req(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('application_not_awardable');
    // Crucially it must not resurrect the declined request.
    expect(JobRequest.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Order).not.toHaveBeenCalled();
  });

  it('allows a pending application', async () => {
    JobRequest.findOne.mockResolvedValue({ _id: REQUEST, status: 'pending' });

    const res = makeRes();
    await safepayController.createContract(req(), res);

    expect(Order).toHaveBeenCalledTimes(1);
    const created = Order.mock.calls[0][0];
    expect(String(created.customerId)).toBe(String(OWNER)); // owner pays
    expect(String(created.providerId)).toBe(String(APPLICANT)); // applicant works
    expect(created.status).toBe('awaiting_payment');
  });

  it('refuses when the caller does not own the service', async () => {
    Service.findById.mockResolvedValue({
      _id: SERVICE,
      userId: new mongoose.Types.ObjectId(),
      status: 'open',
      price: 2500,
      checklist: [],
    });

    const res = makeRes();
    await safepayController.createContract(req(), res);

    expect(res.statusCode).toBe(403);
    expect(Order).not.toHaveBeenCalled();
  });
});

describe('the award links the existing conversation, whichever way round it is stored', () => {
  it('matches the chat created by applying (owner in the providerId slot)', async () => {
    JobRequest.findOne.mockResolvedValue({ _id: REQUEST, status: 'pending' });
    Chat.findOneAndUpdate.mockResolvedValue({
      _id: CHAT,
      messages: [],
      save: jest.fn().mockResolvedValue(),
    });

    await safepayController.createContract(req(), makeRes());

    // Must query the PAIR. A slot-specific filter missed every apply-created chat.
    expect(Chat.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: String(SERVICE),
        $or: [
          { clientId: String(OWNER), providerId: String(APPLICANT) },
          { clientId: String(APPLICANT), providerId: String(OWNER) },
        ],
      }),
      expect.objectContaining({ orderId: expect.anything(), status: 'contracted' }),
      expect.any(Object)
    );
  });

  it('writes chatId back onto the order so later system messages can post', async () => {
    JobRequest.findOne.mockResolvedValue({ _id: REQUEST, status: 'pending' });
    Chat.findOneAndUpdate.mockResolvedValue({
      _id: CHAT,
      messages: [],
      save: jest.fn().mockResolvedValue(),
    });

    await safepayController.createContract(req(), makeRes());

    // startJob and markReadyForReview both guard on `if (order.chatId)` — without this
    // link their system messages silently never appear.
    expect(Order.findByIdAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ chatId: CHAT })
    );
  });
});
