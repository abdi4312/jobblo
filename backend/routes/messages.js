const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: Meldingssystem
 */

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Hent alle meldinger relatert til brukerens ordre
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste med meldinger
 */
router.get('/', authenticate, messageController.getAllMessages);


/**
 * @swagger
 * /api/messages/order/{orderId}:
 *   get:
 *     summary: Hent alle meldinger for en ordre
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *     responses:
 *       200:
 *         description: Meldinger fra order
 */
router.get('/order/:orderId', authenticate, messageController.getMessagesForOrder);


/**
 * @swagger
 * /api/messages/{id}:
 *   get:
 *     summary: Hent melding etter ID
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, messageController.getMessageById);


/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Send melding
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, messageController.createMessage);


/**
 * @swagger
 * /api/messages/{id}/read:
 *   patch:
 *     summary: Marker en melding som lest
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/read', authenticate, messageController.markAsRead);


/**
 * @swagger
 * /api/messages/order/{orderId}/read:
 *   patch:
 *     summary: Marker ALLE meldinger i en ordre som lest
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/order/:orderId/read', authenticate, messageController.markOrderMessagesAsRead);


/**
 * @swagger
 * /api/messages/{id}/delete-for-me:
 *   patch:
 *     summary: Skjuler melding for bruker (soft delete)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/delete-for-me', authenticate, messageController.deleteForMe);


/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Slett melding permanent (kun avsender)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticate, messageController.deleteMessage);

module.exports = router;
r;