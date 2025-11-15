const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       required:
 *         - serviceId
 *         - customerId
 *       properties:
 *         _id:
 *           type: string
 *           description: Order ID
 *         serviceId:
 *           type: string
 *           description: Tjeneste-ID (Service)
 *         customerId:
 *           type: string
 *           description: Kunde-ID (User)
 *         providerId:
 *           type: string
 *           description: Leverandør-ID (User)
 *         status:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *           description: Ordrestatus
 *         price:
 *           type: number
 *           description: Pris
 *         contractId:
 *           type: string
 *           description: Kontrakt-ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/order:
 *   get:
 *     summary: Hent alle ordre for innlogget bruker
 *     tags: [Ordre]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste over brukerens ordre (som kunde eller leverandør)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         description: Mangler eller ugyldig autentisering
 */

/**
 * @swagger
 * /api/order/{id}:
 *   get:
 *     summary: Hent en spesifikk ordre
 *     tags: [Ordre]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Ordre-ID
 *     responses:
 *       200:
 *         description: En ordre
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       401:
 *         description: Mangler eller ugyldig autentisering
 *       404:
 *         description: Ordren ble ikke funnet
 */

/**
 * @swagger
 * /api/order:
 *   post:
 *     summary: Opprett en ny ordre
 *     tags: [Ordre]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *             properties:
 *               serviceId:
 *                 type: string
 *                 description: ID til tjenesten (providerId og customerId settes automatisk)
 *               price:
 *                 type: number
 *                 description: Pris (valgfri, bruker servicens pris som standard)
 *     responses:
 *       201:
 *         description: Ordren ble opprettet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Ugyldig forespørsel eller kan ikke opprette ordre for egen tjeneste
 *       401:
 *         description: Mangler eller ugyldig autentisering
 *       404:
 *         description: Tjeneste ikke funnet
 */

/**
 * @swagger
 * /api/order/{id}:
 *   put:
 *     summary: Oppdater en ordre
 *     tags: [Ordre]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Ordre-ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, completed, cancelled]
 *                 description: Ordrestatus
 *               price:
 *                 type: number
 *                 description: Pris
 *     responses:
 *       200:
 *         description: Ordren ble oppdatert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Ugyldig forespørsel
 *       401:
 *         description: Mangler eller ugyldig autentisering
 *       403:
 *         description: Ikke autorisert til å oppdatere denne ordren
 *       404:
 *         description: Ordren ble ikke funnet
 */

/**
 * @swagger
 * /api/order/{id}:
 *   delete:
 *     summary: Slett en ordre
 *     tags: [Ordre]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Ordre-ID
 *     responses:
 *       204:
 *         description: Ordren ble slettet
 *       401:
 *         description: Mangler eller ugyldig autentisering
 *       403:
 *         description: Ikke autorisert til å slette denne ordren
 *       404:
 *         description: Ordren ble ikke funnet
 */

// List all orders for authenticated user
router.get('/', authenticate, orderController.getAllOrders);

// Get a single order by ID
router.get('/:id', orderController.getOrderById);

// Create a new order (requires authentication)
router.post('/', authenticate, orderController.createOrder);

// Update an order (requires authentication)
router.put('/:id', authenticate, orderController.updateOrder);

// Delete an order (requires authentication)
router.delete('/:id', authenticate, orderController.deleteOrder);

module.exports = router;
