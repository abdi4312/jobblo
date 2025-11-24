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
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         orderId:
 *           type: string
 *         senderId:
 *           type: string
 *         receiverId:
 *           type: string
 *         content:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         read:
 *           type: boolean
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
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
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
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
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meldinger fra ordre
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Enkeltmelding
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, receiverId, content]
 *             properties:
 *               orderId:
 *                 type: string
 *               receiverId:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Melding sendt
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meldingen er markert som lest
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
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Alle meldinger er markert som lest
 */
router.patch('/order/:orderId/read', authenticate, messageController.markOrderMessagesAsRead);


/**
 * @swagger
 * /api/messages/{id}/delete-for-me:
 *   patch:
 *     summary: Skjul melding for bruker (soft delete)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meldingen ble skjult
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Meldingen ble slettet permanent
 */
router.delete('/:id', authenticate, messageController.deleteMessage);

module.exports = router;
