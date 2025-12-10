const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { authenticate } = require("../middleware/auth");

/**
 * SECURITY RULE:
 * We ONLY accept the authenticated user's ID.
 * No userId from body or query to avoid impersonation attacks.
 */

/**
 * @swagger
 * tags:
 *   name: Favoritter
 *   description: API for håndtering av favoritt-tjenester
 */

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
 *           description: ID til brukeren som har favoritten
 *         service:
 *           type: string
 *           description: ID til tjenesten (Service)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/favorites:
 *   get:
 *     summary: Hent alle favoritter for en bruker
 *     tags: [Favoritter]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID til brukeren
 *     responses:
 *       200:
 *         description: Liste over brukerens favoritter
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Favorite'
 *       400:
 *         description: userId mangler eller ugyldig
 *       404:
 *         description: Bruker ikke funnet
 */
router.get("/", authenticate, favoriteController.getFavorites);

/**
 * @swagger
 * /api/favorites/{serviceId}:
 *   post:
 *     summary: Legg til en tjeneste som favoritt
 *     tags: [Favoritter]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID til tjenesten som skal favorittmerkes
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
 *                 description: ID til brukeren
 *     responses:
 *       201:
 *         description: Favoritt opprettet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Favorite'
 *       400:
 *         description: Ugyldig input eller favoritt finnes allerede
 *       404:
 *         description: Bruker eller tjeneste ikke funnet
 */
router.post("/:serviceId", authenticate, favoriteController.addFavorite);

/**
 * @swagger
 * /api/favorites/{serviceId}:
 *   delete:
 *     summary: Fjern en tjeneste fra favoritter
 *     tags: [Favoritter]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID til tjenesten som skal fjernes
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
 *                 description: ID til brukeren
 *     responses:
 *       204:
 *         description: Favoritt fjernet
 *       400:
 *         description: Ugyldig input
 *       404:
 *         description: Favoritt ikke funnet
 */
router.delete("/:serviceId", authenticate, favoriteController.removeFavorite);

module.exports = router;

