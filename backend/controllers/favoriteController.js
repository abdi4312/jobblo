const Favorite = require('../models/Favorite');
const User = require('../models/User');
const Service = require('../models/Service');
const mongoose = require('mongoose');

exports.getFavorites = async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId query parameter is required' });
        }
        
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const favs = await Favorite.find({ user: userId }).populate('service').populate('user');
        res.json(favs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addFavorite = async (req, res) => {
    try {
        const { userId } = req.body;
        const serviceId = req.params.serviceId;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if job exists
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // Check if favorite already exists
        const existingFavorite = await Favorite.findOne({ user: userId, service: serviceId });
        if (existingFavorite) {
            return res.status(400).json({ error: 'Favorite already exists' });
        }

        const fav = await Favorite.create({ user: userId, service: serviceId });
        res.status(201).json(fav);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.removeFavorite = async (req, res) => {
    try {
        const { userId } = req.body;
        const serviceId = req.params.serviceId;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if job exists
        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        // Delete favorite if it exists
        const deletedFavorite = await Favorite.findOneAndDelete({ user: userId, service: serviceId });
        if (!deletedFavorite) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
