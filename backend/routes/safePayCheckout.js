const express = require('express');
const router = express.Router();
const SafePayCheckoutController = require('../controllers/SafePayCheckoutController');
const safePayController = require('../controllers/safepayController');
const { authenticate } = require('../middleware/auth');

router.get('/details/:orderId', authenticate, SafePayCheckoutController.getCheckoutDetails);
router.post('/create-session', authenticate, SafePayCheckoutController.createSafePaySession);
router.post('/approve', authenticate, SafePayCheckoutController.approveAndPayout);
router.get('/status/:sessionId', authenticate, SafePayCheckoutController.checkoutSessionStatus);
// New checklist endpoint
router.put(
  '/contract/:orderId/checklist/:itemId',
  authenticate,
  safePayController.updateChecklistItem
);

module.exports = router;
