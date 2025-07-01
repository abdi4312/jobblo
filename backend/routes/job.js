const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Job:
 *       type: object
 *       required:
 *         - title
 *         - price
 *         - user
 *       properties:
 *         title:
 *           type: string
 *           description: Tittel på jobben
 *         description:
 *           type: string
 *           description: Beskrivelse av jobben
 *         category:
 *           type: string
 *           description: Kategori for jobben
 *         price:
 *           type: number
 *           description: Pris for jobben
 *         location:
 *           type: string
 *           description: Lokasjon for jobben
 *         imageUrl:
 *           type: string
 *           description: URL til bilde for jobben
 *         user:
 *           type: string
 *           description: ID til brukeren som la ut jobben
 */

/**
 * @swagger
 * /api/jobs:
 *   get:
 *     summary: Hent alle jobber
 *     tags: [Jobber]
 *     responses:
 *       200:
 *         description: Liste over alle jobber
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 */
router.get('/', jobController.getAllJobs);

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Hent en spesifikk jobb
 *     tags: [Jobber]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for jobben
 *     responses:
 *       200:
 *         description: En jobb
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *       404:
 *         description: Jobben ble ikke funnet
 */
router.get('/:id', jobController.getJobById);

/**
 * @swagger
 * /api/jobs:
 *   post:
 *     summary: Opprett en ny jobb
 *     tags: [Jobber]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Job'
 *     responses:
 *       201:
 *         description: Jobben ble opprettet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 */
router.post('/', jobController.createJob);

/**
 * @swagger
 * /api/jobs/{id}:
 *   put:
 *     summary: Oppdater en jobb
 *     tags: [Jobber]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for jobben
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Job'
 *     responses:
 *       200:
 *         description: Jobben ble oppdatert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *       404:
 *         description: Jobben ble ikke funnet
 */
router.put('/:id', jobController.updateJob);

/**
 * @swagger
 * /api/jobs/{id}:
 *   delete:
 *     summary: Slett en jobb
 *     tags: [Jobber]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for jobben
 *     responses:
 *       204:
 *         description: Jobben ble slettet
 *       404:
 *         description: Jobben ble ikke funnet
 */
router.delete('/:id', jobController.deleteJob);

module.exports = router;
