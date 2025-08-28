const Favorite = require('../models/Favorite');
const User = require('../models/User');
const Job = require('../models/Job');
const mongoose = require('mongoose');

exports.getFavorites = async (req, res) => {
    try {
        const favs = await Favorite.find().populate('job').populate('user');
        res.json(favs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addFavorite = async (req, res) => {
    try {
        const { userId } = req.body;
        const jobId = req.params.jobId;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID format' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check if favorite already exists
        const existingFavorite = await Favorite.findOne({ user: userId, job: jobId });
        if (existingFavorite) {
            return res.status(400).json({ error: 'Favorite already exists' });
        }

        const fav = await Favorite.create({ user: userId, job: jobId });
        res.status(201).json(fav);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.removeFavorite = async (req, res) => {
    try {
        const { userId } = req.body;
        const jobId = req.params.jobId;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            return res.status(400).json({ error: 'Invalid job ID format' });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Delete favorite if it exists
        const deletedFavorite = await Favorite.findOneAndDelete({ user: userId, job: jobId });
        if (!deletedFavorite) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
