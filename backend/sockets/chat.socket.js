const jwt = require("jsonwebtoken");
const cookie = require("cookie");

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

    // join personal room
    socket.join(socket.userId);

    // =========================
    // 💬 JOIN CHAT ROOM
    // =========================
    socket.on("join-chat", (chatId) => {
      socket.join(`chat-${chatId}`);
      console.log(`👥 ${socket.userId} joined chat-${chatId}`);
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
    // 👁️ MARK SEEN
    // =========================
    socket.on("mark-seen", async ({ chatId }) => {
      const Chat = require("../models/ChatMessage");
      const chat = await Chat.findById(chatId);
      if (!chat) return;

      chat.messages.forEach((m) => {
        if (!m.seenBy.includes(socket.userId)) {
          m.seenBy.push(socket.userId);
        }
      });

      await chat.save();

      io.to(`chat-${chatId}`).emit("seen-update", {
        chatId,
        userId: socket.userId,
      });
    });

    // =========================
    // ❌ DISCONNECT
    // =========================
    socket.on("disconnect", (reason) => {
      console.log(
        `❌ Socket disconnected: ${socket.id} | user=${socket.userId} | ${reason}`,
      );
    });
  });
};