const express = require('express');
const router = express.Router();
const publicStatsRouter = require('./publicStats');

/**
 * @swagger
 * /:
 *   get:
 *     summary: Test-endepunkt for Jobblo
 *     responses:
 *       200:
 *         description: API fungerer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Velkommen til Jobblo!
 */
router.get('/', function (req, res, next) {
  res.json({ message: 'Velkommen til Jobblo!' });
});

// Mount public stats under /api/public (keeps admin-only routes separate)
router.use('/api/public', publicStatsRouter);

module.exports = router;
