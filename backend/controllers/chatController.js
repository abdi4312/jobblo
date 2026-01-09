const User = require("../models/User");
const Chat = require("../models/ChatMessage");
const mongoose = require("mongoose");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.createOrGetChat = async (req, res) => {
  try {
    const { providerId, serviceId } = req.body;
    let { id } = req.user;

    if (!serviceId) {
      return res.status(400).json({ message: "Service ID is required." });
    }

    if (id === providerId) {
      return res
        .status(400)
        .json({ message: "You cannot create a chat with yourself." });
    }

    const provider = await User.findById(providerId).select("role name");
    if (!provider) {
      return res.status(404).json({ message: "Provider not found." });
    }
    
    let chat = await Chat.findOne({
      clientId: id,
      providerId,
      serviceId,
    })
      .populate("clientId", "name")
      .populate("providerId", "name")
      .populate("serviceId", "title description");

    if (chat) {
      // If user previously deleted this chat, restore it by removing from deletedFor
      if (chat.deletedFor && chat.deletedFor.includes(id)) {
        await Chat.findByIdAndUpdate(chat._id, {
          $pull: { deletedFor: id },
        });
      }
      return res.status(200).json(chat);
    }

    chat = await Chat.create({
      clientId: id,
      providerId,
      serviceId,
      messages: [],
    });

    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyChats = async (req, res) => {
  try {
    const { id } = req.user;

    // Get ALL chats where user is either client or provider, and not deleted by them
    const chats = await Chat.find({
      $or: [{ clientId: id }, { providerId: id }],
      deletedFor: { $ne: id }
    })
      .populate("clientId", "name role avatarUrl")
      .populate("providerId", "name role avatarUrl")      .populate("serviceId", "title description")      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getChatById = async (req, res) => {
  try {
    const { id } = req.user;
    const { chatId } = req.params;

    if (!isValidId(chatId))
      return res.status(400).json({ error: "Invalid chat ID format" });

    const chat = await Chat.findById(chatId)
      .populate("clientId", "name avatarUrl")
      .populate("providerId", "name avatarUrl")
      .populate("serviceId", "title description")
      .populate("messages.senderId", "name avatarUrl");

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // 🔒 Authorization check: user must be either client or provider of this chat
    if (
      chat.clientId._id.toString() !== id &&
      chat.providerId._id.toString() !== id
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized: You are not part of this chat." });
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const { id } = req.user;
    const { chatId } = req.params;

    if (!isValidId(chatId))
      return res.status(400).json({ error: "Invalid chat ID format" });

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    // 🔒 Authorization check: user must be either client or provider of this chat
    if (
      chat.clientId._id.toString() !== id &&
      chat.providerId._id.toString() !== id
    ) {
      return res
        .status(403)
        .json({ message: "Unauthorized: You are not part of this chat." });
    }

    const message = {
      senderId: id,
      text,
      createdAt: new Date(),
    };

    chat.messages.push(message);
    chat.lastMessage = text;

    await chat.save();

    // Emit socket event to notify users in the chat room
    const io = req.app.get('io');
    if (io) {
      io.to(`chat-${chatId}`).emit("receive-message", {
        chatId,
        message,
      });
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /api/chat/:id/delete-for-me
 */

exports.deleteForMe = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    await Chat.findByIdAndUpdate(chatId, {
      $addToSet: { deletedFor: userId },
    });

    res.json({ success: true, message: "Chat hidden" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/chat/:id
 * Permanent delete — only for sender
 */
exports.deleteChat = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { chatId } = req.params;

    if (!isValidId(chatId))
      return res.status(400).json({ error: "Invalid chat ID format" });

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    if (
      chat.clientId.toString() !== userId &&
      chat.providerId.toString() !== userId
    )
      return res.status(403).json({ error: "Not allowed" });

    await Chat.findByIdAndDelete(chatId);

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
