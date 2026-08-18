const express = require('express');
const router = express.Router();
const multer = require('multer');
const SafePayCheckoutController = require('../controllers/SafePayCheckoutController');
const safePayController = require('../controllers/safepayController');
const { authenticate } = require('../middleware/auth');

router.get('/details/:orderId', authenticate, SafePayCheckoutController.getCheckoutDetails);
router.post('/create-session', authenticate, SafePayCheckoutController.createSafePaySession);

// Review photos: multipart in, Cloudinary URLs back. `approve` then carries the URLs.
// The 8 MB cap is the server's own floor — the browser compresses to a few hundred KB
// before it gets here (frontend/src/utils/compressImage.ts), so hitting this means
// something other than the web form is calling.
const reviewPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    const err = new Error('Ugyldig filtype. Last opp JPG, PNG eller WEBP.');
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  },
});

router.post(
  '/review-photos/:orderId',
  authenticate,
  reviewPhotoUpload.array('photos', 6),
  SafePayCheckoutController.uploadReviewPhotos
);
router.post('/approve', authenticate, SafePayCheckoutController.approveAndPayout);
router.get('/status/:sessionId', authenticate, SafePayCheckoutController.checkoutSessionStatus);
// New checklist endpoint
router.put(
  '/contract/:orderId/checklist/:itemId',
  authenticate,
  safePayController.updateChecklistItem
);

module.exports = router;
