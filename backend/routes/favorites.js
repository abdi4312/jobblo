const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Favorite:
 *       type: object
 *       required:
 *         - user
 *         - job
 *       properties:
 *         user:
 *           type: string
 *           description: ID til brukeren
 *         job:
 *           type: string
 *           description: ID til jobben
 */

/**
 * @swagger
 * /api/favorites:
 *   get:
 *     summary: Hent alle favoritter for innlogget bruker
 *     tags: [Favoritter]
 *     responses:
 *       200:
 *         description: Liste over brukerens favoritter
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Favorite'
 */
router.get('/', favoriteController.getFavorites);

/**
 * @swagger
 * /api/favorites/{jobId}:
 *   post:
 *     summary: Legg til en jobb som favoritt
 *     tags: [Favoritter]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for jobben som skal legges til som favoritt
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
 *                 description: ID til brukeren som legger til favoritt
 *     responses:
 *       201:
 *         description: Favoritt lagt til
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Favorite'
 *       400:
 *         description: Ugyldig input eller favoritt eksisterer allerede
 *       404:
 *         description: Bruker eller jobb ikke funnet
 */
router.post('/:jobId', favoriteController.addFavorite);

/**
 * @swagger
 * /api/favorites/{jobId}:
 *   delete:
 *     summary: Fjern en jobb fra favoritter
 *     tags: [Favoritter]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for jobben som skal fjernes fra favoritter
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
 *                 description: ID til brukeren som fjerner favoritt
 *     responses:
 *       204:
 *         description: Favoritt fjernet
 *       400:
 *         description: Ugyldig input
 *       404:
 *         description: Bruker, jobb eller favoritt ikke funnet
 */
router.delete('/:jobId', favoriteController.removeFavorite);

module.exports = router; 