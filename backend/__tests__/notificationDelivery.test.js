const mongoose = require('mongoose');

jest.mock('../models/Notification', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
}));

const Notification = require('../models/Notification');
const { setIO } = require('../sockets/io');
const { userRooms, joinUserRooms } = require('../sockets/rooms');
const { notify, broadcast, emitToUser } = require('../services/notifications');

/**
 * Regression guard for the notification delivery rewrite.
 *
 * Three separate faults conspired to make notifications feel unreliable:
 *
 *   1. Eighteen of twenty-one creation sites called `Notification.create` directly and
 *      never emitted, so the notification existed but was never delivered — "someone
 *      applied to my job" only appeared on the next refetch.
 *   2. `user_<id>` was joined in response to a client `join` event, which fires once per
 *      mount. socket.io reconnects silently, and a reconnect is a new socket with no
 *      rooms, so after the first network blip the room was empty.
 *   3. Delivery emitted once per room name, and a socket is in both — every notification
 *      arrived twice, which is two sounds and two toasts for one event.
 */

const USER = new mongoose.Types.ObjectId();

/** Records `.to()` chains so a test can assert how many emits actually happened. */
function mockIO() {
  const emits = [];
  const io = {
    emit: jest.fn((event, payload) => emits.push({ rooms: [], event, payload })),
    to: jest.fn(function chain(room) {
      const rooms = [room];
      const target = {
        to: (next) => {
          rooms.push(next);
          return target;
        },
        emit: (event, payload) => emits.push({ rooms: [...rooms], event, payload }),
      };
      return target;
    }),
  };
  return { io, emits };
}

function mockCreated(overrides = {}) {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    userId: USER,
    type: 'application',
    content: 'Ny søknad',
    ...overrides,
  };
  return { ...doc, toObject: () => doc };
}

beforeEach(() => {
  jest.clearAllMocks();
  Notification.countDocuments.mockResolvedValue(3);
  Notification.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
});

describe('rooms', () => {
  it('a user occupies both historical room names', () => {
    expect(userRooms(USER)).toEqual([String(USER), `user_${USER}`]);
  });

  it('joins on connection rather than on a client message', () => {
    const socket = { userId: String(USER), join: jest.fn() };
    joinUserRooms(socket);
    // Called from io.on('connection'), so this repeats on every reconnect — which is the
    // whole fix. Nothing here reads a client payload.
    expect(socket.join).toHaveBeenCalledWith(String(USER));
    expect(socket.join).toHaveBeenCalledWith(`user_${USER}`);
  });

  it('ignores an unauthenticated socket', () => {
    const socket = { join: jest.fn() };
    joinUserRooms(socket);
    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe('notify', () => {
  it('creates and delivers in one operation', async () => {
    const { io, emits } = mockIO();
    setIO(io);
    Notification.create.mockResolvedValue(mockCreated());

    await notify({ userId: USER, type: 'application', content: 'Ny søknad' });

    expect(Notification.create).toHaveBeenCalledTimes(1);
    const delivered = emits.filter((e) => e.event === 'new_notification');
    expect(delivered).toHaveLength(1);
  });

  it('delivers exactly once even though the user is in two rooms', async () => {
    const { io, emits } = mockIO();
    setIO(io);
    Notification.create.mockResolvedValue(mockCreated());

    await notify({ userId: USER, type: 'order', content: 'Betaling mottatt' });

    const delivered = emits.filter((e) => e.event === 'new_notification');
    expect(delivered).toHaveLength(1);
    // One emit addressed to both rooms — socket.io dedupes recipients across a chained
    // `.to()`, where two separate emits would not.
    expect(delivered[0].rooms).toEqual([String(USER), `user_${USER}`]);
  });

  it('carries the unread count so the client does not have to ask for it', async () => {
    const { io, emits } = mockIO();
    setIO(io);
    Notification.create.mockResolvedValue(mockCreated());

    await notify({ userId: USER, type: 'payment', content: 'Utbetalt' });

    const delivered = emits.find((e) => e.event === 'new_notification');
    expect(delivered.payload.unreadCount).toBe(3);
    expect(emits.find((e) => e.event === 'notification_count').payload).toEqual({ count: 3 });
  });

  it('marks urgent types so the client knows what deserves a sound', async () => {
    const { io, emits } = mockIO();
    setIO(io);

    Notification.create.mockResolvedValue(mockCreated({ type: 'payment' }));
    await notify({ userId: USER, type: 'payment', content: 'Betalt' });
    expect(emits.at(-2).payload.urgent).toBe(true);

    emits.length = 0;
    Notification.create.mockResolvedValue(mockCreated({ type: 'review' }));
    await notify({ userId: USER, type: 'review', content: 'Ny vurdering' });
    expect(emits.find((e) => e.event === 'new_notification').payload.urgent).toBe(false);
  });

  it('emits the companion event alongside the notification', async () => {
    const { io, emits } = mockIO();
    setIO(io);
    Notification.create.mockResolvedValue(mockCreated());

    await notify({
      userId: USER,
      type: 'application',
      content: 'Ny søknad',
      event: 'new_job_request',
      payload: { requestId: 'abc' },
    });

    expect(emits.find((e) => e.event === 'new_job_request').payload).toEqual({ requestId: 'abc' });
  });

  it('refuses a type the model enum would reject, instead of throwing mid-request', async () => {
    const { io } = mockIO();
    setIO(io);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await notify({ userId: USER, type: 'test', content: 'x' });

    expect(result).toBeNull();
    expect(Notification.create).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('never throws when delivery fails — the business operation already succeeded', async () => {
    setIO(null);
    Notification.create.mockRejectedValue(new Error('mongo down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      notify({ userId: USER, type: 'order', content: 'Oppdraget er startet.' })
    ).resolves.toBeNull();

    spy.mockRestore();
  });
});

describe('broadcast', () => {
  it('goes to the whole namespace, not a user room', async () => {
    const { io, emits } = mockIO();
    setIO(io);
    Notification.create.mockResolvedValue(mockCreated({ userId: null, isSystem: true }));

    await broadcast({ type: 'system_update', content: 'Planlagt vedlikehold' });

    expect(io.emit).toHaveBeenCalledTimes(1);
    expect(emits[0].rooms).toEqual([]);
  });
});

describe('emitToUser', () => {
  it('is inert when the socket server has not started', () => {
    setIO(null);
    expect(() => emitToUser(USER, 'anything', {})).not.toThrow();
  });
});
