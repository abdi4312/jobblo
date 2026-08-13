const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const payoutController = require('../controllers/payoutController');

// Worker self
router.get('/status', authenticate, payoutController.getOwnStatus);
router.post('/onboarding-link', authenticate, payoutController.postOnboardingLink);
router.post('/refresh', authenticate, payoutController.postRefreshStatus);
router.get('/', authenticate, payoutController.listPayouts);
router.post('/:payoutId/retry', authenticate, payoutController.postRetry);
router.get('/order/:orderId', authenticate, payoutController.getByOrder);

// Admin
router.post('/admin/release', authenticate, payoutController.adminForceRelease);

module.exports = router;
