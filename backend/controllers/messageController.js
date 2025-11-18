const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getAllMessages = async (req, res) => {
    try {
        // Get userId from JWT middleware
        const userId = req.userId;

        // Get user's orders first
        const userOrders = await Order.find({
            $or: [
                { customerId: userId },
                { providerId: userId }
            ]
        }).select('_id').lean();

        const orderIds = userOrders.map(o => o._id);

        // Find messages where user is sender or part of the order
        const messages = await Message.find({
            $or: [
                { senderId: userId },
                { orderId: { $in: orderIds } }
            ]
        })
        .populate('senderId', 'name email')
        .populate('orderId', 'serviceId customerId providerId status')
        .populate('readBy', 'name');

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getMessageById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid message ID format' });
        }
        const message = await Message.findById(req.params.id)
            .populate('senderId', 'name email')
            .populate('orderId', 'serviceId customerId providerId status')
            .populate('readBy', 'name');
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Authorization: user must be sender OR part of the order
        const order = message.orderId;
        if (message.senderId._id.toString() !== req.userId &&
            order.customerId.toString() !== req.userId &&
            order.providerId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Not authorized to view this message' });
        }

        res.json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createMessage = async (req, res) => {
    try {
        const { orderId, message: messageContent, images, type } = req.body;
        const senderId = req.userId; // Get from authenticated user

        // Validate required fields
        if (!orderId) {
            return res.status(400).json({ error: 'Order ID is required' });
        }

        // Validate message has content (either text or images)
        if (!messageContent && (!images || images.length === 0)) {
            return res.status(400).json({ error: 'Message must contain either text content or images' });
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }

        // Check if order exists
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if sender has access to this order
        if (order.customerId.toString() !== senderId && order.providerId.toString() !== senderId) {
            return res.status(403).json({ error: 'Not authorized to send messages in this order' });
        }

        // Get sender's user info (already authenticated, so we know they exist)
        const user = req.user;

        const message = await Message.create({
            orderId,
            senderId,
            message: messageContent,
            images: images || [],
            type: type || 'text'
        });

        // Populate sender info for the response
        await message.populate('senderId', 'name email');

        // Emit WebSocket event to the other participant
        const otherParticipantId = order.customerId.toString() === senderId ? order.providerId : order.customerId;
        const io = req.app.get('io');

        // Save notification to database
        let notification;
        try {
            notification = await Notification.create({
                userId: otherParticipantId,
                type: 'message',
                content: `New message from ${user.name}`
            });
        } catch (notificationError) {
            console.error('Failed to save notification to database:', notificationError.message);
        }

        if (io) {
            // Emit new message event to recipient
            io.to(otherParticipantId.toString()).emit('message:new', {
                messageId: message._id,
                orderId: message.orderId,
                senderId: message.senderId,
                senderName: user.name,
                message: messageContent,
                type: message.type,
                images: message.images,
                createdAt: message.createdAt
            });

            // Emit notification event to recipient
            io.to(otherParticipantId.toString()).emit('notification:new', {
                notificationId: notification?._id,
                type: 'message',
                content: `New message from ${user.name}`,
                relatedOrderId: orderId,
                timestamp: new Date().toISOString()
            });
        }

        res.status(201).json(message);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid message ID format' });
        }

        // Get the message first
        const message = await Message.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Authorization: only sender can delete their message (from JWT middleware)
        if (message.senderId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Not authorized to delete this message' });
        }

        // Delete the message
        await Message.findByIdAndDelete(req.params.id);
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

