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
 *         - sender
 *         - receiver
 *         - content
 *         - conversationId
 *       properties:
 *         sender:
 *           type: string
 *           description: ID til avsenderen
 *         receiver:
 *           type: string
 *           description: ID til mottakeren
 *         job:
 *           type: string
 *           description: ID til jobben meldingen gjelder
 *         content:
 *           type: string
 *           description: Meldingens innhold
 *         conversationId:
 *           type: string
 *           description: ID for samtalen
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Når meldingen ble opprettet
 *         
 */

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Hent alle meldinger
 *     tags: [Meldinger]
 *     responses:
 *       200:
 *         description: Liste over meldinger
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
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
 *             $ref: '#/components/schemas/Message'
 *     responses:
 *       201:
 *         description: Melding sendt
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
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