const express = require('express');
const router = express.Router();
const heroController = require('../controllers/heroController');

// Public route to get active heroes (used by the Explore banner carousel)
router.get('/', heroController.GetHero);

module.exports = router;
