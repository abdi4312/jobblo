const Message = require('../models/Message');
const mongoose = require('mongoose');

exports.getAllMessages = async (req, res) => {
    try {
        const messages = await Message.find().populate('sender', 'name').populate('receiver', 'name');
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
        const message = await Message.findById(req.params.id).populate('sender', 'name').populate('receiver', 'name');
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
        const { sender, receiver, job, content } = req.body;
        
        // Validate required fields
        if (!content) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        
        // Validate ObjectIds if provided
        if (sender && !mongoose.Types.ObjectId.isValid(sender)) {
            return res.status(400).json({ error: 'Invalid sender ID format' });
        }
        if (receiver && !mongoose.Types.ObjectId.isValid(receiver)) {
            return res.status(400).json({ error: 'Invalid receiver ID format' });
        }
        if (job && !mongoose.Types.ObjectId.isValid(job)) {
            return res.status(400).json({ error: 'Invalid job ID format' });
        }
        
        const message = await Message.create(req.body);
        res.status(201).json(message);
    } catch (error) {
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
