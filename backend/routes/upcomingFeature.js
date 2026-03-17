const express = require('express');
const router = express.Router();
const upcomingFeatureController = require('../controllers/upcomingFeatureController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Public route to get roadmap
router.get('/', upcomingFeatureController.getAllFeatures);

// Admin routes
router.post('/', authenticate, requireAdmin, upcomingFeatureController.createFeature);
router.put('/:id', authenticate, requireAdmin, upcomingFeatureController.updateFeature);
router.delete('/:id', authenticate, requireAdmin, upcomingFeatureController.deleteFeature);

module.exports = router;
