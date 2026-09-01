/**
 * Chat orientation.
 *
 * A chat stores two people in `clientId` and `providerId`, and TWO different code
 * paths create one:
 *
 *   applying to a job  → { clientId: applicant, providerId: owner }
 *   owner presses chat → { clientId: owner,     providerId: applicant }
 *
 * Two bugs came out of that:
 *
 *   1. createOrGetChat looked up only its own orientation, so pressing "Send melding"
 *      on someone who had already applied created a SECOND conversation for the same
 *      pair and job — and put the owner in the applicant slot, so the UI showed the
 *      owner as having applied to their own listing.
 *
 *   2. createContract mapped chat.clientId → Order.customerId (the payer) and
 *      chat.providerId → Order.providerId (the payee). Creating the contract from the
 *      apply-created chat therefore pointed the money the wrong way: the applicant
 *      would be charged and the job owner would be paid.
 */

jest.mock('../models/ChatMessage', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
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
  return Order;
});
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../models/Service', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../models/Dispute', () => ({ findOne: jest.fn() }));
jest.mock('../models/JobRequest', () => ({ findOne: jest.fn() }));
jest.mock('../config/stripe', () => ({ getStripe: jest.fn() }));
jest.mock('../services/stripe/customers', () => ({ resolveStripeCustomer: jest.fn() }));

const mongoose = require('mongoose');
const Chat = require('../models/ChatMessage');
const Order = require('../models/Order');
const User = require('../models/User');
const Service = require('../models/Service');
const JobRequest = require('../models/JobRequest');
const chatController = require('../controllers/chatController');

/** `Model.findX(...).select(...)` resolving to `value`. */
const selectChain = (value) => ({ select: jest.fn().mockResolvedValue(value) });

const OWNER = new mongoose.Types.ObjectId();
const APPLICANT = new mongoose.Types.ObjectId();
const SERVICE = new mongoose.Types.ObjectId();
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

/** A chainable populate() stub that finally resolves to `value`. */
function populateChain(value) {
  const chain = {};
  chain.populate = jest.fn(() => chain);
  chain.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(value).catch(reject);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: APPLICANT, name: 'Applicant' }) });
  // Default: a legitimate pair — OWNER owns the job, APPLICANT applied to it.
  Service.findById.mockReturnValue(selectChain({ _id: SERVICE, userId: OWNER }));
  JobRequest.findOne.mockReturnValue(selectChain({ _id: 'application_1' }));
});

describe('createOrGetChat finds an existing conversation in either orientation', () => {
  /** What Mongo returns for `findOneAndUpdate ... includeResultMetadata`. */
  const modifyResult = (value, updatedExisting) => ({
    value,
    lastErrorObject: { updatedExisting, n: 1 },
    ok: 1,
  });

  const startChat = (callerId) => ({
    req: {
      user: { id: String(callerId) },
      body: { providerId: String(APPLICANT), serviceId: String(SERVICE) },
    },
    res: makeRes(),
  });

  it('reuses the chat created when the applicant applied, instead of making a second one', async () => {
    // The chat as the apply flow stored it: applicant in clientId, owner in providerId.
    const existing = { _id: CHAT, clientId: { _id: APPLICANT }, providerId: { _id: OWNER } };
    Chat.findOneAndUpdate.mockResolvedValue(modifyResult(existing, true));
    Chat.findById.mockReturnValue(populateChain(existing));

    const { req, res } = startChat(OWNER);
    await chatController.createOrGetChat(req, res);

    // The query must match the PAIR, not one specific arrangement of the slots.
    expect(Chat.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: String(SERVICE),
        $or: [
          { clientId: String(OWNER), providerId: String(APPLICANT) },
          { clientId: String(APPLICANT), providerId: String(OWNER) },
        ],
      }),
      expect.anything(),
      expect.anything()
    );
    expect(Chat.create).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body._id).toBe(CHAT);
  });

  it('still creates a chat when the two have genuinely never spoken about this job', async () => {
    const fresh = { _id: CHAT, clientId: { _id: OWNER }, providerId: { _id: APPLICANT } };
    Chat.findOneAndUpdate.mockResolvedValue(modifyResult(fresh, false));
    Chat.findById.mockReturnValue(populateChain(fresh));

    const { req, res } = startChat(OWNER);
    await chatController.createOrGetChat(req, res);

    expect(res.statusCode).toBe(201);
  });

  /**
   * The duplicate-room bug in its second form.
   *
   * Even with the pair lookup fixed, reading and then inserting leaves a window: a
   * double-clicked button fires two requests, both read "nothing here", and both insert.
   * The only way to close it is to let the database decide — one upsert, matched on the
   * pair, with `$setOnInsert` so a conversation that already exists is never rewritten.
   */
  it('creates the conversation in a single upsert, never read-then-insert', async () => {
    Chat.findOneAndUpdate.mockResolvedValue(
      modifyResult({ _id: CHAT, clientId: { _id: OWNER }, providerId: { _id: APPLICANT } }, false)
    );
    Chat.findById.mockReturnValue(populateChain({ _id: CHAT }));

    const { req, res } = startChat(OWNER);
    await chatController.createOrGetChat(req, res);

    expect(Chat.create).not.toHaveBeenCalled();
    expect(Chat.findOne).not.toHaveBeenCalled();
    expect(Chat.findOneAndUpdate).toHaveBeenCalledTimes(1);

    const [, update, options] = Chat.findOneAndUpdate.mock.calls[0];
    expect(options).toEqual(expect.objectContaining({ upsert: true, new: true }));
    // $set would overwrite the slots of an existing conversation with the caller's
    // orientation — which is how the owner ended up in the applicant's slot.
    expect(update.$setOnInsert).toEqual(
      expect.objectContaining({ clientId: String(OWNER), providerId: String(APPLICANT) })
    );
    expect(update.$set).toBeUndefined();
  });

  it('restores the thread for someone who had deleted it, in the same write', async () => {
    Chat.findOneAndUpdate.mockResolvedValue(modifyResult({ _id: CHAT }, true));
    Chat.findById.mockReturnValue(populateChain({ _id: CHAT }));

    const { req, res } = startChat(OWNER);
    await chatController.createOrGetChat(req, res);

    const [, update] = Chat.findOneAndUpdate.mock.calls[0];
    expect(String(update.$pull.deletedFor)).toBe(String(OWNER));
    // It used to take a second round trip, and only when the first query happened to
    // return a document whose deletedFor had already been populated.
    expect(Chat.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  /**
   * Chat creation used to check only "not yourself" and "the other user exists".
   * Nothing tied either party to the job, so any authenticated user could open a
   * conversation with any other user by supplying a scraped user id and any service
   * id — arriving in the victim's inbox looking like a real job conversation.
   */
  it('refuses a stranger who neither owns the job nor applied to it', async () => {
    const stranger = new mongoose.Types.ObjectId();
    // Neither the caller nor the target owns this service.
    Service.findById.mockReturnValue(
      selectChain({ _id: SERVICE, userId: new mongoose.Types.ObjectId() })
    );

    const res = makeRes();
    await chatController.createOrGetChat(
      {
        user: { id: String(stranger) },
        body: { providerId: String(APPLICANT), serviceId: String(SERVICE) },
      },
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('not_related_to_service');
    expect(Chat.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses the owner messaging someone who never applied', async () => {
    JobRequest.findOne.mockReturnValue(selectChain(null));

    const res = makeRes();
    await chatController.createOrGetChat(
      {
        user: { id: String(OWNER) },
        body: { providerId: String(APPLICANT), serviceId: String(SERVICE) },
      },
      res
    );

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('no_application_between_parties');
    expect(Chat.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a malformed id with 400 rather than a CastError 500', async () => {
    const res = makeRes();
    await chatController.createOrGetChat(
      { user: { id: String(OWNER) }, body: { providerId: 'not-an-id', serviceId: String(SERVICE) } },
      res
    );

    expect(res.statusCode).toBe(400);
  });

  it('refuses a chat with yourself', async () => {
    const req = { user: { id: String(OWNER) }, body: { providerId: String(OWNER), serviceId: String(SERVICE) } };
    const res = makeRes();

    await chatController.createOrGetChat(req, res);

    expect(res.statusCode).toBe(400);
    expect(Chat.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('createContract points the money by service ownership, not by chat slot', () => {
  function chatInOrientation({ clientId, providerId }) {
    return {
      _id: CHAT,
      clientId: { _id: clientId },
      providerId: { _id: providerId },
      serviceId: { _id: SERVICE, userId: OWNER, price: 1000, checklist: [] },
      orderId: null,
      agreedPrice: 1000,
      messages: [],
      save: jest.fn().mockResolvedValue(),
    };
  }

  beforeEach(() => {
    Order.findOne.mockResolvedValue(null);
    Service.findByIdAndUpdate.mockResolvedValue({});
  });

  it('charges the OWNER even when the chat has the owner in the providerId slot', async () => {
    // This is the apply-created orientation — the one that used to invert the money.
    Chat.findById.mockReturnValue(populateChain(chatInOrientation({ clientId: APPLICANT, providerId: OWNER })));

    const req = { user: { id: String(OWNER) }, params: { chatId: String(CHAT) }, body: {} };
    await chatController.createContract(req, makeRes());

    expect(Order).toHaveBeenCalledTimes(1);
    const created = Order.mock.calls[0][0];
    expect(String(created.customerId)).toBe(String(OWNER)); // pays
    expect(String(created.providerId)).toBe(String(APPLICANT)); // gets paid
  });

  it('produces the same order from the other orientation', async () => {
    Chat.findById.mockReturnValue(populateChain(chatInOrientation({ clientId: OWNER, providerId: APPLICANT })));

    const req = { user: { id: String(OWNER) }, params: { chatId: String(CHAT) }, body: {} };
    await chatController.createContract(req, makeRes());

    const created = Order.mock.calls[0][0];
    expect(String(created.customerId)).toBe(String(OWNER));
    expect(String(created.providerId)).toBe(String(APPLICANT));
  });

  it('still refuses a caller who does not own the service', async () => {
    Chat.findById.mockReturnValue(populateChain(chatInOrientation({ clientId: APPLICANT, providerId: OWNER })));

    const req = { user: { id: String(APPLICANT) }, params: { chatId: String(CHAT) }, body: {} };
    const res = makeRes();

    await chatController.createContract(req, res);

    expect(res.statusCode).toBe(403);
    expect(Order).not.toHaveBeenCalled();
  });

  it('takes the price from the chat, never from the request body', async () => {
    const chat = chatInOrientation({ clientId: APPLICANT, providerId: OWNER });
    chat.agreedPrice = 1500;
    Chat.findById.mockReturnValue(populateChain(chat));

    const req = { user: { id: String(OWNER) }, params: { chatId: String(CHAT) }, body: { agreedPrice: 999999 } };
    await chatController.createContract(req, makeRes());

    const created = Order.mock.calls[0][0];
    expect(created.agreedPrice).toBe(1500);
  });
});
