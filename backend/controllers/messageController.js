const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Order = require('../models/Order');
const User = require('../models/User');
const mongoose = require('mongoose');

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
            .populate('orderId', 'serviceId customerId providerId status')
            .sort({ createdAt: 1 });

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
        const orderId = req.params.orderId;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (order.customerId.toString() !== req.userId &&
            order.providerId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const messages = await Message.find({
            orderId,
            deletedFor: { $ne: req.userId }
        })
            .populate('senderId', 'name email')
            .sort({ createdAt: 1 });

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
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid message ID format' });
        }

        const message = await Message.findById(req.params.id)
            .populate('senderId', 'name email')
            .populate('orderId', 'serviceId customerId providerId status');

        if (!message) return res.status(404).json({ error: 'Message not found' });

        const order = message.orderId;

        if (message.senderId._id.toString() !== req.userId &&
            order.customerId.toString() !== req.userId &&
            order.providerId.toString() !== req.userId) {
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
        const { orderId, message: text, images, type } = req.body;
        const senderId = req.userId;

        if (!orderId)
            return res.status(400).json({ error: 'Order ID is required' });

        if (!text && (!images || images.length === 0))
            return res.status(400).json({ error: 'Message must contain text or images' });

        if (!mongoose.Types.ObjectId.isValid(orderId))
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
            message: text,
            images: images || [],
            type: type || 'text'
        });

        await message.populate('senderId', 'name email');

        const otherUser =
            order.customerId.toString() === senderId
                ? order.providerId
                : order.customerId;

        const io = req.app.get('io');

        if (io) {
            io.to(otherUser.toString()).emit('message:new', message);
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
        const messageId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(messageId))
            return res.status(400).json({ error: 'Invalid message ID format' });

        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        if (!message.readBy.includes(req.userId)) {
            message.readBy.push(req.userId);
            await message.save();
        }

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
        const orderId = req.params.orderId;

        await Message.updateMany(
            {
                orderId,
                readBy: { $ne: req.userId }
            },
            { $push: { readBy: req.userId } }
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
        const messageId = req.params.id;

        await Message.findByIdAndUpdate(messageId, {
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
        const message = await Message.findById(req.params.id);
        if (!message) return res.status(404).json({ error: 'Message not found' });

        if (message.senderId.toString() !== req.userId)
            return res.status(403).json({ error: 'Not allowed' });

        await Message.findByIdAndDelete(req.params.id);

        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
