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
 *         - service
 *       properties:
 *         user:
 *           type: string
 *           description: ID til brukeren
 *         service:
 *           type: string
 *           description: ID til serviceben
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
 * /api/favorites/{serviceId}:
 *   post:
 *     summary: Legg til en serviceb som favoritt
 *     tags: [Favoritter]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for serviceben som skal legges til som favoritt
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
 *         description: Bruker eller serviceb ikke funnet
 */
router.post('/:serviceId', favoriteController.addFavorite);

/**
 * @swagger
 * /api/favorites/{serviceId}:
 *   delete:
 *     summary: Fjern en serviceb fra favoritter
 *     tags: [Favoritter]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for serviceben som skal fjernes fra favoritter
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
 *         description: Bruker, serviceb eller favoritt ikke funnet
 */
router.delete('/:serviceId', favoriteController.removeFavorite);

module.exports = router; 