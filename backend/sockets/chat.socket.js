const jwt = require("jsonwebtoken");
const cookie = require("cookie");

const onlineUsers = new Map(); // userId -> Set of socketIds

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const rawCookie = socket.handshake.headers.cookie;
      if (!rawCookie) {
        return next(new Error("No cookies found"));
      }

      // 🍪 parse cookies
      const cookies = cookie.parse(rawCookie);
      const token = cookies.accessToken || cookies.token;

      if (!token) {
        return next(new Error("No token found"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verify session exists in DB
      const Session = require("../models/Session");
      const sessionExists = await Session.findById(decoded.sid);

      if (!sessionExists || sessionExists.userId.toString() !== decoded.id) {
        return next(new Error("Session expired or revoked"));
      }

      socket.userId = String(decoded.id);
      socket.sessionId = decoded.sid;

      next();
    } catch (err) {
      console.error("Socket Auth Error:", err.message);
      next(new Error("Socket auth failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
    console.log(`✅ Auth user: ${socket.userId}`);

    // Track online user
    if (socket.userId) {
      if (!onlineUsers.has(socket.userId)) {
        onlineUsers.set(socket.userId, new Set());
      }
      onlineUsers.get(socket.userId).add(socket.id);
      io.emit("get-online-users", Array.from(onlineUsers.keys()));
    }

    // join personal room
    socket.join(socket.userId);

    // =========================
    // 💬 SETUP USER
    // =========================
    socket.on("setup", (userData) => {
      const userId = typeof userData === "string" ? userData : userData?._id;
      if (userId) {
        socket.join(userId);
        if (!onlineUsers.has(userId)) {
          onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(socket.id);
        io.emit("get-online-users", Array.from(onlineUsers.keys()));
        console.log(`👤 User ${userId} setup completed`);
      }
    });

    // =========================
    // 💬 JOIN CHAT ROOM
    // =========================
    socket.on("join-chat", (chatId) => {
      socket.join(`chat-${chatId}`);
      console.log(`👥 ${socket.userId} joined chat-${chatId}`);
    });

    // =========================
    // 👁️ MARK AS READ (Real-time read status)
    // =========================
    socket.on("mark-as-read", async ({ chatId, userId }) => {
      try {
        const Chat = require("../models/ChatMessage");
        const chat = await Chat.findById(chatId);
        if (!chat) return;

        let modified = false;
        chat.messages.forEach((m) => {
          if (!m.seenBy.includes(userId)) {
            m.seenBy.push(userId);
            modified = true;
          }
        });

        if (modified) {
          // Use markModified for nested arrays to ensure Mongoose detects changes
          chat.markModified("messages");
          await chat.save();
        }

        // Notify other user in the chat
        io.to(`chat-${chatId}`).emit("messages-read", { chatId, userId });
      } catch (err) {
        console.error("Mark as read error:", err.message);
      }
    });

    // =========================
    // ✉️ SEND MESSAGE
    // =========================
    socket.on("send-message", async ({ chatId, text }) => {
      try {
        const Chat = require("../models/ChatMessage");

        const chat = await Chat.findById(chatId);
        if (!chat) return;

        const newMessage = {
          senderId: socket.userId,
          text,
          createdAt: new Date(),
          seenBy: [socket.userId],
        };

        chat.messages.push(newMessage);
        chat.lastMessage = text;
        await chat.save();

        io.to(`chat-${chatId}`).emit("receive-message", {
          chatId,
          message: newMessage,
        });
      } catch (err) {
        console.error("Send message error:", err.message);
      }
    });

    // =========================
    // ❌ DISCONNECT
    // =========================
    socket.on("disconnect", (reason) => {
      if (socket.userId && onlineUsers.has(socket.userId)) {
        const sockets = onlineUsers.get(socket.userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(socket.userId);
        }
        io.emit("get-online-users", Array.from(onlineUsers.keys()));
      }
      console.log(
        `❌ Socket disconnected: ${socket.id} | user=${socket.userId} | ${reason}`,
      );
    });
  });
};
