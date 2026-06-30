const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createCheckoutSession,
  checkoutSessionStatus,
  createExtraContactPayment,
  extraContactPaymentStatus,
} = require('../controllers/stripeController');

router.post('/create-checkout-session', authenticate, createCheckoutSession);
router.get('/checkout-session/:sessionId', authenticate, checkoutSessionStatus);
router.post('/create-extra-contact-payment', authenticate, createExtraContactPayment);
router.get('/extra-contact-status/:sessionId', authenticate, extraContactPaymentStatus);

module.exports = router;
