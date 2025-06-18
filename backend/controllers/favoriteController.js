const Favorite = require('../models/Favorite');

exports.getFavorites = async (req, res) => {
    const favs = await Favorite.find({ user: req.user.id }).populate('job');
    res.json(favs);
};

exports.addFavorite = async (req, res) => {
    const fav = await Favorite.create({ user: req.user.id, job: req.params.jobId });
    res.status(201).json(fav);
};

exports.removeFavorite = async (req, res) => {
    await Favorite.findOneAndDelete({ user: req.user.id, job: req.params.jobId });
    res.status(204).end();
};
