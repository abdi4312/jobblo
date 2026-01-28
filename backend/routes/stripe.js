const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createCheckoutSession, checkoutSessionStatus, createExtraContactPayment, createUrgentPayment, createUrgentPaymentInitial, urgentPaymentSuccess } = require('../controllers/stripeController');

router.post('/create-checkout-session', authenticate, createCheckoutSession);
router.get('/checkout-session/:sessionId', authenticate, checkoutSessionStatus);
router.post('/create-extra-contact-payment', authenticate, createExtraContactPayment);
router.post('/create-urgent-payment', authenticate, createUrgentPayment);
router.post('/create-urgent-payment-initial', authenticate, createUrgentPaymentInitial);
router.post('/urgent-payment-success', urgentPaymentSuccess);


module.exports = router;