const mongoose = require('mongoose');
const { parseObjectId } = require('../utils/pagination');

jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

// ── Enhanced chainable query mock ──────────────────────────────────────
const mockQuery = (resolveValue) => {
  const q = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(resolveValue),
    then: (resolve, reject) => Promise.resolve(resolveValue).then(resolve, reject),
    catch: (reject) => Promise.resolve(resolveValue).catch(reject),
    finally: (cb) => Promise.resolve(resolveValue).finally(cb),
  };
  return q;
};

const VALID_REPORT_TYPES = [
  'harassment', 'abusive_language', 'threats', 'spam', 'scam_or_fraud',
  'payment_issue', 'safepay_issue', 'work_not_completed', 'poor_quality',
  'different_from_agreement', 'inappropriate_content', 'fake_profile',
  'identity_issue', 'suspicious_link', 'privacy_violation',
  'off_platform_payment_request', 'other',
];
const VALID_STATUSES = ['open', 'under_review', 'waiting_for_reporter', 'waiting_for_reported_user', 'action_required', 'resolved', 'dismissed', 'closed'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

jest.mock('../models/ChatMessage', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  distinct: jest.fn(),
}));

jest.mock('../models/ChatReport', () => ({
  schema: {
    path: (p) => {
      if (p === 'reportType') return { enumValues: VALID_REPORT_TYPES };
      if (p === 'status') return { enumValues: VALID_STATUSES };
      if (p === 'priority') return { enumValues: VALID_PRIORITIES };
      return {};
    },
  },
  findById: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  distinct: jest.fn(),
  aggregate: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/Order', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../models/Payment', () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../models/Dispute', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  aggregate: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/Notification', () => ({
  create: jest.fn(),
}));

jest.mock('../models/User', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../models/Service', () => ({
  find: jest.fn(),
}));

jest.mock('../models/SafePayHistory', () => ({
  findOne: jest.fn(),
  aggregate: jest.fn(),
}));

jest.mock('../utils/cloudinaryUpload', () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue('https://example.com/file.jpg'),
  deleteFromCloudinary: jest.fn(),
}));

jest.mock('../services/admin/activityService');
jest.mock('../services/admin/safePayStateService');

// ── Module refs ───────────────────────────────────────────────────────────
const Chat = require('../models/ChatMessage');
const ChatReport = require('../models/ChatReport');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Dispute = require('../models/Dispute');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Service = require('../models/Service');
const { logActivity } = require('../services/admin/activityService');
const { openDispute } = require('../services/admin/safePayStateService');

// ── Helpers ────────────────────────────────────────────────────────────────
function makeChat(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    clientId: new mongoose.Types.ObjectId(),
    providerId: new mongoose.Types.ObjectId(),
    serviceId: new mongoose.Types.ObjectId(),
    orderId: null,
    status: 'in_progress',
    agreedPrice: 1500,
    messages: [],
    lastMessage: null,
    deletedFor: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeReport(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    chatId: new mongoose.Types.ObjectId(),
    scope: 'chat',
    messageId: null,
    reportType: 'spam',
    title: 'Test report',
    description: 'Test description',
    status: 'open',
    priority: 'medium',
    reportedBy: new mongoose.Types.ObjectId(),
    reportedUser: new mongoose.Types.ObjectId(),
    orderId: null,
    serviceId: null,
    safePayOrderId: null,
    disputeId: null,
    assignedAdminId: null,
    internalNotes: [],
    evidence: [],
    timeline: [],
    officialMessages: [],
    resolution: null,
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeReq(overrides = {}) {
  return {
    params: {},
    body: {},
    query: {},
    userId: String(new mongoose.Types.ObjectId()),
    user: { _id: new mongoose.Types.ObjectId(), name: 'Admin Test', role: 'superAdmin' },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    ...overrides,
  };
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Chat Report System', () => {
  let req, res;

  beforeAll(async () => {
    // All controllers are loaded on demand in each test via require()
  });

  beforeEach(() => {
    jest.clearAllMocks();
    req = makeReq();
    res = makeRes();
  });

  // ═════════════════════════════════════════════════════════════════════
  //  USER-SIDE: submitReport
  // ═════════════════════════════════════════════════════════════════════

  describe('submitReport (user-side)', () => {
    let chatReportController;

    beforeAll(() => {
      chatReportController = require('../controllers/chatReportController');
    });

    test('returns 400 for invalid Chat ID', async () => {
      req.params.chatId = 'invalid';
      req.body = { scope: 'chat', reportType: 'spam', title: 'Test', description: 'Test description' };
      await chatReportController.submitChatReport(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    test('returns 404 when chat does not exist', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params.chatId = chatId;
      req.body = { scope: 'chat', reportType: 'spam', title: 'Test', description: 'Test description' };
      Chat.findById.mockReturnValue(mockQuery(null));
      await chatReportController.submitChatReport(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('non-participant returns 403', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params.chatId = chatId;
      req.body = { scope: 'chat', reportType: 'spam', title: 'Test', description: 'Test' };
      Chat.findById.mockReturnValue(mockQuery({
        _id: chatId, clientId: new mongoose.Types.ObjectId(), providerId: new mongoose.Types.ObjectId(), messages: [],
      }));
      await chatReportController.submitChatReport(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('empty title returns 400', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params.chatId = chatId;
      req.body = { scope: 'chat', reportType: 'spam', title: '', description: 'Test' };
      Chat.findById.mockReturnValue(mockQuery({ _id: chatId, clientId: req.userId, providerId: new mongoose.Types.ObjectId(), messages: [] }));
      await chatReportController.submitChatReport(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('empty description returns 400', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params.chatId = chatId;
      req.body = { scope: 'chat', reportType: 'spam', title: 'Test', description: '' };
      Chat.findById.mockReturnValue(mockQuery({ _id: chatId, clientId: req.userId, providerId: new mongoose.Types.ObjectId(), messages: [] }));
      await chatReportController.submitChatReport(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('participant can report complete chat', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const clientId = req.userId;
      const providerId = new mongoose.Types.ObjectId();
      req.params.chatId = chatId;
      req.body = { scope: 'chat', reportType: 'scam_or_fraud', title: 'Suspicious', description: 'Test desc' };
      Chat.findById.mockReturnValue(mockQuery({ _id: chatId, clientId, providerId, orderId: null, serviceId: null, messages: [] }));
      ChatReport.findOne.mockReturnValue(mockQuery(null));
      ChatReport.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId(), chatId, scope: 'chat', reportType: 'scam_or_fraud', reportedBy: clientId, reportedUser: providerId });
      User.find.mockReturnValue(mockQuery([]));
      await chatReportController.submitChatReport(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('participant can report a specific message', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const clientId = req.userId;
      const providerId = new mongoose.Types.ObjectId();
      const messageId = new mongoose.Types.ObjectId();
      req.params.chatId = chatId;
      req.body = { scope: 'message', messageId: String(messageId), reportType: 'harassment', title: 'Bad msg', description: 'Inappropriate' };
      Chat.findById.mockReturnValue(mockQuery({ _id: chatId, clientId, providerId, orderId: null, serviceId: null, messages: [{ _id: messageId }] }));
      ChatReport.findOne.mockReturnValue(mockQuery(null));
      ChatReport.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId(), chatId, scope: 'message', messageId: String(messageId) });
      User.find.mockReturnValue(mockQuery([]));
      await chatReportController.submitChatReport(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('invalid message ID returns 400', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params.chatId = chatId;
      req.body = { scope: 'message', messageId: 'nonexistent', reportType: 'harassment', title: 'Test', description: 'Test' };
      Chat.findById.mockReturnValue(mockQuery({ _id: chatId, clientId: req.userId, providerId: new mongoose.Types.ObjectId(), messages: [{ _id: new mongoose.Types.ObjectId() }] }));
      await chatReportController.submitChatReport(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('duplicate report within 24h returns 429', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params.chatId = chatId;
      req.body = { scope: 'chat', reportType: 'spam', title: 'Spam', description: 'Duplicate' };
      Chat.findById.mockReturnValue(mockQuery({ _id: chatId, clientId: req.userId, providerId: new mongoose.Types.ObjectId(), orderId: null, serviceId: null, messages: [] }));
      ChatReport.findOne.mockReturnValue(mockQuery({ _id: new mongoose.Types.ObjectId() }));
      await chatReportController.submitChatReport(req, res);
      expect(res.status).toHaveBeenCalledWith(429);
    });

    test('creates ChatReport with all linked fields', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const clientId = req.userId;
      const providerId = new mongoose.Types.ObjectId();
      const serviceId = new mongoose.Types.ObjectId();
      const orderId = new mongoose.Types.ObjectId();
      req.params.chatId = chatId;
      req.body = { scope: 'chat', reportType: 'payment_issue', title: 'Payment problem', description: 'Not paid' };
      Chat.findById.mockReturnValue(mockQuery({ _id: chatId, clientId, providerId, orderId, serviceId, messages: [] }));
      ChatReport.findOne.mockReturnValue(mockQuery(null));
      ChatReport.create.mockResolvedValue({ _id: new mongoose.Types.ObjectId(), chatId, orderId, serviceId, safePayOrderId: orderId });
      User.find.mockReturnValue(mockQuery([]));
      await chatReportController.submitChatReport(req, res);
      expect(ChatReport.create).toHaveBeenCalledWith(expect.objectContaining({ chatId, orderId, serviceId }));
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: getChats (chat search)
  // ═════════════════════════════════════════════════════════════════════

  describe('getChats (admin chat search)', () => {
    let adminChats;

    beforeAll(() => {
      adminChats = require('../controllers/admin/chatsAdminController');
    });

    test('invalid Chat ID returns 400', async () => {
      req.query = { chatId: 'invalid' };
      await adminChats.getChats(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('empty query returns paginated chats', async () => {
      const chat1 = makeChat();
      Chat.countDocuments.mockReturnValue(mockQuery(2));
      Chat.find.mockReturnValue(mockQuery([chat1, makeChat()]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([{ _id: chat1._id, messageCount: 2, attachmentCount: 0, lastMessageAt: null }]));
      await adminChats.getChats(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('search by Chat ID', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.query = { chatId: String(chatId) };
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ _id: chatId })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('search by Order ID', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const chatId = new mongoose.Types.ObjectId();
      req.query = { orderId: String(orderId) };
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ _id: chatId, orderId })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(expect.objectContaining({ orderId }));
    });

    test('search by Service ID', async () => {
      const serviceId = new mongoose.Types.ObjectId();
      req.query = { serviceId: String(serviceId) };
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ serviceId })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(expect.objectContaining({ serviceId }));
    });

    test('search by Customer ID', async () => {
      const customerId = new mongoose.Types.ObjectId();
      req.query = { customerId: String(customerId) };
      Chat.countDocuments.mockReturnValue(mockQuery(0));
      Chat.find.mockReturnValue(mockQuery([]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalled();
    });

    test('search by Provider ID', async () => {
      const providerId = new mongoose.Types.ObjectId();
      req.query = { providerId: String(providerId) };
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ providerId })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(expect.objectContaining({ providerId }));
    });

    test('search by Report ID resolves to chat', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const reportId = new mongoose.Types.ObjectId();
      req.query = { reportId: String(reportId) };
      ChatReport.findById.mockReturnValue(mockQuery({ _id: reportId, chatId }));
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ _id: chatId })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(expect.objectContaining({ _id: chatId }));
    });

    test('invalid Report ID returns 400', async () => {
      req.query = { reportId: 'bad' };
      await adminChats.getChats(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Report ID not found returns 404', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.query = { reportId: String(reportId) };
      ChatReport.findById.mockReturnValue(mockQuery(null));
      await adminChats.getChats(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('filter by chat status', async () => {
      req.query = { status: 'completed' };
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ status: 'completed' })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    });

    test('invalid status is ignored', async () => {
      req.query = { status: 'unknown_status' };
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat()]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith({});
    });

    test('filter by reported = true', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.query = { reported: 'true' };
      ChatReport.distinct.mockReturnValue(mockQuery([chatId]));
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ _id: chatId })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(expect.objectContaining({ _id: { $in: [chatId] } }));
    });

    test('filter by reported = false', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.query = { reported: 'false' };
      ChatReport.distinct.mockReturnValue(mockQuery([chatId]));
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ _id: new mongoose.Types.ObjectId() })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(expect.objectContaining({ _id: { $nin: [chatId] } }));
    });

    test('filter by safePayLinked = true', async () => {
      req.query = { safePayLinked: 'true' };
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ orderId: new mongoose.Types.ObjectId() })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(expect.objectContaining({ orderId: { $exists: true, $ne: null } }));
    });

    test('filter by safePayLinked = false', async () => {
      req.query = { safePayLinked: 'false' };
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ orderId: null })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalled();
    });

    test('filter by date range', async () => {
      req.query = { startDate: '2024-01-01', endDate: '2024-12-31' };
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat()]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: expect.objectContaining({ $gte: expect.any(Date), $lte: expect.any(Date) }) })
      );
    });

    test('text search by service title', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const serviceId = new mongoose.Types.ObjectId();
      req.query = { search: 'Logo Design' };
      Service.find.mockReturnValue(mockQuery([{ _id: serviceId }]));
      User.find.mockReturnValue(mockQuery([]));
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ _id: chatId, serviceId })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(
        expect.objectContaining({ $or: expect.arrayContaining([{ serviceId: { $in: [serviceId] } }]) })
      );
    });

    test('text search by user name', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();
      req.query = { search: 'John' };
      Service.find.mockReturnValue(mockQuery([]));
      User.find.mockReturnValue(mockQuery([{ _id: userId }]));
      Chat.countDocuments.mockReturnValue(mockQuery(1));
      Chat.find.mockReturnValue(mockQuery([makeChat({ _id: chatId, clientId: userId })]));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(Chat.find).toHaveBeenCalledWith(
        expect.objectContaining({ $or: expect.arrayContaining([{ clientId: { $in: [userId] } }, { providerId: { $in: [userId] } }]) })
      );
    });

    test('text search with no matches returns empty', async () => {
      req.query = { search: 'NonexistentUserXYZ' };
      Service.find.mockReturnValue(mockQuery([]));
      User.find.mockReturnValue(mockQuery([]));
      await adminChats.getChats(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { chats: [] } }));
    });

    test('pagination metadata is returned', async () => {
      Chat.countDocuments.mockReturnValue(mockQuery(25));
      Chat.find.mockReturnValue(mockQuery(Array(15).fill(null).map(() => makeChat())));
      ChatReport.aggregate.mockReturnValue(mockQuery([]));
      Chat.aggregate.mockReturnValue(mockQuery([]));
      req.query = { page: '1', limit: '15' };
      await adminChats.getChats(req, res);
      const pagination = res.json.mock.calls[0][0].pagination;
      expect(pagination.total).toBe(25);
      expect(pagination.totalPages).toBe(2);
      expect(pagination.hasNextPage).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: getChatById (chat detail)
  // ═════════════════════════════════════════════════════════════════════

  describe('getChatById (admin chat detail)', () => {
    let adminChats;

    beforeAll(() => {
      adminChats = require('../controllers/admin/chatsAdminController');
    });

    test('invalid Chat ID returns 400', async () => {
      req.params = { chatId: 'badid' };
      await adminChats.getChatById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('chat not found returns 404', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params = { chatId: String(chatId) };
      Chat.findById.mockReturnValue(mockQuery(null));
      await adminChats.getChatById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns chat metadata with participants', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const chat = makeChat({ _id: chatId, messages: [{ _id: new mongoose.Types.ObjectId(), text: 'Hello', senderId: new mongoose.Types.ObjectId() }] });
      req.params = { chatId: String(chatId) };
      Chat.findById.mockReturnValue(mockQuery(chat));
      ChatReport.countDocuments.mockReturnValue(mockQuery(2));
      Payment.findOne.mockReturnValue(mockQuery(null));
      Dispute.findOne.mockReturnValue(mockQuery(null));
      await adminChats.getChatById(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          chat: expect.objectContaining({ _id: chatId, reportCount: 2 }),
        }),
      }));
    });

    test('includes payment info when linked', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const chat = makeChat({ orderId });
      req.params = { chatId: String(chat._id) };
      Chat.findById.mockReturnValue(mockQuery(chat));
      ChatReport.countDocuments.mockReturnValue(mockQuery(0));
      Payment.findOne.mockReturnValue(mockQuery({ status: 'completed', amount: 1500, stripePaymentIntentId: 'pi_xxx' }));
      Dispute.findOne.mockReturnValue(mockQuery(null));
      await adminChats.getChatById(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ payment: { status: 'completed', amount: 1500 } }),
      }));
    });

    test('excludes stripePaymentIntentId from response', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const chat = makeChat({ orderId });
      req.params = { chatId: String(chat._id) };
      Chat.findById.mockReturnValue(mockQuery(chat));
      ChatReport.countDocuments.mockReturnValue(mockQuery(0));
      Payment.findOne.mockReturnValue(mockQuery({ status: 'completed', amount: 1500, stripePaymentIntentId: 'pi_xxx' }));
      Dispute.findOne.mockReturnValue(mockQuery(null));
      await adminChats.getChatById(req, res);
      const data = res.json.mock.calls[0][0].data;
      expect(data.payment.stripePaymentIntentId).toBeUndefined();
    });

    test('includes dispute info when linked', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const chat = makeChat({ orderId });
      req.params = { chatId: String(chat._id) };
      Chat.findById.mockReturnValue(mockQuery(chat));
      ChatReport.countDocuments.mockReturnValue(mockQuery(0));
      Payment.findOne.mockReturnValue(mockQuery(null));
      Dispute.findOne.mockReturnValue(mockQuery({ _id: new mongoose.Types.ObjectId(), status: 'open', priority: 'high' }));
      await adminChats.getChatById(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ dispute: expect.objectContaining({ status: 'open' }) }),
      }));
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: getChatMessages (read-only chat access)
  // ═════════════════════════════════════════════════════════════════════

  describe('getChatMessages (admin chat access)', () => {
    let adminChats;

    beforeAll(() => {
      adminChats = require('../controllers/admin/chatsAdminController');
    });

    test('invalid Chat ID returns 400', async () => {
      req.params = { chatId: 'bad' };
      req.query = { accessReason: 'SafePay review' };
      await adminChats.getChatMessages(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('missing access reason returns 400', async () => {
      req.params = { chatId: new mongoose.Types.ObjectId() };
      req.query = {};
      await adminChats.getChatMessages(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('short access reason (< 5 chars) returns 400', async () => {
      req.params = { chatId: new mongoose.Types.ObjectId() };
      req.query = { accessReason: 'abc' };
      await adminChats.getChatMessages(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('chat not found returns 404', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params = { chatId: String(chatId) };
      req.query = { accessReason: 'SafePay review' };
      Chat.findById.mockReturnValue(mockQuery(null));
      await adminChats.getChatMessages(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns messages safely without passwords/tokens', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();
      const msgId = new mongoose.Types.ObjectId();
      req.params = { chatId: String(chatId) };
      req.query = { accessReason: 'SafePay review' };
      req.user = { _id: new mongoose.Types.ObjectId() };

      Chat.findById.mockReturnValue(mockQuery({
        _id: chatId,
        clientId: new mongoose.Types.ObjectId(),
        providerId: new mongoose.Types.ObjectId(),
        orderId: new mongoose.Types.ObjectId(),
        messages: [{ _id: msgId, text: 'Hello', type: 'text', attachments: [], senderId: { _id: senderId, name: 'John', email: 'john@test.com', role: 'user' }, createdAt: new Date() }],
      }));
      ChatReport.find.mockReturnValue(mockQuery([]));
      logActivity.mockResolvedValue({});

      await adminChats.getChatMessages(req, res);
      const msgs = res.json.mock.calls[0][0].data.messages;
      expect(msgs[0].text).toBe('Hello');
      expect(msgs[0].sender.email).toBeUndefined();
      expect(msgs[0].sender._id).toBeDefined();
      expect(msgs[0].sender.name).toBeDefined();
    });

    test('marks reported messages with isReported flag', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const msgId = new mongoose.Types.ObjectId();
      req.params = { chatId: String(chatId) };
      req.query = { accessReason: 'Report investigation' };
      req.user = { _id: new mongoose.Types.ObjectId() };

      Chat.findById.mockReturnValue(mockQuery({
        _id: chatId,
        clientId: new mongoose.Types.ObjectId(),
        providerId: new mongoose.Types.ObjectId(),
        orderId: null,
        messages: [{ _id: msgId, text: 'Bad', type: 'text', attachments: [], senderId: { _id: new mongoose.Types.ObjectId(), name: 'X', role: 'user' }, createdAt: new Date() }],
      }));
      ChatReport.find.mockReturnValue(mockQuery([{ messageId: String(msgId), reportType: 'harassment', status: 'open' }]));
      logActivity.mockResolvedValue({});

      await adminChats.getChatMessages(req, res);
      const msgs = res.json.mock.calls[0][0].data.messages;
      expect(msgs[0].isReported).toBe(true);
    });

    test('creates audit log entry on access', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      req.params = { chatId: String(chatId) };
      req.query = { accessReason: 'SafePay review' };
      req.user = { _id: adminId };

      Chat.findById.mockReturnValue(mockQuery({
        _id: chatId, clientId: new mongoose.Types.ObjectId(), providerId: new mongoose.Types.ObjectId(), orderId: null, messages: [],
      }));
      ChatReport.find.mockReturnValue(mockQuery([]));
      logActivity.mockResolvedValue({});

      await adminChats.getChatMessages(req, res);
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        adminId,
        targetId: chatId,
        description: expect.stringContaining('SafePay review'),
      }));
    });

    test('includes access reason and logged flag in response', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params = { chatId: String(chatId) };
      req.query = { accessReason: 'Support request' };
      req.user = { _id: new mongoose.Types.ObjectId() };

      Chat.findById.mockReturnValue(mockQuery({
        _id: chatId, clientId: new mongoose.Types.ObjectId(), providerId: new mongoose.Types.ObjectId(), orderId: null, messages: [],
      }));
      ChatReport.find.mockReturnValue(mockQuery([]));
      logActivity.mockResolvedValue({});

      await adminChats.getChatMessages(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ accessLogged: true, reason: 'Support request' }),
      }));
    });

    test('returns system messages', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params = { chatId: String(chatId) };
      req.query = { accessReason: 'SafePay review' };
      req.user = { _id: new mongoose.Types.ObjectId() };

      Chat.findById.mockReturnValue(mockQuery({
        _id: chatId,
        clientId: new mongoose.Types.ObjectId(),
        providerId: new mongoose.Types.ObjectId(),
        orderId: null,
        messages: [
          { _id: new mongoose.Types.ObjectId(), text: 'Payment completed', type: 'system_payment', attachments: [], senderId: null, systemData: { amount: 1500 }, createdAt: new Date() },
        ],
      }));
      ChatReport.find.mockReturnValue(mockQuery([]));
      logActivity.mockResolvedValue({});

      await adminChats.getChatMessages(req, res);
      const msgs = res.json.mock.calls[0][0].data.messages;
      expect(msgs[0].type).toBe('system_payment');
      expect(msgs[0].sender).toBeNull();
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: logChatAccess
  // ═════════════════════════════════════════════════════════════════════

  describe('logChatAccess', () => {
    let adminChats;

    beforeAll(() => {
      adminChats = require('../controllers/admin/chatsAdminController');
    });

    test('invalid Chat ID returns 400', async () => {
      req.params = { chatId: 'bad' };
      req.body = { accessReason: 'SafePay review' };
      await adminChats.logChatAccess(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('missing access reason returns 400', async () => {
      req.params = { chatId: new mongoose.Types.ObjectId() };
      req.body = {};
      await adminChats.logChatAccess(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('logs activity on success', async () => {
      const chatId = new mongoose.Types.ObjectId();
      const adminId = new mongoose.Types.ObjectId();
      req.params = { chatId: String(chatId) };
      req.body = { accessReason: 'Fraud investigation', orderId: new mongoose.Types.ObjectId() };
      req.user = { _id: adminId };
      logActivity.mockResolvedValue({});

      await adminChats.logChatAccess(req, res);
      expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({
        adminId,
        targetId: chatId,
        description: expect.stringContaining('Fraud investigation'),
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: getChatReports (reports for a specific chat)
  // ═════════════════════════════════════════════════════════════════════

  describe('getChatReports (reports for a chat)', () => {
    let adminChats;

    beforeAll(() => {
      adminChats = require('../controllers/admin/chatsAdminController');
    });

    test('invalid Chat ID returns 400', async () => {
      req.params = { chatId: 'bad' };
      await adminChats.getChatReports(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns reports for chat', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.params = { chatId: String(chatId) };
      ChatReport.find.mockReturnValue(mockQuery([makeReport({ chatId })]));
      await adminChats.getChatReports(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: getReports (admin reports list)
  // ═════════════════════════════════════════════════════════════════════

  describe('getReports (admin reports list)', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('returns paginated reports', async () => {
      ChatReport.countDocuments.mockReturnValue(mockQuery(5));
      ChatReport.find.mockReturnValue(mockQuery([makeReport(), makeReport()]));
      await reportAdmin.getReports(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('filters by status', async () => {
      req.query = { status: 'open' };
      ChatReport.countDocuments.mockReturnValue(mockQuery(2));
      ChatReport.find.mockReturnValue(mockQuery([makeReport({ status: 'open' }), makeReport({ status: 'open' })]));
      await reportAdmin.getReports(req, res);
      expect(ChatReport.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'open' }));
    });

    test('filters by priority', async () => {
      req.query = { priority: 'urgent' };
      ChatReport.countDocuments.mockReturnValue(mockQuery(1));
      ChatReport.find.mockReturnValue(mockQuery([makeReport({ priority: 'urgent' })]));
      await reportAdmin.getReports(req, res);
      expect(ChatReport.find).toHaveBeenCalledWith(expect.objectContaining({ priority: 'urgent' }));
    });

    test('filters by report type', async () => {
      req.query = { reportType: 'scam_or_fraud' };
      ChatReport.countDocuments.mockReturnValue(mockQuery(1));
      ChatReport.find.mockReturnValue(mockQuery([makeReport({ reportType: 'scam_or_fraud' })]));
      await reportAdmin.getReports(req, res);
      expect(ChatReport.find).toHaveBeenCalledWith(expect.objectContaining({ reportType: 'scam_or_fraud' }));
    });

    test('filters by Chat ID', async () => {
      const chatId = new mongoose.Types.ObjectId();
      req.query = { chatId: String(chatId) };
      ChatReport.countDocuments.mockReturnValue(mockQuery(1));
      ChatReport.find.mockReturnValue(mockQuery([makeReport({ chatId })]));
      await reportAdmin.getReports(req, res);
      expect(ChatReport.find).toHaveBeenCalledWith(expect.objectContaining({ chatId }));
    });

    test('filters by date range', async () => {
      req.query = { startDate: '2024-01-01', endDate: '2024-12-31' };
      ChatReport.countDocuments.mockReturnValue(mockQuery(1));
      ChatReport.find.mockReturnValue(mockQuery([makeReport()]));
      await reportAdmin.getReports(req, res);
      expect(ChatReport.find).toHaveBeenCalledWith(
        expect.objectContaining({ createdAt: expect.objectContaining({ $gte: expect.any(Date), $lte: expect.any(Date) }) })
      );
    });

    test('excludes internal notes and timeline fields in select', async () => {
      ChatReport.countDocuments.mockReturnValue(mockQuery(0));
      ChatReport.find.mockReturnValue(mockQuery([]));
      await reportAdmin.getReports(req, res);
      expect(ChatReport.find).toHaveBeenCalled();
    });

    test('summary endpoint returns counts', async () => {
      ChatReport.countDocuments.mockReturnValue(mockQuery(5));
      ChatReport.aggregate.mockReturnValue(mockQuery([
        { _id: 'open', count: 3 },
        { _id: 'under_review', count: 1 },
        { _id: 'resolved', count: 4 },
      ]));
      await reportAdmin.getReportsSummary(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: getReportById
  // ═════════════════════════════════════════════════════════════════════

  describe('getReportById', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('invalid report ID returns 400', async () => {
      req.params = { reportId: 'bad' };
      await reportAdmin.getReportById(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('not found returns 404', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      ChatReport.findById.mockReturnValue(mockQuery(null));
      await reportAdmin.getReportById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns full report with timeline and evidence', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const report = makeReport({ _id: reportId });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.getReportById(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: assignReport
  // ═════════════════════════════════════════════════════════════════════

  describe('assignReport', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('assigns admin and sets under_review status', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const report = makeReport({ _id: reportId, status: 'open', assignedAdminId: null });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      logActivity.mockResolvedValue({});
      await reportAdmin.assignReport(req, res);
      expect(report.assignedAdminId).toEqual(req.user._id);
      expect(report.status).toBe('under_review');
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('reassigning overwrites previous admin', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const existingAdminId = new mongoose.Types.ObjectId();
      const report = makeReport({ _id: reportId, assignedAdminId: existingAdminId, status: 'open', timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      logActivity.mockResolvedValue({});
      await reportAdmin.assignReport(req, res);
      expect(report.assignedAdminId).toEqual(req.user._id);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: updatePriority
  // ═════════════════════════════════════════════════════════════════════

  describe('updatePriority', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('changes priority and adds timeline', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { priority: 'urgent' };
      const report = makeReport({ _id: reportId, priority: 'medium', timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.updatePriority(req, res);
      expect(report.priority).toBe('urgent');
      expect(report.timeline.length).toBeGreaterThan(0);
    });

    test('invalid priority returns 400', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { priority: 'invalid' };
      const report = makeReport({ _id: reportId, priority: 'medium' });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.updatePriority(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: updateStatus
  // ═════════════════════════════════════════════════════════════════════

  describe('updateStatus', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('changes status and adds timeline', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { status: 'under_review', note: 'Starting review' };
      const report = makeReport({ _id: reportId, status: 'open', timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.updateStatus(req, res);
      expect(report.status).toBe('under_review');
      expect(report.timeline.length).toBeGreaterThan(0);
    });

    test('invalid status returns 400', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { status: 'invalid_status' };
      const report = makeReport({ _id: reportId });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.updateStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: addInternalNote
  // ═════════════════════════════════════════════════════════════════════

  describe('addInternalNote', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('adds private internal note', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { note: 'This is a private note for admin only' };
      const report = makeReport({ _id: reportId, internalNotes: [], timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.addInternalNote(req, res);
      expect(report.internalNotes.length).toBe(1);
      expect(report.internalNotes[0].note).toBe('This is a private note for admin only');
    });

    test('missing note returns 400', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = {};
      const report = makeReport({ _id: reportId });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.addInternalNote(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: resolveReport
  // ═════════════════════════════════════════════════════════════════════

  describe('resolveReport', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('resolves with outcome and reason', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { outcome: 'no_violation', reason: 'No evidence found.' };
      const report = makeReport({ _id: reportId, status: 'under_review', resolution: null, timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      logActivity.mockResolvedValue({});
      await reportAdmin.resolveReport(req, res);
      expect(report.status).toBe('resolved');
      expect(report.resolution.outcome).toBe('no_violation');
      expect(report.resolution.reason).toBe('No evidence found.');
    });

    test('missing outcome returns 400', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { reason: 'test' };
      const report = makeReport({ _id: reportId, status: 'under_review' });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.resolveReport(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('can resolve from non-terminal status (open -> resolved)', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { outcome: 'no_violation', reason: 'No issue found.' };
      const report = makeReport({ _id: reportId, status: 'open', resolution: null, timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      logActivity.mockResolvedValue({});
      await reportAdmin.resolveReport(req, res);
      expect(report.status).toBe('resolved');
      expect(report.resolution.outcome).toBe('no_violation');
    });

    test('resolved status returns 409', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { outcome: 'no_violation', reason: 'test' };
      const report = makeReport({ _id: reportId, status: 'resolved' });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.resolveReport(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: reopenReport
  // ═════════════════════════════════════════════════════════════════════

  describe('reopenReport', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('reopens a resolved report', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { reason: 'New evidence available' };
      const report = makeReport({ _id: reportId, status: 'resolved', timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      logActivity.mockResolvedValue({});
      await reportAdmin.reopenReport(req, res);
      expect(report.status).toBe('under_review');
      expect(report.timeline.length).toBeGreaterThan(0);
    });

    test('cannot reopen an already open report', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { reason: 'Test' };
      const report = makeReport({ _id: reportId, status: 'open' });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.reopenReport(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: createDisputeFromReport
  // ═════════════════════════════════════════════════════════════════════

  describe('createDisputeFromReport', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('no SafePay order returns 400', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const report = makeReport({ _id: reportId, safePayOrderId: null, orderId: null });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.createDisputeFromReport(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('creates dispute and links to report', async () => {
      const reportId = new mongoose.Types.ObjectId();
      const orderId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const report = makeReport({ _id: reportId, safePayOrderId: orderId, orderId, chatId: new mongoose.Types.ObjectId(), disputeId: null, timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      Order.findById.mockReturnValue(mockQuery({ _id: orderId, status: 'paid', customerId: new mongoose.Types.ObjectId(), providerId: new mongoose.Types.ObjectId() }));
      Dispute.findOne.mockReturnValue(mockQuery(null));
      openDispute.mockResolvedValue({ _id: new mongoose.Types.ObjectId(), status: 'open' });
      await reportAdmin.createDisputeFromReport(req, res);
      expect(report.disputeId).toBeTruthy();
      expect(report.timeline.length).toBeGreaterThan(0);
    });

    test('duplicate active dispute returns 409', async () => {
      const reportId = new mongoose.Types.ObjectId();
      const orderId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const report = makeReport({ _id: reportId, safePayOrderId: orderId, orderId, disputeId: null });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      Order.findById.mockReturnValue(mockQuery({ _id: orderId, status: 'paid' }));
      Dispute.findOne.mockReturnValue(mockQuery({ _id: new mongoose.Types.ObjectId(), status: 'open' }));
      await reportAdmin.createDisputeFromReport(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: requestInformation
  // ═════════════════════════════════════════════════════════════════════

  describe('requestInformation', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('requests info and adds timeline entry', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { from: 'reporter', message: 'Please provide more details' };
      const report = makeReport({ _id: reportId, timeline: [], officialMessages: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      Notification.create.mockResolvedValue({});
      await reportAdmin.requestInformation(req, res);
      expect(report.timeline.length).toBeGreaterThan(0);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('missing "from" field returns 400', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { message: 'Please provide more details' };
      const report = makeReport({ _id: reportId });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.requestInformation(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: addOfficialMessage
  // ═════════════════════════════════════════════════════════════════════

  describe('addOfficialMessage', () => {
    let reportAdmin;

    beforeAll(() => {
      reportAdmin = require('../controllers/admin/chatReportsAdminController');
    });

    test('adds official moderation message', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { recipientId: new mongoose.Types.ObjectId(), message: 'This is an official warning.' };
      const report = makeReport({ _id: reportId, officialMessages: [], timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.addOfficialMessage(req, res);
      expect(report.officialMessages.length).toBe(1);
      expect(report.officialMessages[0].message).toBe('This is an official warning.');
    });

    test('missing message returns 400', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      req.body = { recipientId: new mongoose.Types.ObjectId() };
      const report = makeReport({ _id: reportId });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      await reportAdmin.addOfficialMessage(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  ADMIN: Evidence Upload
  // ═════════════════════════════════════════════════════════════════════

  describe('uploadEvidence', () => {
    let evidenceController;

    beforeAll(() => {
      evidenceController = require('../controllers/admin/evidenceUploadController');
    });

    test('invalid report ID returns 400', async () => {
      req.params = { reportId: 'bad' };
      await evidenceController.uploadEvidence(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('report not found returns 404', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      ChatReport.findById.mockReturnValue(mockQuery(null));
      await evidenceController.uploadEvidence(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('no files returns 400', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const report = makeReport({ _id: reportId });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      req.files = [];
      await evidenceController.uploadEvidence(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('uploads files and adds to evidence array', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const report = makeReport({ _id: reportId, evidence: [], timeline: [] });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      req.files = [
        { mimetype: 'image/jpeg', size: 1024, originalname: 'photo.jpg' },
        { mimetype: 'application/pdf', size: 2048, originalname: 'doc.pdf' },
      ];
      const cloudinaryUpload = require('../utils/cloudinaryUpload');
      cloudinaryUpload.uploadToCloudinary.mockResolvedValue('https://cloudinary.com/file.jpg');
      await evidenceController.uploadEvidence(req, res);
      expect(report.evidence.length).toBe(2);
      expect(report.timeline.length).toBeGreaterThan(0);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    test('rejects invalid file types', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const report = makeReport({ _id: reportId });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      req.files = [{ mimetype: 'text/html', size: 100, originalname: 'bad.html' }];
      await evidenceController.uploadEvidence(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('rejects oversized files (>5MB)', async () => {
      const reportId = new mongoose.Types.ObjectId();
      req.params = { reportId: String(reportId) };
      const report = makeReport({ _id: reportId });
      ChatReport.findById.mockReturnValue(mockQuery(report));
      req.files = [{ mimetype: 'image/jpeg', size: 6 * 1024 * 1024, originalname: 'huge.jpg' }];
      await evidenceController.uploadEvidence(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ═════════════════════════════════════════════════════════════════════
  //  SafePay Admin: Chat ID display
  // ═════════════════════════════════════════════════════════════════════

  describe('SafePay admin chat ID display', () => {
    let safePayAdmin;

    beforeAll(() => {
      safePayAdmin = require('../controllers/admin/safePayAdminController');
    });

    test('getSafePayList includes chatId and chatStatus', async () => {
      req.query = {};
      const orderId = new mongoose.Types.ObjectId();
      const chatId = new mongoose.Types.ObjectId();
      Order.countDocuments.mockReturnValue(mockQuery(1));
      Order.find.mockReturnValue(mockQuery([{ _id: orderId, chatId, customerId: {}, providerId: {}, serviceId: {}, agreedPrice: 1000, status: 'paid' }]));
      Dispute.find.mockReturnValue(mockQuery([]));
      Chat.find.mockReturnValue(mockQuery([{ _id: chatId, status: 'in_progress' }]));
      await safePayAdmin.getSafePayList(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          contracts: expect.arrayContaining([expect.objectContaining({ chatId, chatStatus: 'in_progress' })]),
        }),
      }));
    });

    test('getSafePayList shows "No linked chat" when chatId missing', async () => {
      req.query = {};
      const orderId = new mongoose.Types.ObjectId();
      Order.countDocuments.mockReturnValue(mockQuery(1));
      Order.find.mockReturnValue(mockQuery([{ _id: orderId, chatId: null, customerId: {}, providerId: {}, serviceId: {}, agreedPrice: 1000, status: 'paid' }]));
      Dispute.find.mockReturnValue(mockQuery([]));
      Chat.find.mockReturnValue(mockQuery([]));
      await safePayAdmin.getSafePayList(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          contracts: expect.arrayContaining([expect.objectContaining({ chatId: null })]),
        }),
      }));
    });

    test('getSafePayDetail includes chat info', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const chatId = new mongoose.Types.ObjectId();
      req.params = { orderId: String(orderId) };
      Order.findById.mockReturnValue(mockQuery({ _id: orderId, chatId, customerId: {}, providerId: {}, serviceId: {}, agreedPrice: 1000, status: 'paid', checklist: [] }));
      Chat.findById.mockReturnValue(mockQuery({ _id: chatId, status: 'completed', messages: [{ _id: new mongoose.Types.ObjectId(), type: 'text', text: 'Hi', createdAt: new Date() }] }));
      Payment.findOne.mockReturnValue(mockQuery({ status: 'completed', amount: 1000 }));
      const SafePayHistory = require('../models/SafePayHistory');
      SafePayHistory.findOne.mockReturnValue(mockQuery(null));
      Dispute.findOne.mockReturnValue(mockQuery(null));
      await safePayAdmin.getSafePayDetail(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ chatMeta: expect.objectContaining({ _id: chatId }) }),
      }));
    });
  });
});
