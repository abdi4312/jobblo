const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       required:
 *         - orderId
 *       properties:
 *         _id:
 *           type: string
 *           description: Meldingens ID
 *         orderId:
 *           type: string
 *           description: ID til ordren meldingen tilhører
 *         senderId:
 *           type: string
 *           description: ID til avsenderen (settes automatisk fra JWT token)
 *         message:
 *           type: string
 *           description: Meldingens innhold
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Bilde-URLer
 *         type:
 *           type: string
 *           enum: [text, image, system]
 *           description: Type melding
 *         readBy:
 *           type: array
 *           items:
 *             type: string
 *           description: Liste over brukere som har lest meldingen
 *         deletedFor:
 *           type: array
 *           items:
 *             type: string
 *           description: Liste over brukere som har slettet meldingen
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Når meldingen ble opprettet
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Når meldingen sist ble oppdatert
 */


/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Hent alle meldinger for innlogget bruker
 *     tags: [Meldinger]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste over brukerens meldinger
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       401:
 *         description: Mangler eller ugyldig autentisering
 */
router.get('/', authenticate, messageController.getAllMessages);

/**
 * @swagger
 * /api/messages/{id}:
 *   get:
 *     summary: Hent en spesifikk melding
 *     tags: [Meldinger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for meldingen
 *     responses:
 *       200:
 *         description: En melding
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       401:
 *         description: Mangler eller ugyldig autentisering
 *       403:
 *         description: Ikke autorisert til å se denne meldingen
 *       404:
 *         description: Meldingen ble ikke funnet
 */
router.get('/:id', authenticate, messageController.getMessageById);

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Send en ny melding
 *     tags: [Meldinger]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: ID til ordren meldingen tilhører
 *               message:
 *                 type: string
 *                 description: Meldingens innhold
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Bilde-URLer
 *               type:
 *                 type: string
 *                 enum: [text, image, system]
 *                 description: Type melding
 *     responses:
 *       201:
 *         description: Melding sendt
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Ugyldig input
 *       401:
 *         description: Mangler eller ugyldig autentisering
 *       403:
 *         description: Ikke autorisert til å sende melding i denne ordren
 *       404:
 *         description: Ordre eller bruker ikke funnet
 */
router.post('/', authenticate, messageController.createMessage);

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Slett en melding
 *     tags: [Meldinger]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for meldingen
 *     responses:
 *       204:
 *         description: Melding slettet
 *       401:
 *         description: Mangler eller ugyldig autentisering
 *       403:
 *         description: Ikke autorisert til å slette denne meldingen
 *       404:
 *         description: Meldingen ble ikke funnet
 */
router.delete('/:id', authenticate, messageController.deleteMessage);

module.exports = router; 