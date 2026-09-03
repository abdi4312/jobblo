jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../models/Session', () => ({ deleteMany: jest.fn() }));
jest.mock('../services/admin/activityService', () => ({ logActivity: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));

const User = require('../models/User');
const Session = require('../models/Session');
const jwt = require('jsonwebtoken');
const { logActivity } = require('../services/admin/activityService');
const { softDeleteUser, reactivateUser } = require('../controllers/admin/usersAdminController');
const { authenticate } = require('../middleware/auth');

const ADMIN_ID = '507f1f77bcf86cd799439011';
const TARGET_ID = '507f1f77bcf86cd799439022';

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
    clearCookie: jest.fn(),
  };
}

function lean(value) {
  return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockReturnValue(
    lean({
      _id: TARGET_ID,
      role: 'user',
      name: 'Target',
      email: 'target@example.test',
      isDeleted: false,
    })
  );
  User.findByIdAndUpdate.mockReturnValue({
    select: jest.fn().mockResolvedValue({ _id: TARGET_ID, accountStatus: 'inactive' }),
  });
  Session.deleteMany.mockResolvedValue({ deletedCount: 2 });
});

test('admin deactivation preserves the user and revokes every session', async () => {
  const res = response();
  await softDeleteUser(
    { params: { id: TARGET_ID }, user: { _id: ADMIN_ID }, ip: '127.0.0.1', headers: {} },
    res
  );

  expect(String(User.findByIdAndUpdate.mock.calls[0][0])).toBe(TARGET_ID);
  expect(User.findByIdAndUpdate.mock.calls[0][1]).toEqual(
    expect.objectContaining({ accountStatus: 'inactive', deactivatedBy: ADMIN_ID })
  );
  expect(User.findByIdAndUpdate.mock.calls[0][1].isDeleted).toBeUndefined();
  expect(String(Session.deleteMany.mock.calls[0][0].userId)).toBe(TARGET_ID);
  expect(res.statusCode).toBe(200);
  expect(logActivity).toHaveBeenCalledWith(expect.objectContaining({ action: 'user_deactivated' }));
});

test('reactivation clears lifecycle audit fields and still leaves old sessions revoked', async () => {
  User.findByIdAndUpdate.mockReturnValue({
    select: jest.fn().mockResolvedValue({ _id: TARGET_ID, accountStatus: 'active' }),
  });
  const res = response();
  await reactivateUser(
    { params: { id: TARGET_ID }, user: { _id: ADMIN_ID }, ip: '127.0.0.1', headers: {} },
    res
  );

  expect(String(User.findByIdAndUpdate.mock.calls[0][0])).toBe(TARGET_ID);
  expect(User.findByIdAndUpdate.mock.calls[0][1]).toEqual({
    accountStatus: 'active',
    deactivatedAt: null,
    deactivatedBy: null,
  });
  expect(User.findByIdAndUpdate.mock.calls[0][2]).toEqual({ new: true });
  expect(String(Session.deleteMany.mock.calls[0][0].userId)).toBe(TARGET_ID);
  expect(res.body.data.user.accountStatus).toBe('active');
});

test('status endpoint also revokes sessions when an admin deactivates a user', async () => {
  const res = response();
  const { updateUserStatus } = require('../controllers/admin/usersAdminController');
  User.findByIdAndUpdate.mockReturnValue({
    select: jest.fn().mockResolvedValue({ _id: TARGET_ID, accountStatus: 'inactive' }),
  });

  await updateUserStatus(
    {
      params: { id: TARGET_ID },
      body: { accountStatus: 'inactive' },
      user: { _id: ADMIN_ID },
      ip: '127.0.0.1',
      headers: {},
    },
    res
  );

  expect(Session.deleteMany).toHaveBeenCalledTimes(1);
  expect(String(Session.deleteMany.mock.calls[0][0].userId)).toBe(TARGET_ID);
  expect(res.statusCode).toBe(200);
});

test('an existing access token is rejected after the user is deactivated', async () => {
  jwt.verify.mockReturnValue({ id: TARGET_ID, sid: 'session_1' });
  const session = { lastUsed: null, save: jest.fn() };
  Session.findOne = jest.fn().mockResolvedValue(session);
  User.findById.mockReturnValue({
    select: jest
      .fn()
      .mockResolvedValue({ _id: TARGET_ID, accountStatus: 'inactive', isDeleted: false }),
  });

  const req = { cookies: { accessToken: 'old-token' }, headers: {} };
  const res = response();
  const next = jest.fn();
  await authenticate(req, res, next);

  expect(res.statusCode).toBe(403);
  expect(res.body.code).toBe('account_inactive');
  expect(next).not.toHaveBeenCalled();
});
