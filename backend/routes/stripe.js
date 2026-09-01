const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createCheckoutSession,
  checkoutSessionStatus,
  createExtraContactPayment,
  extraContactPaymentStatus,
  getMySubscription,
  cancelMySubscription,
  resumeMySubscription,
} = require('../controllers/stripeController');

router.post('/create-checkout-session', authenticate, createCheckoutSession);
router.get('/checkout-session/:sessionId', authenticate, checkoutSessionStatus);
router.post('/create-extra-contact-payment', authenticate, createExtraContactPayment);
router.get('/extra-contact-status/:sessionId', authenticate, extraContactPaymentStatus);

// Subscription self-service. The support page has told users to "velg «Si opp»" since
// launch, but nothing implemented it — there was no cancel endpoint anywhere in the API.
router.get('/subscription', authenticate, getMySubscription);
router.post('/subscription/cancel', authenticate, cancelMySubscription);
router.post('/subscription/resume', authenticate, resumeMySubscription);

module.exports = router;
