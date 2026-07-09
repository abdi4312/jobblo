const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
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

module.exports = router;
