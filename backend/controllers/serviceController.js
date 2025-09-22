const Service = require('../models/Service');
const mongoose = require('mongoose'); 

exports.getAllServices = async (req, res) => {
    try {
        const services = await Service.find().populate('userId', 'name');
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getServiceById = async (req, res) => {
    try {
        const service = await Service.findById(req.params.id).populate('userId', 'name');
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json(service);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createService = async (req, res) => {
    try {
        const { userId, ...serviceData } = req.body;
        
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }

        // Check if user exists
        const User = require('../models/User');
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const service = await Service.create({ ...serviceData, userId });
        res.status(201).json(service);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.updateService = async (req, res) => {
    try {
        const serviceId = req.params.id;
        
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }

        // Check if service exists
        const existingService = await Service.findById(serviceId);
        if (!existingService) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // If userId is being updated, validate it
        if (req.body.userId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
                return res.status(400).json({ error: 'Invalid user ID format' });
            }
            
            const User = require('../models/User');
            const user = await User.findById(req.body.userId);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
        }

        const service = await Service.findByIdAndUpdate(serviceId, { $set: req.body }, { new: true });
        res.json(service);
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid data format' });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteService = async (req, res) => {
    try {
        const service = await Service.findByIdAndDelete(req.params.id);
        if (!service) return res.status(404).json({ error: 'Service not found' });
        res.json({ message: 'Service deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
