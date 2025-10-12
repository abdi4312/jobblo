const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       required:
 *         - orderId
 *         - senderId
 *       properties:
 *         orderId:
 *           type: string
 *           description: ID til ordren meldingen tilhører
 *         senderId:
 *           type: string
 *           description: ID til avsenderen
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
 */

/**
 * @swagger
 * /api/messages/updates:
 *   get:
 *     summary: Hent oppdateringer (nye meldinger, endringer i status, lesebekreftelser)
 *     tags: [Meldinger]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID til brukeren som henter oppdateringene
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *         description: Hent kun meldinger oppdatert etter dette tidspunktet (ISO 8601 format, f.eks. 2024-10-12T10:00:00Z)
 *       - in: query
 *         name: orderId
 *         schema:
 *           type: string
 *         required: false
 *         description: Valgfritt - filtrer oppdateringer for en spesifikk ordre
 *     responses:
 *       200:
 *         description: Liste over oppdaterte meldinger
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 updates:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 count:
 *                   type: number
 *                   description: Antall oppdateringer
 *                 lastChecked:
 *                   type: string
 *                   format: date-time
 *                   description: Tidsstempel for når denne forespørselen ble behandlet (bruk dette som 'since' parameter neste gang)
 *       400:
 *         description: Ugyldig input (mangler userId/since, eller ugyldig format)
 */
router.get('/updates', messageController.getMessageUpdates);

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Hent alle meldinger for innlogget bruker
 *     tags: [Meldinger]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID til brukeren som henter meldingene
 *     responses:
 *       200:
 *         description: Liste over brukerens meldinger
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       400:
 *         description: Ugyldig bruker-ID eller mangler userId parameter
 */
router.get('/', messageController.getAllMessages);

/**
 * @swagger
 * /api/messages/{id}:
 *   get:
 *     summary: Hent en spesifikk melding
 *     tags: [Meldinger]
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
 *       404:
 *         description: Meldingen ble ikke funnet
 */
router.get('/:id', messageController.getMessageById);

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Send en ny melding
 *     tags: [Meldinger]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - senderId
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: ID til ordren meldingen tilhører
 *               senderId:
 *                 type: string
 *                 description: ID til avsenderen
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
 *       404:
 *         description: Ordre eller bruker ikke funnet
 */
router.post('/', messageController.createMessage);

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Slett en melding
 *     tags: [Meldinger]
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
 *       404:
 *         description: Meldingen ble ikke funnet
 */
router.delete('/:id', messageController.deleteMessage);

module.exports = router; 