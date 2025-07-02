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
 *       properties:
 *         sender:
 *           type: string
 *           description: ID til avsenderen
 *         receiver:
 *           type: string
 *           description: ID til mottakeren
 *         content:
 *           type: string
 *           description: Meldingens innhold
 *         read:
 *           type: boolean
 *           description: Om meldingen er lest
 */

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Hent alle meldinger for innlogget bruker
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
router.get('/', (req, res) => {
    res.json([]);
});

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
router.get('/:id', (req, res) => {
    res.status(404).json({ message: 'Melding ikke funnet' });
});

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
router.post('/', (req, res) => {
    res.status(201).json({ message: 'Melding sendt' });
});

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
router.delete('/:id', (req, res) => {
    res.status(204).end();
});

module.exports = router; 