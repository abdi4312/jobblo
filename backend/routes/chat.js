const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const chatController = require('../controllers/chatController');
const chatReportController = require('../controllers/chatReportController');
const { authenticate } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/checkSubscription');

router.post('/create', authenticate, checkSubscription, chatController.createOrGetChat);
router.get('/get', authenticate, chatController.getMyChats);
router.get('/:chatId', authenticate, chatController.getChatById);
router.post('/:chatId/message', authenticate, chatController.sendMessage);
router.post('/:chatId/payments', authenticate, chatController.createPaymentSession);
router.post('/:chatId/contracts', authenticate, chatController.createContract);
router.patch('/:chatId/agreed-price', authenticate, chatController.updateAgreedPrice);
router.delete('/:chatId', authenticate, chatController.deleteChat);
router.patch('/:chatId/delete-for-me', authenticate, chatController.deleteForMe);

// ── Chat reports (user-facing) ────────────────────────────────────────────────
router.post('/:chatId/reports', authenticate, chatReportController.submitReport);
router.post('/:chatId/reports/evidence', authenticate, upload.array('files', 5), chatReportController.uploadEvidence);
router.get('/:chatId/reports/me', authenticate, chatReportController.getMyReports);

module.exports = router;
