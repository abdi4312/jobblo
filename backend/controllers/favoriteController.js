const Favorite = require('../models/Favorite');
const User = require('../models/User');
const Service = require('../models/Service');
const mongoose = require('mongoose');

// ------------------------------
// GET FAVORITES
// ------------------------------
exports.getFavorites = async (req, res) => {
    try {
        const userId = req.userId; // Fra token

        const favs = await Favorite.find({ user: userId })
            .populate('service')
            .populate('user', 'name avatarUrl');

        res.json(favs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// ------------------------------
// ADD FAVORITE
// ------------------------------
exports.addFavorite = async (req, res) => {
    try {
        const userId = req.userId; // Fra token
        const serviceId = req.params.serviceId;

        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }

        const service = await Service.findById(serviceId);
        if (!service) {
            return res.status(404).json({ error: 'Service not found' });
        }

        const existingFavorite = await Favorite.findOne({
            user: userId,
            service: serviceId
        });

        if (existingFavorite) {
            return res.status(400).json({ error: 'Already favorited' });
        }

        const fav = await Favorite.create({ user: userId, service: serviceId });
        return res.status(201).json(fav);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};

// ------------------------------
// REMOVE FAVORITE
// ------------------------------
exports.removeFavorite = async (req, res) => {
    try {
        const userId = req.userId; // Fra token
        const serviceId = req.params.serviceId;

        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ error: 'Invalid service ID format' });
        }

        const deleted = await Favorite.findOneAndDelete({
            user: userId,
            service: serviceId
        });

        if (!deleted) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        return res.status(204).end();

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
