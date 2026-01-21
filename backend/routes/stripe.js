const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createCheckoutSession ,checkoutSessionStatus,createExtraContactPayment} = require('../controllers/stripeController');

router.post('/create-checkout-session', authenticate, createCheckoutSession);
router.get('/checkout-session/:sessionId', authenticate, checkoutSessionStatus);
router.post('/create-extra-contact-payment', authenticate, createExtraContactPayment);


module.exports = router;