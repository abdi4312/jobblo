const express = require('express');
const router = express.Router();
const subscriptionRebuildInProgress = require('../middleware/subscriptionRebuildInProgress');
const { authenticate, requireAdmin } = require('../middleware/auth');
const subscriptionV2Controller = require('../controllers/subscriptionV2Controller');

function compatibilityGate(...enabledFlags) {
  return (req, res, next) => {
    if (!enabledFlags.every((enabled) => enabled())) return subscriptionRebuildInProgress(req, res);
    return next();
  };
}

router.post('/v2/create-checkout-session', authenticate, subscriptionV2Controller.createCheckoutSession);
router.get('/v2/subscription', authenticate, subscriptionV2Controller.getCurrentSubscription);
router.post('/v2/subscription/portal', authenticate, subscriptionV2Controller.createBillingPortalSession);
router.post('/v2/subscription/cancel', authenticate, subscriptionV2Controller.cancelSubscription);
router.post('/v2/subscription/resume', authenticate, subscriptionV2Controller.resumeSubscription);
router.post('/v2/subscription/change/preview', authenticate, subscriptionV2Controller.previewPlanChange);
router.post('/v2/subscription/change', authenticate, subscriptionV2Controller.changePlan);
router.post(
  '/v2/admin/reconcile-paid-upgrade',
  authenticate,
  requireAdmin,
  subscriptionV2Controller.reconcilePaidUpgrade
);
router.get('/v2/entitlements', authenticate, subscriptionV2Controller.getEntitlements);
router.post(
  '/create-checkout-session',
  compatibilityGate(require('../services/subscriptions/v2Checkout').checkoutEnabled),
  authenticate,
  subscriptionV2Controller.createCheckoutSession
);
router.get(
  '/checkout-session/:sessionId',
  compatibilityGate(require('../services/subscriptions/v2Checkout').checkoutEnabled),
  authenticate,
  subscriptionV2Controller.getCheckoutStatus
);
router.post('/create-extra-contact-payment', subscriptionRebuildInProgress);
router.get('/extra-contact-status/:sessionId', subscriptionRebuildInProgress);
router.get(
  '/subscription',
  authenticate,
  subscriptionV2Controller.getLegacySubscription
);
router.post(
  '/subscription/cancel',
  compatibilityGate(subscriptionV2Controller.managementEnabled),
  authenticate,
  subscriptionV2Controller.legacyCancelSubscription
);
router.post(
  '/subscription/resume',
  compatibilityGate(subscriptionV2Controller.managementEnabled),
  authenticate,
  subscriptionV2Controller.legacyResumeSubscription
);
router.post(
  '/subscription/portal',
  compatibilityGate(subscriptionV2Controller.managementEnabled),
  authenticate,
  subscriptionV2Controller.legacyCreateBillingPortalSession
);
router.get(
  '/subscription/billing-history',
  compatibilityGate(subscriptionV2Controller.managementEnabled),
  authenticate,
  subscriptionV2Controller.getBillingHistory
);
router.get(
  '/subscription/invoices/:invoiceId/pdf',
  compatibilityGate(subscriptionV2Controller.managementEnabled),
  authenticate,
  subscriptionV2Controller.getInvoicePdf
);
router.post(
  '/subscription/change/preview',
  compatibilityGate(subscriptionV2Controller.managementEnabled),
  authenticate,
  subscriptionV2Controller.legacyPreviewPlanChange
);
router.post(
  '/subscription/change',
  compatibilityGate(subscriptionV2Controller.managementEnabled),
  authenticate,
  subscriptionV2Controller.legacyChangePlan
);
router.post(
  '/subscription/change/cancel',
  compatibilityGate(subscriptionV2Controller.managementEnabled),
  authenticate,
  subscriptionV2Controller.legacyCancelScheduledPlanChange
);

module.exports = router;
