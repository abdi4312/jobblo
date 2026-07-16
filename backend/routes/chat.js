const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const ALLOWED_MIME = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf', 'video/mp4',
    ];
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Ugyldig filtype. Tillatte: JPEG, PNG, WEBP, GIF, PDF, MP4.'));
    }
  },
});

const chatController = require('../controllers/chatController');
const { submitChatReport, getMyChatReports, reportSubmitLimiter } = require('../controllers/chatReportController');
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

// ── Chat Reports (user-facing) ─────────────────────────────────────────────
// POST /api/chats/:chatId/reports — with optional evidence files (max 5, 10 MB each)
router.post(
  '/:chatId/reports',
  authenticate,
  reportSubmitLimiter,
  upload.array('evidence', 5),
  submitChatReport
);
// GET /api/chats/:chatId/reports/me — the authenticated user's own reports for this chat
router.get('/:chatId/reports/me', authenticate, getMyChatReports);

module.exports = router;
