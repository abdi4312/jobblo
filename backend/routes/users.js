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
 *         - phone
 *       properties:
 *         name:
 *           type: string
 *           description: Brukerens navn
 *         email:
 *           type: string
 *           description: Brukerens e-postadresse
 *         phone:
 *           type: string
 *           description: Brukerens telefonnummer
 *         avatarUrl:
 *           type: string
 *           description: URL til brukerens profilbilde
 *         bio:
 *           type: string
 *           description: Brukerens biografi
 *         role:
 *           type: string
 *           enum: [user, admin]
 *           description: Brukerrolle
 *         subscription:
 *           type: string
 *           enum: [free, basic, plus, premium]
 *           description: Abonnementstype
 *         verified:
 *           type: boolean
 *           description: Om brukeren er verifisert
 *         lastLogin:
 *           type: string
 *           format: date-time
 *           description: Siste innlogging
 *         followers:
 *           type: array
 *           items:
 *             type: string
 *           description: Liste over følgere (bruker-IDer)
 *         following:
 *           type: array
 *           items:
 *             type: string
 *           description: Liste over brukere denne følger
 *         availability:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               start:
 *                 type: string
 *                 format: date-time
 *               end:
 *                 type: string
 *                 format: date-time
 *           description: Tilgjengelighet
 *         earnings:
 *           type: number
 *           description: Inntjening
 *         spending:
 *           type: number
 *           description: Forbruk
 *         oauthProviders:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *               providerId:
 *                 type: string
 *           description: OAuth-leverandører
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
 *         description: Ugyldig forespørsel eller e-post/telefon finnes allerede
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
 *       400:
 *         description: Ugyldig forespørsel
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
 *       200:
 *         description: Brukeren ble slettet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deleted
 *       404:
 *         description: Brukeren ble ikke funnet
 */
router.delete('/:id', userController.deleteUser);

/**
 * @swagger
 * /api/users/{id}/services:
 *   get:
 *     summary: Hent alle serviceber for en spesifikk bruker
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
 *         description: Liste over brukerens serviceber
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 *       404:
 *         description: Brukeren ble ikke funnet
 */
router.get('/:id/services', userController.getUserServices);

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
 * /api/users/{id}/services:
 *   get:
 *     summary: Hent alle serviceber for en spesifikk bruker
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
 *         description: Liste over brukerens serviceber
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Job'
 */
router.get('/:id/services', userController.getUserServices);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Hent alle brukere
 *     tags: [Brukere]
 *     responses:
 *       200:
 *         description: Liste over alle brukere
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
router.get('/', userController.getAllUsers);

/**
 * @swagger
 * /api/users/{id}/follow:
 *   post:
 *     summary: Følg eller slutte å følge en bruker
 *     tags: [Brukere]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID til brukeren som skal følges/unfollowes
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
 *                 description: ID til brukeren som følger
 *     responses:
 *       200:
 *         description: Følger status oppdatert
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 isFollowing:
 *                   type: boolean
 *       400:
 *         description: Ugyldig input eller kan ikke følge seg selv
 *       404:
 *         description: Bruker ikke funnet
 */
router.post('/:id/follow', userController.followUser);

module.exports = router;
