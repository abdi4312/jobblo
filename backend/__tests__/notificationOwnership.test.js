const mongoose = require('mongoose');

jest.mock('../models/Notification', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));
jest.mock('../models/User', () => ({ findById: jest.fn() }));

const Notification = require('../models/Notification');
const notificationController = require('../controllers/notificationController');

/**
 * Regression guard for F-53.
 *
 * markAsRead did findById then findByIdAndUpdate with no comparison, and
 * deleteNotification deleted straight by id — so any authenticated user could mark or
 * delete any other user's notifications. System broadcasts (userId: null) are one
 * shared document: readable/markable by everyone, but not deletable by a single user.
 */

const OWNER = new mongoose.Types.ObjectId();
const ATTACKER = new mongoose.Types.ObjectId();
const NOTIF = new mongoose.Types.ObjectId();

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

/** findByIdAndUpdate(...).populate().populate()... resolves to the doc. */
function updateChain(value) {
  const o = {
    populate: jest.fn(() => o),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return o;
}

function req(userId) {
  return { params: { id: String(NOTIF) }, userId: String(userId), body: {} };
}

describe('markAsRead ownership (F-53)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.findByIdAndUpdate.mockReturnValue(updateChain({ _id: NOTIF, read: true }));
  });

  it("refuses to mark another user's notification as read", async () => {
    Notification.findById.mockResolvedValue({ _id: NOTIF, userId: OWNER });
    const res = mockRes();

    await notificationController.markAsRead(req(ATTACKER), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Notification.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('marks the owner’s own notification as read', async () => {
    Notification.findById.mockResolvedValue({ _id: NOTIF, userId: OWNER });
    const res = mockRes();

    await notificationController.markAsRead(req(OWNER), res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(Notification.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('still allows marking a system broadcast (userId: null) as read', async () => {
    Notification.findById.mockResolvedValue({ _id: NOTIF, userId: null, isSystem: true });
    const res = mockRes();

    await notificationController.markAsRead(req(ATTACKER), res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(Notification.findByIdAndUpdate).toHaveBeenCalled();
  });
});

describe('deleteNotification ownership (F-53)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Notification.findByIdAndDelete.mockResolvedValue({ _id: NOTIF });
  });

  it("refuses to delete another user's notification", async () => {
    Notification.findById.mockResolvedValue({ _id: NOTIF, userId: OWNER });
    const res = mockRes();

    await notificationController.deleteNotification(req(ATTACKER), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Notification.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('refuses to delete a system broadcast for everyone', async () => {
    Notification.findById.mockResolvedValue({ _id: NOTIF, userId: null, isSystem: true });
    const res = mockRes();

    await notificationController.deleteNotification(req(OWNER), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Notification.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('deletes the owner’s own notification', async () => {
    Notification.findById.mockResolvedValue({ _id: NOTIF, userId: OWNER });
    const res = mockRes();

    await notificationController.deleteNotification(req(OWNER), res);

    expect(Notification.findByIdAndDelete).toHaveBeenCalledWith(String(NOTIF));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
});

describe('createTestNotification targeting (F-53)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ignores a body userId and can only target the caller', async () => {
    const User = require('../models/User');
    User.findById.mockResolvedValue({ _id: OWNER });
    const spy = jest
      .spyOn(notificationController, 'createAndEmitNotification')
      .mockResolvedValue({ _id: 'n1' });

    const res = mockRes();
    await notificationController.createTestNotification(
      {
        // attacker tries to inject into the victim's tray
        body: { userId: String(ATTACKER), content: 'phish' },
        userId: String(OWNER),
        app: { get: () => null },
      },
      res
    );

    expect(spy).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ userId: String(OWNER) })
    );
    spy.mockRestore();
  });
});
