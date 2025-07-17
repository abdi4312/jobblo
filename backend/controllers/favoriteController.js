const Favorite = require('../models/Favorite');

exports.getFavorites = async (req, res) => {
    try {
        // For now, return all favorites since auth is disabled
        const favs = await Favorite.find().populate('job');
        res.json(favs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.addFavorite = async (req, res) => {
    try {
        const { userId, jobId } = req.body;
        if (!userId || !jobId) {
            return res.status(400).json({ error: 'userId and jobId are required' });
        }
        const fav = await Favorite.create({ user: userId, job: jobId });
        res.status(201).json(fav);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.removeFavorite = async (req, res) => {
    try {
        const { userId, jobId } = req.body;
        if (!userId || !jobId) {
            return res.status(400).json({ error: 'userId and jobId are required' });
        }
        await Favorite.findOneAndDelete({ user: userId, job: jobId });
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
