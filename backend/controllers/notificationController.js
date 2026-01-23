const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');

// GET /api/notifications - Get all notifications for a user
exports.getAllNotifications = async (req, res) => {
    try {
        const { userId, page = 1, limit = 5 } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId query parameter is required' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        // Pagination calculation
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Filter criteria
        const query = {
            $or: [
                { userId: userId }, 
                { userId: null, isSystem: true }
            ]
        };

        // 1. Get total count for frontend pagination controls
        const total = await Notification.countDocuments(query);

        // 2. Fetch paginated notifications
        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('userId', 'name email');
        
        // Response format with metadata
        res.json({
            success: true,
            total,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            data: notifications
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
            return res.status(400).json({ error: 'Invalid notification ID format' });
        }
        
        // Check if notification exists
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        // Update notification to be read
        const updatedNotification = await Notification.findByIdAndUpdate(
            notificationId,
            { read: true },
            { new: true }
        ).populate('userId', 'name email');
        
        res.json(updatedNotification);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/notifications/test - Create test notification
exports.createTestNotification = async (req, res) => {
    try {
        const { userId, type, content } = req.body;

        // Validate required fields
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Create test notification with default values if not provided
        const testNotification = await Notification.create({
            userId,
            type: type || 'test',
            content: content || 'Dette er en test-notifikasjon fra Jobblo API'
        });

        // Populate user info
        await testNotification.populate('userId', 'name email');

        res.status(201).json(testNotification);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};

// POST /api/notifications/system - Create system notification for all users (admin only)
exports.createSystemNotification = async (req, res) => {
  try {
    const { type, content } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: 'Type & content required' });
    }

    const notification = await Notification.create({
      type,
      content,
      isSystem: true,
      userId: null,
    });

    res.status(201).json({
      success: true,
      message: 'System notification created',
      data: notification,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};