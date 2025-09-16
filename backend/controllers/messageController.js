const Message = require('../models/Message');
const mongoose = require('mongoose');

exports.getAllMessages = async (req, res) => {
    try {
        // For now, we'll get userId from query params since there's no auth middleware
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId query parameter is required' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        // Find messages where the user is either sender or part of the order
        const messages = await Message.find({
            $or: [
                { senderId: userId },
                { 
                    orderId: { 
                        $in: await require('../models/Orders').find({
                            $or: [
                                { customerId: userId },
                                { providerId: userId }
                            ]
                        }).distinct('_id')
                    }
                }
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
        res.json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createMessage = async (req, res) => {
    try {
        const { orderId, senderId, message: messageContent, images, type } = req.body;
        
        // Validate required fields
        if (!orderId) {
            return res.status(400).json({ error: 'Order ID is required' });
        }
        if (!senderId) {
            return res.status(400).json({ error: 'Sender ID is required' });
        }
        
        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: 'Invalid order ID format' });
        }
        if (!mongoose.Types.ObjectId.isValid(senderId)) {
            return res.status(400).json({ error: 'Invalid sender ID format' });
        }
        
        // Check if order exists
        const Order = require('../models/Orders');
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        // Check if sender exists
        const User = require('../models/User');
        const user = await User.findById(senderId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const message = await Message.create({
            orderId,
            senderId,
            message: messageContent,
            images: images || [],
            type: type || 'text'
        });
        
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
        const message = await Message.findByIdAndDelete(req.params.id);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};