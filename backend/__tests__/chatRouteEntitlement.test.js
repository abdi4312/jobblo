jest.mock('../controllers/chatController', () => ({
  createOrGetChat: jest.fn(),
  getMyChats: jest.fn(),
  getChatById: jest.fn(),
  sendMessage: jest.fn(),
  createPaymentSession: jest.fn(),
  createContract: jest.fn(),
  updateAgreedPrice: jest.fn(),
  deleteChat: jest.fn(),
  deleteForMe: jest.fn(),
}));
jest.mock('../controllers/chatReportController', () => ({
  submitChatReport: jest.fn(),
  getMyChatReports: jest.fn(),
  reportSubmitLimiter: jest.fn(),
}));
jest.mock('../middleware/auth', () => ({
  authenticate: jest.fn(),
}));

const router = require('../routes/chat');
const { createOrGetChat } = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

describe('POST /create chat route', () => {
  it('keeps the authenticated chat flow independent of subscriptions', () => {
    const route = router.stack.find((layer) => layer.route?.path === '/create')?.route;

    expect(route).toBeDefined();
    expect(route.stack.map((layer) => layer.handle)).toEqual([authenticate, createOrGetChat]);
  });
});
