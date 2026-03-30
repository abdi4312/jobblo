const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authenticate, requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");

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
router.post("/", authenticate, requireAdmin, userController.createUser);

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
router.get("/search", authenticate, userController.searchUsers);
router.get("/search-all", authenticate, userController.searchAll);
router.get("/top", authenticate, userController.getTopUsers);
router.get("/blocked", authenticate, userController.getBlockedUsers);
router.get("/:id", authenticate, userController.getUserById);
router.put(
  "/:id",
  authenticate,
  upload.single("avatar"),
  userController.updateUser,
);
router.delete("/:id", authenticate, userController.deleteUser);
router.get("/:id/services", authenticate, userController.getUserServices);
router.get("/", authenticate, requireAdmin, userController.getAllUsers);
router.post("/:id/follow", authenticate, userController.followUser);
router.post("/:id/block", authenticate, userController.blockUser);

module.exports = router;
