const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Hent alle brukere (Kun admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste over alle brukere
 *       401:
 *         description: Token required
 *       403:
 *         description: Admin access required
 */
router.get('/users', authenticate, requireAdmin, adminController.getAllUsers);

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     summary: Hent alle ordre (Kun admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste over alle ordre
 *       401:
 *         description: Token required
 *       403:
 *         description: Admin access required
 */
router.get('/orders', authenticate, requireAdmin, adminController.getAllOrders);

router.get('/services', authenticate, requireAdmin, adminController.getAllServices);

router.get('/hero', authenticate, requireAdmin, adminController.getAllHeroItems);

router.put('/hero/:id', authenticate, requireAdmin, adminController.UpdateHero);

router.delete('/hero/:id', authenticate, requireAdmin, adminController.DeleteHero);



/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   put:
 *     summary: Endre brukerrolle (Kun admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bruker-ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, admin]
 *                 description: Ny brukerrolle
 *     responses:
 *       200:
 *         description: Brukerrolle oppdatert
 *       401:
 *         description: Token required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Bruker ikke funnet
 */
router.put('/users/:id/role', authenticate, requireAdmin, adminController.changeUserRole);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Slett bruker (Kun admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bruker-ID
 *     responses:
 *       200:
 *         description: Bruker slettet
 *       401:
 *         description: Token required
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Bruker ikke funnet
 */
router.delete('/users/:id', authenticate, requireAdmin, adminController.deleteUser);

module.exports = router;