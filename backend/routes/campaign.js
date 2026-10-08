const express = require('express');
const rateLimit = require('express-rate-limit');
const campaignController = require('../controllers/campaignController');

const router = express.Router();
const campaignEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many campaign events. Try again shortly.' },
});

router.get('/public', campaignController.getPublicCampaign);
router.get('/terms', campaignController.getTerms);
router.post('/events', campaignEventLimiter, campaignController.trackEvent);

module.exports = router;
