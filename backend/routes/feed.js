const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Feed
 *   description: Feed basert på hvem du følger
 */

/**
 * @swagger
 * /api/feed/following:
 *   get:
 *     summary: Hent tjenester fra brukere du følger
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste over tjenester fra følgere
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       401:
 *         description: Mangler eller ugyldig token
 *       404:
 *         description: Bruker ikke funnet
 */
router.get('/following', authenticate, feedController.getFollowingFeed);

module.exports = router;
