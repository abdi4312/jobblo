const jwt = require("jsonwebtoken");
const ChatController = require("../controllers/chatController");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // =========================
    // 🔐 USER AUTH
    // =========================
    socket.on("user:connect", ({ token }) => {
      console.log("Received token:", token);
      try {
        if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET not set");

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded JWT:", decoded);

        // ✅ ID extract karne ka safe tariqa
        const userId = decoded?.id || decoded?._id;
        if (!userId) throw new Error("No User ID found in token");

        // ✅ Always store as string safely
        socket.userId = String(userId);

        // ✅ Join personal room
        socket.join(socket.userId);

        socket.emit("user:authenticated", {
          message: "Authentication successful",
        });
        console.log(`✅ User ${socket.userId} authenticated`);
      } catch (err) {
        console.log("❌ Token verification failed:", err.message);
        socket.emit("error", { message: "Auth failed: " + err.message });
      }
    });

    // =========================
    // 💬 JOIN CHAT ROOM
    // =========================
    socket.on("join-chat", (chatId) => {
      if (socket.userId) {
        socket.join(`chat-${chatId}`);
        console.log(`👥 User ${socket.userId} joined chat-${chatId}`);
      } else {
        console.log("❌ join-chat failed: userId not found");
      }
    });

    // =========================
    // ✉️ SEND MESSAGE
    // =========================
    socket.on("send-message", async ({ chatId, text }) => {
      try {
        if (!socket.userId)
          return socket.emit("error", { message: "Not authenticated" });

        const Chat = require("../models/ChatMessage");

        // 1. Chat dhundein
        const chat = await Chat.findById(chatId);
        if (!chat) return socket.emit("error", { message: "Chat not found" });

        // 2. Naya message object banayein
        const newMessage = {
          senderId: socket.userId,
          text: text,
          createdAt: new Date(),
          seenBy: [socket.userId],
        };

        // 3. Database mein push karein
        chat.messages.push(newMessage);
        chat.lastMessage = text;
        await chat.save();

        // 4. Room mein emit karein
        io.to(`chat-${chatId}`).emit("receive-message", {
          chatId,
          message: newMessage,
        });

        console.log(`📩 Message sent in chat-${chatId} by ${socket.userId}`);
      } catch (err) {
        console.error("Socket Send Error:", err.message);
        socket.emit("error", { message: "Message failed to send" });
      }
    });

    // =========================
    // 👁️ MARK SEEN
    // =========================
    socket.on("mark-seen", async ({ chatId }) => {
      try {
        if (!socket.userId) return;

        const Chat = require("../models/ChatMessage");
        const chat = await Chat.findById(chatId);
        if (!chat) return;

        chat.messages.forEach((msg) => {
          if (!msg.seenBy?.includes(socket.userId)) {
            if (!msg.seenBy) msg.seenBy = [];
            msg.seenBy.push(socket.userId);
          }
        });

        await chat.save();

        io.to(`chat-${chatId}`).emit("seen-update", {
          chatId,
          userId: socket.userId,
        });
      } catch (err) {
        console.error("Mark seen error:", err.message);
      }
    });

    // =========================
    // 🚪 LEAVE CHAT
    // =========================
    socket.on("leave-chat", (chatId) => {
      if (socket.userId) {
        socket.leave(`chat-${chatId}`);
        console.log(`🚪 User ${socket.userId} left chat-${chatId}`);
      }
    });

    // =========================
    // ❌ DISCONNECT (Single handler only!)
    // =========================
    socket.on("disconnect", () => {
      const displayId = socket.userId ? String(socket.userId) : "Anonymous";
      console.log(`❌ Socket disconnected: ${socket.id} (User: ${displayId})`);
    });
  });
};