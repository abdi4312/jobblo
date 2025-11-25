// routes/upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middleware/auth');

// vi bruker memoryStorage fordi vi sender filen direkte videre til Azure
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB per fil, juster ved behov
});

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: Opplasting av bilder
 */

/**
 * @swagger
 * /api/upload/profile:
 *   post:
 *     summary: Last opp profilbilde
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Bildefil for profil
 *     responses:
 *       201:
 *         description: Profilbilde lastet opp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 url:
 *                   type: string
 *       400:
 *         description: Ingen fil eller feil filtype
 *       401:
 *         description: Mangler eller ugyldig autentisering
 */
router.post(
    '/profile',
    authenticate,
    upload.single('image'),
    uploadController.uploadProfileImage
);

/**
 * @swagger
 * /api/upload/service:
 *   post:
 *     summary: Last opp ett eller flere bilder til en service/job
 *     tags: [Upload]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Ett eller flere bilder
 *     responses:
 *       201:
 *         description: Bilder lastet opp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Ingen filer eller feil filtype
 *       401:
 *         description: Mangler eller ugyldig autentisering
 */
router.post(
    '/service',
    authenticate,
    upload.array('images', 5), // maks 5 bilder, juster hvis dere vil
    uploadController.uploadServiceImages
);

module.exports = router;
