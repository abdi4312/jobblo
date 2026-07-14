const express = require('express');
const router = express.Router();
const safePayController = require('../controllers/safepayController');
const disputeController = require('../controllers/disputeController');
const { authenticate } = require('../middleware/auth');

router.post('/create-contract', authenticate, safePayController.createContract);
router.get('/contract/:orderId', authenticate, safePayController.getContract);
router.post('/contract/:orderId/start', authenticate, safePayController.startJob);
router.post('/contract/:orderId/complete', authenticate, safePayController.completeJobAndPayout);
router.get('/history/:userId', authenticate, safePayController.getSafePayHistory);

// ── Dispute endpoints for users ────────────────────────────────────────────
router.post('/contract/:orderId/dispute', authenticate, disputeController.openDisputeByUser);
router.get('/contract/:orderId/dispute', authenticate, disputeController.getDisputeByOrder);
router.post('/disputes/:disputeId/message', authenticate, disputeController.addUserDisputeMessage);

module.exports = router;
