const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const isUserRelatedToOrder = ({ userId, order }) => {
    return (
        order.customerId.toString() === userId ||
        order.providerId.toString() === userId
    );
};

const canAccessMessage = ({ userId, order, message }) => {
    return (
        message.senderId.toString() === userId ||
        order.customerId.toString() === userId ||
        order.providerId.toString() === userId
    );
};

/**
 * GET /api/messages
 * Hent alle meldinger relatert til brukerens ordre
 */
exports.getAllMessages = async (req, res) => {
    try {
        const userId = req.userId;

        const orders = await Order.find({
            $or: [
                { customerId: userId },
                { providerId: userId }
            ]
        }).select('_id').lean();

        const orderIds = orders.map(o => o._id);

        const messages = await Message.find({
            orderId: { $in: orderIds },
            deletedFor: { $ne: userId }
        })
            .populate('senderId', 'name email')
            .populate('orderId', 'serviceId customerId providerId status');

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


/**
 * GET /api/messages/order/:orderId
 * Hent meldinger for én ordre
 */
exports.getMessagesForOrder = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!isValidId(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (!isUserRelatedToOrder({ userId: req.userId, order }))
            return res.status(403).json({ error: 'Not authorized' });

        const messages = await Message.find({
            orderId,
            deletedFor: { $ne: req.userId }
        })
            .populate('senderId', 'name email');

        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


/**
 * GET /api/messages/:id
 */
exports.getMessageById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ error: 'Invalid message ID format' });
        }

        const message = await Message.findById(id)
            .populate('senderId', 'name email')
            .populate('orderId', 'serviceId customerId providerId status');

        if (!message) return res.status(404).json({ error: 'Message not found' });

        const order = message.orderId;

        if (!canAccessMessage({userId: req.userId,order: message.orderId, message})) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (message.deletedFor.includes(req.userId)) {
            return res.status(404).json({ error: 'Message deleted' });
        }

        res.json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


/**
 * POST /api/messages
 */
exports.createMessage = async (req, res) => {
    try {
        const { orderId, content, images, type } = req.body;
        const senderId = req.userId;

        if (!orderId)
            return res.status(400).json({ error: 'Order ID is required' });

        if (!content && (!images || images.length === 0))
            return res.status(400).json({ error: 'Message must contain text or images' });

        if (!isValidId(orderId))
            return res.status(400).json({ error: 'Invalid order ID format' });

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (order.customerId.toString() !== senderId &&
            order.providerId.toString() !== senderId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const message = await Message.create({
            orderId,
            senderId,
            message: content,
            images: images || [],
            type: type || 'text'
        });

        await message.populate('senderId', 'name email');

        const otherUser =
            order.customerId.toString() === senderId
                ? order.providerId
                : order.customerId;

        // Create notification for recipient
        await Notification.create({
            userId: otherUser,
            type: 'message',
            content: `New message from ${message.senderId.name}`
        });

        // Emit message for real-time delivery to connected users
        const io = req.app.get('io');
        if (io) {
            io.to(`chat-${orderId}`).emit('message:new', message);
        }

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


/**
 * PATCH /api/messages/:id/read
 */
exports.markAsRead = async (req, res) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;

        if (!isValidId(id))
            return res.status(400).json({ error: 'Invalid message ID format' });

        const message = await Message.findById(id);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        // Check if already read
        const alreadyRead = Array.isArray(message.readReceipts) &&
            message.readReceipts.some(
                r => r.userId && r.userId.toString() === req.userId
            );

        if (alreadyRead) {
            return res.status(200).json({ success: true, message: 'Message already marked as read' });
        }

        // Mark as read
        message.readReceipts.push({ userId: req.userId, readAt: Date.now() });
        await message.save();

        res.json({ success: true, message: 'Message marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


/**
 * PATCH /api/messages/order/:orderId/read
 */
exports.markOrderMessagesAsRead = async (req, res) => {
    try {
        const { orderId } = req.params;

        if (!isValidId(orderId))
            return res.status(400).json({ error: 'Invalid order ID format' });

        await Message.updateMany(
            {
                orderId,
                'readReceipts.userId': { $ne: req.userId }
            },
            { $push:  { readReceipts: { userId: req.userId, readAt: new Date() } } }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


/**
 * PATCH /api/messages/:id/delete-for-me
 */
exports.deleteForMe = async (req, res) => {
    try {
        const { id } = req.params;

        await Message.findByIdAndUpdate(id, {
            $addToSet: { deletedFor: req.userId }
        });

        res.json({ success: true, message: 'Message hidden' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


/**
 * DELETE /api/messages/:id
 * Permanent delete — only for sender
 */
exports.deleteMessage = async (req, res) => {
    try {
        if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

        const { id } = req.params;
        
        if (!isValidId(id))
            return res.status(400).json({ error: 'Invalid message ID format' });

        const message = await Message.findById(id);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        if (message.senderId.toString() !== req.userId)
            return res.status(403).json({ error: 'Not allowed' });

        await Message.findByIdAndDelete(id);

        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
