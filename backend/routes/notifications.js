const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       required:
 *         - userId
 *         - type
 *       properties:
 *         _id:
 *           type: string
 *           description: Notifikasjon-ID
 *         userId:
 *           type: string
 *           description: ID til brukeren som mottar notifikasjonen
 *         type:
 *           type: string
 *           description: Type notifikasjon (message, order, system, test, etc.)
 *         content:
 *           type: string
 *           description: Innholdet i notifikasjonen
 *         read:
 *           type: boolean
 *           description: Om notifikasjonen er lest
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Når notifikasjonen ble opprettet
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Når notifikasjonen sist ble oppdatert
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Hent alle notifikasjoner for en bruker
 *     tags: [Notifikasjoner]
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID til brukeren som henter notifikasjonene
 *     responses:
 *       200:
 *         description: Liste over brukerens notifikasjoner
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Ugyldig bruker-ID eller mangler userId parameter
 *       404:
 *         description: Bruker ikke funnet
 *       500:
 *         description: Server-feil
 */
router.get('/', notificationController.getAllNotifications);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Marker en notifikasjon som lest
 *     tags: [Notifikasjoner]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for notifikasjonen som skal markeres som lest
 *     responses:
 *       200:
 *         description: Notifikasjon markeret som lest
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Ugyldig notifikasjon-ID format
 *       404:
 *         description: Notifikasjon ikke funnet
 *       500:
 *         description: Server-feil
 */
router.put('/:id/read', notificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: Opprett en test-notifikasjon
 *     tags: [Notifikasjoner]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID til brukeren som skal motta test-notifikasjonen
 *               type:
 *                 type: string
 *                 description: Type notifikasjon (valgfri, standard er 'test')
 *               content:
 *                 type: string
 *                 description: Innhold i notifikasjonen (valgfri, standard tekst brukes)
 *     responses:
 *       201:
 *         description: Test-notifikasjon opprettet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Ugyldig input eller mangler userId
 *       404:
 *         description: Bruker ikke funnet
 *       500:
 *         description: Server-feil
 */
router.post('/test', notificationController.createTestNotification);

module.exports = router;
