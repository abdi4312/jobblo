const express = require('express');
const router = express.Router();
const subscriptionRebuildInProgress = require('../middleware/subscriptionRebuildInProgress');

router.post('/create-checkout-session', subscriptionRebuildInProgress);
router.get('/checkout-session/:sessionId', subscriptionRebuildInProgress);
router.post('/create-extra-contact-payment', subscriptionRebuildInProgress);
router.get('/extra-contact-status/:sessionId', subscriptionRebuildInProgress);
router.get('/subscription', subscriptionRebuildInProgress);
router.post('/subscription/cancel', subscriptionRebuildInProgress);
router.post('/subscription/resume', subscriptionRebuildInProgress);
router.post('/subscription/portal', subscriptionRebuildInProgress);
router.get('/subscription/billing-history', subscriptionRebuildInProgress);
router.get('/subscription/invoices/:invoiceId/pdf', subscriptionRebuildInProgress);
router.post('/subscription/change/preview', subscriptionRebuildInProgress);
router.post('/subscription/change', subscriptionRebuildInProgress);

module.exports = router;
