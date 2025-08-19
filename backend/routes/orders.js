const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

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
 * /api/orders:
 *   get:
 *     summary: Hent alle ordre
 *     tags: [Ordre]
 *     responses:
 *       200:
 *         description: Liste over alle ordre
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 */

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Hent en spesifikk ordre
 *     tags: [Ordre]
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
 *       404:
 *         description: Ordren ble ikke funnet
 */

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Opprett en ny ordre
 *     tags: [Ordre]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       201:
 *         description: Ordren ble opprettet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Ugyldig forespørsel
 */

/**
 * @swagger
 * /api/orders/{id}:
 *   put:
 *     summary: Oppdater en ordre
 *     tags: [Ordre]
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
 *             $ref: '#/components/schemas/Order'
 *     responses:
 *       200:
 *         description: Ordren ble oppdatert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Ugyldig forespørsel
 *       404:
 *         description: Ordren ble ikke funnet
 */

/**
 * @swagger
 * /api/orders/{id}:
 *   delete:
 *     summary: Slett en ordre
 *     tags: [Ordre]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Ordre-ID
 *     responses:
 *       200:
 *         description: Ordren ble slettet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Order deleted
 *       404:
 *         description: Ordren ble ikke funnet
 */

// List all orders
router.get('/', orderController.getAllOrders);

// Get a single order by ID
router.get('/:id', orderController.getOrderById);

// Create a new order
router.post('/', orderController.createOrder);

// Update an order
router.put('/:id', orderController.updateOrder);

// Delete an order
router.delete('/:id', orderController.deleteOrder);

module.exports = router;
