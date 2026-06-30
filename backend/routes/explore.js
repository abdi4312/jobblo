const express = require('express');
const router = express.Router();
const exploreController = require('../controllers/exploreController');

router.get('/favorites', exploreController.getFeaturedFavourites);
router.get('/stats', exploreController.getDashboardStats);

module.exports = router;
