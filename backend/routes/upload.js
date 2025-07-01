const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

/**
 * @swagger
 * components:
 *   schemas:
 *     UploadResponse:
 *       type: object
 *       properties:
 *         imageUrl:
 *           type: string
 *           description: URL til det opplastede bildet
 */

/**
 * @swagger
 * /api/upload/image:
 *   post:
 *     summary: Last opp et bilde
 *     tags: [Opplasting]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Bildet som skal lastes opp
 *     responses:
 *       200:
 *         description: Bilde opplastet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadResponse'
 *       400:
 *         description: Ingen fil lastet opp eller ugyldig filtype
 */
router.post('/image', uploadController.uploadImage);

module.exports = router;