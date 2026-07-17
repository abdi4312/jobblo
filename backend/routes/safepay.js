const express = require('express');
const router = express.Router();
const multer = require('multer');
const safePayController = require('../controllers/safepayController');
const disputeController = require('../controllers/disputeController');
const providerWorkController = require('../controllers/providerWorkController');
const { authenticate } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Ugyldig filtype'));
  },
});

// ── Contract (unified) ────────────────────────────────────────────────────────
router.post('/create-contract', authenticate, safePayController.createContract);
router.get('/contract/:orderId', authenticate, safePayController.getContract);

// ── Order detail (provider + customer) ───────────────────────────────────────
router.get('/orders/:orderId', authenticate, providerWorkController.getOrderDetail);

// ── Provider actions ──────────────────────────────────────────────────────────
router.post('/orders/:orderId/start', authenticate, providerWorkController.startJob);
router.post('/orders/:orderId/ready-for-review', authenticate, providerWorkController.markReadyForReview);
router.post('/orders/:orderId/evidence', authenticate, upload.array('files', 10), providerWorkController.uploadEvidence);
router.patch('/orders/:orderId/provider-checklist/:itemId', authenticate, providerWorkController.updateProviderChecklist);

// ── Customer actions ──────────────────────────────────────────────────────────
router.patch('/orders/:orderId/customer-checklist/:itemId', authenticate, providerWorkController.updateCustomerChecklist);

// ── Payment reconciliation ────────────────────────────────────────────────────
router.post('/orders/:orderId/reconcile-payment', authenticate, providerWorkController.reconcilePayment);

// ── Legacy routes (backward compat) ──────────────────────────────────────────
router.post('/contract/:orderId/start', authenticate, providerWorkController.startJob);
router.post('/contract/:orderId/complete', authenticate, safePayController.completeJobAndPayout);
router.get('/history/:userId', authenticate, safePayController.getSafePayHistory);
router.put('/contract/:orderId/checklist/:itemId', authenticate, safePayController.updateChecklistItem);

// ── Disputes ──────────────────────────────────────────────────────────────────
router.post('/contract/:orderId/dispute', authenticate, disputeController.openDisputeByUser);
router.get('/contract/:orderId/dispute', authenticate, disputeController.getDisputeByOrder);
router.post('/disputes/:disputeId/message', authenticate, disputeController.addUserDisputeMessage);
router.post('/orders/:orderId/dispute', authenticate, disputeController.openDisputeByUser);

module.exports = router;
