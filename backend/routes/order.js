const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Ordre- og oppdragsstyring
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Order:
 *       type: object
 *       required:
 *         - serviceId
 *       properties:
 *         _id:
 *           type: string
 *         serviceId:
 *           type: string
 *           description: ID til tjenesten ordren gjelder
 *         customerId:
 *           type: string
 *           description: ID til kunden som bestiller tjenesten
 *         providerId:
 *           type: string
 *           description: ID til tjenestetilbyderen
 *         status:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *         price:
 *           type: number
 *         contractId:
 *           type: string
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
 *     summary: Hent alle ordre for innlogget bruker
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste over ordre for bruker (kunde eller tilbyder)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Order'
 *       401:
 *         description: Mangler eller ugyldig autentisering
 */
router.get('/', authenticate, orderController.getAllOrders);

/**
 * @swagger
 * /api/orders/{id}:
 *   get:
 *     summary: Hent en spesifikk ordre
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Ordre-ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ordredetaljer
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       403:
 *         description: Ikke autorisert til å se denne ordren
 *       404:
 *         description: Ordre ikke funnet
 */
router.get('/:id', authenticate, orderController.getOrderById);

/**
 * @swagger
 * /api/orders:
 *   post:
 *     summary: Opprett en ny ordre
 *     tags: [Orders]
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
 *                 description: ID til tjenesten
 *               price:
 *                 type: number
 *                 description: Pris for oppdraget
 *     responses:
 *       201:
 *         description: Ordren ble opprettet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Ugyldig forespørsel
 *       404:
 *         description: Tjeneste ikke funnet
 */
router.post('/', authenticate, orderController.createOrder);

/**
 * @swagger
 * /api/orders/{id}:
 *   patch:
 *     summary: Oppdater en ordre (bare status og pris)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *                 description: Oppdatert ordrestatus
 *               price:
 *                 type: number
 *                 description: Oppdatert pris
 *     responses:
 *       200:
 *         description: Ordre oppdatert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       403:
 *         description: Ikke autorisert til å oppdatere ordren
 *       404:
 *         description: Ordre ikke funnet
 */
router.patch('/:id', authenticate, orderController.updateOrder);

/**
 * @swagger
 * /api/orders/{id}:
 *   delete:
 *     summary: Kanseller en ordre
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Ordre kansellert
 *       403:
 *         description: Ikke autorisert
 *       404:
 *         description: Ordre ikke funnet
 */
router.delete('/:id', authenticate, orderController.deleteOrder);

module.exports = router;
