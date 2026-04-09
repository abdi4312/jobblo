const Notification = require("../models/Notification");
const User = require("../models/User");
const mongoose = require("mongoose");

// GET /api/notifications - Get all notifications for a user
exports.getAllNotifications = async (req, res) => {
  try {
    const { userId, page = 1, limit = 5 } = req.query;

    if (!userId) {
      return res
        .status(400)
        .json({ error: "userId query parameter is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Pagination calculation
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Filter criteria
    const query = {
      $or: [{ userId: userId }, { userId: null, isSystem: true }],
    };

    // 1. Get total count for frontend pagination controls
    const total = await Notification.countDocuments(query);

    // 2. Fetch paginated notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "name email")
      .populate("senderId", "name lastName avatarUrl");

    // Response format with metadata
    res.json({
      success: true,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/notifications/:id/read - Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ error: "Invalid notification ID format" });
    }

    // Check if notification exists
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    // Update notification to be read
    const updatedNotification = await Notification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true },
    )
      .populate("userId", "name email")
      .populate("senderId", "name lastName avatarUrl");

    res.json(updatedNotification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/notifications/read-all - Mark all notifications as read for a user
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } },
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/notifications/:id - Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const deleted = await Notification.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/notifications/unread-count - Get unread count for a user
exports.getUnreadCount = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const count = await Notification.countDocuments({
      userId,
      read: false,
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper function to create and emit notification (can be used elsewhere)
exports.createAndEmitNotification = async (io, data) => {
  try {
    const notification = await Notification.create(data);
    const populated = await Notification.findById(notification._id)
      .populate("userId", "name email")
      .populate("senderId", "name lastName avatarUrl");

    // Emit to the specific user room
    if (data.userId) {
      io.to(data.userId.toString()).emit("new_notification", populated);
    } else if (data.isSystem) {
      io.emit("new_notification", populated); // System notification to everyone
    }

    return populated;
  } catch (error) {
    console.error("Error creating/emitting notification:", error);
  }
};

// POST /api/notifications/test - Create test notification
exports.createTestNotification = async (req, res) => {
  try {
    const { userId, type, content } = req.body;
    const io = req.app.get("io");

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create test notification
    const testNotification = await exports.createAndEmitNotification(io, {
      userId,
      type: type || "test",
      content: content || "Dette er en test-notifikasjon fra Jobblo API",
    });

    res.status(201).json(testNotification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/notifications/system - Create system notification for all users (admin only)
exports.createSystemNotification = async (req, res) => {
  try {
    const { type, content } = req.body;
    const io = req.app.get("io");

    if (!type || !content) {
      return res.status(400).json({ error: "Type & content required" });
    }

    const notification = await exports.createAndEmitNotification(io, {
      type,
      content,
      isSystem: true,
      userId: null,
    });

    res.status(201).json({
      success: true,
      message: "System notification created",
      data: notification,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
