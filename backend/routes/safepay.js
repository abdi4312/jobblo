const express = require('express');
const router = express.Router();
const safePayController = require('../controllers/safepayController');
const { authenticate } = require('../middleware/auth');

router.post('/create-contract', authenticate, safePayController.createContract);
router.get('/contract/:orderId', authenticate, safePayController.getContract);
router.post('/contract/:orderId/start', authenticate, safePayController.startJob);
router.post('/contract/:orderId/complete', authenticate, safePayController.completeJobAndPayout);
router.get('/history/:userId', authenticate, safePayController.getSafePayHistory);

module.exports = router;
