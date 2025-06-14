var express = require('express');
var router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     JobAd:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - category
 *         - location
 *       properties:
 *         id:
 *           type: string
 *           description: Unik ID for jobbannonsen
 *         title:
 *           type: string
 *           description: Tittel på jobbannonsen
 *         description:
 *           type: string
 *           description: Beskrivelse av jobbannonsen
 *         category:
 *           type: string
 *           description: Kategori for jobbannonsen
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: URL-er til bilder fra Azure Blob
 *         location:
 *           type: object
 *           properties:
 *             postalCode:
 *               type: string
 *             city:
 *               type: string
 *             area:
 *               type: string
 *           description: Lokasjon for jobben
 */

/**
 * @swagger
 * /api/ads:
 *   post:
 *     summary: Publiser en ny jobbannonse
 *     tags: [Jobbannonser]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/JobAd'
 *     responses:
 *       201:
 *         description: Annonsen ble opprettet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Annonse opprettet
 */
router.post('/ads', function(req, res) {
  res.status(201).json({ message: 'Annonse opprettet' });
});

/**
 * @swagger
 * /api/ads:
 *   get:
 *     summary: Hent alle jobbannonser
 *     tags: [Jobbannonser]
 *     responses:
 *       200:
 *         description: Liste over alle jobbannonser
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/JobAd'
 */
router.get('/ads', function(req, res) {
  res.json([]);
});

/**
 * @swagger
 * /api/ads/{id}:
 *   get:
 *     summary: Hent en spesifikk jobbannonse
 *     tags: [Jobbannonser]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for jobbannonsen
 *     responses:
 *       200:
 *         description: En jobbannonse
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/JobAd'
 *       404:
 *         description: Annonsen ble ikke funnet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Annonse ikke funnet
 */
router.get('/ads/:id', function(req, res) {
  res.status(404).json({ message: 'Annonse ikke funnet' });
});

/**
 * @swagger
 * /api/ads/{id}:
 *   delete:
 *     summary: Slett en jobbannonse
 *     tags: [Jobbannonser]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for jobbannonsen
 *     responses:
 *       200:
 *         description: Annonsen ble slettet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Annonse slettet
 *       404:
 *         description: Annonsen ble ikke funnet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Annonse ikke funnet
 */
router.delete('/ads/:id', function(req, res) {
  res.status(200).json({ message: 'Annonse slettet' });
});

module.exports = router; 