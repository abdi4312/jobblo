const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           description: Brukerens navn
 *         email:
 *           type: string
 *           description: Brukerens e-postadresse
 *         password:
 *           type: string
 *           description: Brukerens passord
 *         avatar:
 *           type: string
 *           description: URL til brukerens profilbilde
 *         bio:
 *           type: string
 *           description: Brukerens biografi
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Opprett en ny bruker
 *     tags: [Brukere]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: Brukeren ble opprettet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Ugyldig input
 */
router.post('/', userController.createUser);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Hent en spesifikk bruker
 *     tags: [Brukere]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for brukeren
 *     responses:
 *       200:
 *         description: En bruker
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Brukeren ble ikke funnet
 */
router.get('/:id', userController.getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Oppdater en bruker
 *     tags: [Brukere]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for brukeren
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Brukeren ble oppdatert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Brukeren ble ikke funnet
 */
router.put('/:id', userController.updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Slett en bruker
 *     tags: [Brukere]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for brukeren
 *     responses:
 *       204:
 *         description: Brukeren ble slettet
 *       404:
 *         description: Brukeren ble ikke funnet
 */
router.delete('/:id', userController.deleteUser);

/**
 * @swagger
 * /api/users/{id}/jobs:
 *   get:
 *     summary: Hent alle jobber for en spesifikk bruker
 *     tags: [Brukere]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for brukeren
 *     responses:
 *       200:
 *         description: Liste over brukerens jobber
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 */
router.get('/:id/jobs', userController.getUserJobs);

module.exports = router;
