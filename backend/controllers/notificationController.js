const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');

// GET /api/notifications - Get all notifications for a user
exports.getAllNotifications = async (req, res) => {
    try {
        const { userId } = req.query;
        
        // If no userId in query, return error
        if (!userId) {
            return res.status(400).json({ error: 'userId query parameter is required' });
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
        
        // Get all notifications for user 
        const notifications = await Notification.find({ userId })
            .populate('userId', 'name email');
        
        res.json(notifications);
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