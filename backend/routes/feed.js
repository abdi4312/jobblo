const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');

/**
 * @swagger
 * /api/feed/following:
 *   get:
 *     summary: Hent jobber fra personer du følger
 *     tags: [Feed]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Liste over jobber fra følgere
 *       400:
 *         description: Ugyldig input
 *       404:
 *         description: Bruker ikke funnet
 */
router.get('/following', feedController.getFollowingFeed);

module.exports = router;
