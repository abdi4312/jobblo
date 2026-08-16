const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const onlineUsers = new Map(); // userId -> Set of socketIds

/**
 * (F-50) The handshake is authenticated, but the event handlers below were not:
 * `join-chat` would put any authenticated socket into any chat room, and
 * `send-message` would write into any conversation. Every chat event must therefore
 * check membership against the authenticated `socket.userId` — never a client payload.
 */
const isChatParticipant = (chat, userId) =>
  String(chat.clientId) === String(userId) || String(chat.providerId) === String(userId);

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      if (!rawCookie) {
        return next(new Error('No cookies found'));
      }

      // 🍪 parse cookies
      const cookies = cookie.parse(rawCookie);
      const token = cookies.accessToken || cookies.token;

      if (!token) {
        return next(new Error('No token found'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verify session exists in DB
      const Session = require('../models/Session');
      const sessionExists = await Session.findById(decoded.sid);

      if (!sessionExists || sessionExists.userId.toString() !== decoded.id) {
        return next(new Error('Session expired or revoked'));
      }

      socket.userId = String(decoded.id);
      socket.sessionId = decoded.sid;

      next();
    } catch (err) {
      console.error('Socket Auth Error:', err.message);
      next(new Error('Socket auth failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    console.log(`✅ Auth user: ${socket.userId}`);

    // Track online user
    if (socket.userId) {
      if (!onlineUsers.has(socket.userId)) {
        onlineUsers.set(socket.userId, new Set());
      }
      onlineUsers.get(socket.userId).add(socket.id);
      io.emit('get-online-users', Array.from(onlineUsers.keys()));
    }

    // join personal room
    socket.join(socket.userId);

    // =========================
    // 💬 SETUP USER
    // =========================
    // The client used to pass its own id here, which let a socket join any user's
    // private room and fake their presence. The authenticated id is the only source.
    socket.on('setup', () => {
      const userId = socket.userId;
      if (!userId) return;
      socket.join(userId);
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);
      io.emit('get-online-users', Array.from(onlineUsers.keys()));
    });

    // =========================
    // 💬 JOIN CHAT ROOM
    // =========================
    socket.on('join-chat', async (chatId) => {
      try {
        const Chat = require('../models/ChatMessage');
        const chat = await Chat.findById(chatId).select('clientId providerId');
        if (!chat || !isChatParticipant(chat, socket.userId)) {
          // Without this, any authenticated user could join any chat room by id and
          // receive every `receive-message` broadcast in that conversation.
          return socket.emit('chat-error', { chatId, error: 'Ikke tilgang til denne samtalen.' });
        }
        socket.join(`chat-${chatId}`);
      } catch (err) {
        console.error('join-chat error:', err.message);
      }
    });

    // =========================
    // 👁️ MARK AS READ (Real-time read status)
    // =========================
    socket.on('mark-as-read', async ({ chatId }) => {
      try {
        // `userId` used to come from the client payload, making read receipts
        // spoofable for any user. Use the authenticated id only.
        const userId = socket.userId;
        const Chat = require('../models/ChatMessage');
        const chat = await Chat.findById(chatId).select('clientId providerId');
        if (!chat || !isChatParticipant(chat, userId)) return;

        // This used to load the document, push into every message's seenBy, call
        // markModified('messages') and save — which writes the ENTIRE messages array
        // with $set. The client emits mark-as-read on mount and on every inbound
        // message, so if the counterparty's send-message committed between the read
        // and the save, that message was overwritten out of existence: no error, the
        // sender's UI showed it delivered, and it was gone from dispute evidence too.
        //
        // A positional-filtered $addToSet touches only the seenBy arrays, so a
        // concurrent $push of a new message cannot be clobbered.
        await Chat.updateOne(
          { _id: chatId },
          { $addToSet: { 'messages.$[unseen].seenBy': userId } },
          { arrayFilters: [{ 'unseen.seenBy': { $ne: userId } }] }
        );

        // Notify ALL users in the chat room (including sender)
        io.to(`chat-${chatId}`).emit('messages-read', { chatId, userId });
      } catch (err) {
        console.error('Mark as read error:', err.message);
      }
    });

    // =========================
    // ✉️ SEND MESSAGE
    // =========================
    socket.on('send-message', async ({ chatId, text }) => {
      try {
        const Chat = require('../models/ChatMessage');

        const chat = await Chat.findById(chatId);
        if (!chat) return;
        if (!isChatParticipant(chat, socket.userId)) {
          // Without this, any authenticated user could inject messages into any
          // conversation they are not part of.
          return socket.emit('chat-error', { chatId, error: 'Ikke tilgang til denne samtalen.' });
        }

        const newMessage = {
          senderId: socket.userId,
          text,
          createdAt: new Date(),
          seenBy: [socket.userId], // Sender already saw their own message
        };

        chat.messages.push(newMessage);
        chat.lastMessage = text;
        await chat.save();

        // Emit socket event to notify users in the chat room
        io.to(`chat-${chatId}`).emit('receive-message', {
          chatId,
          message: newMessage,
        });
      } catch (err) {
        console.error('Send message error:', err.message);
      }
    });

    // =========================
    // ❌ DISCONNECT
    // =========================
    socket.on('disconnect', (reason) => {
      if (socket.userId && onlineUsers.has(socket.userId)) {
        const sockets = onlineUsers.get(socket.userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(socket.userId);
        }
        io.emit('get-online-users', Array.from(onlineUsers.keys()));
      }
      console.log(`❌ Socket disconnected: ${socket.id} | user=${socket.userId} | ${reason}`);
    });
  });
};
