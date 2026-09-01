const mongoose = require('mongoose');

jest.mock('../models/ChatMessage', () => ({ findById: jest.fn() }));

const Chat = require('../models/ChatMessage');
const chatSocket = require('../sockets/chat.socket');

/**
 * Regression guard for F-50.
 *
 * The Socket.IO handshake is authenticated, but the event handlers were not: `join-chat`
 * put any authenticated socket into any chat room (so it received every message in a
 * conversation it had no part in), and `send-message` wrote into any conversation.
 * These tests pin membership checking against the authenticated `socket.userId`.
 */

const CLIENT = new mongoose.Types.ObjectId();
const PROVIDER = new mongoose.Types.ObjectId();
const OUTSIDER = new mongoose.Types.ObjectId();
const CHAT_ID = new mongoose.Types.ObjectId();

/** Boot the socket module and return a connected fake socket for `userId`. */
function connectAs(userId) {
  const handlers = {};
  const io = {
    use: jest.fn(),
    on: jest.fn((event, fn) => {
      if (event === 'connection') io._onConnection = fn;
    }),
    to: jest.fn(() => ({ emit: jest.fn() })),
    emit: jest.fn(),
  };

  chatSocket(io);

  const socket = {
    id: 'socket-1',
    userId: String(userId),
    on: jest.fn((event, fn) => {
      handlers[event] = fn;
    }),
    join: jest.fn(),
    emit: jest.fn(),
  };

  io._onConnection(socket);
  return { socket, handlers, io };
}

/** A chat between CLIENT and PROVIDER. */
function mockChat(extra = {}) {
  const chat = {
    _id: CHAT_ID,
    clientId: CLIENT,
    providerId: PROVIDER,
    messages: [],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    ...extra,
  };
  // join-chat uses .select(); send-message / mark-as-read await the query directly.
  Chat.findById.mockReturnValue(
    Object.assign(Promise.resolve(chat), { select: jest.fn().mockResolvedValue(chat) })
  );
  return chat;
}

describe('join-chat membership (F-50)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets a participant join the chat room', async () => {
    mockChat();
    const { socket, handlers } = connectAs(CLIENT);
    socket.join.mockClear(); // ignore the personal-room join on connect

    await handlers['join-chat'](String(CHAT_ID));

    expect(socket.join).toHaveBeenCalledWith(`chat-${CHAT_ID}`);
  });

  it('refuses an outsider and does not join them to the room', async () => {
    mockChat();
    const { socket, handlers } = connectAs(OUTSIDER);
    socket.join.mockClear();

    await handlers['join-chat'](String(CHAT_ID));

    expect(socket.join).not.toHaveBeenCalledWith(`chat-${CHAT_ID}`);
    expect(socket.emit).toHaveBeenCalledWith(
      'chat-error',
      expect.objectContaining({ chatId: String(CHAT_ID) })
    );
  });
});

describe('send-message membership (F-50)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends and saves a message from a participant', async () => {
    const chat = mockChat();
    const { handlers } = connectAs(PROVIDER);

    await handlers['send-message']({ chatId: String(CHAT_ID), text: 'hei' });

    expect(chat.messages).toHaveLength(1);
    expect(chat.save).toHaveBeenCalled();
  });

  it('refuses to inject a message from an outsider', async () => {
    const chat = mockChat();
    const { socket, handlers } = connectAs(OUTSIDER);

    await handlers['send-message']({ chatId: String(CHAT_ID), text: 'injected' });

    expect(chat.messages).toHaveLength(0);
    expect(chat.save).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('chat-error', expect.any(Object));
  });
});

describe('setup / mark-as-read use the authenticated id (F-50)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('setup ignores a client-supplied id and joins only the authenticated room', () => {
    const { socket, handlers } = connectAs(CLIENT);
    socket.join.mockClear();

    handlers['setup'](String(OUTSIDER)); // attacker passes a victim's id

    expect(socket.join).toHaveBeenCalledWith(String(CLIENT));
    expect(socket.join).not.toHaveBeenCalledWith(String(OUTSIDER));
  });

  it('mark-as-read ignores a client-supplied userId for an outsider', async () => {
    const chat = mockChat();
    const { handlers } = connectAs(OUTSIDER);

    await handlers['mark-as-read']({ chatId: String(CHAT_ID), userId: String(CLIENT) });

    expect(chat.save).not.toHaveBeenCalled();
  });
});
