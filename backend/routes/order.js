const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const { checkSubscription } = require('../middleware/checkSubscription');

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
 *           enum: [pending, accepted, declined, in_progress, completed, cancelled, awaiting_payment, paid]
 *         price:
 *           type: number
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
router.post('/request', authenticate, checkSubscription, orderController.createJobRequest);
router.get('/requests/my', authenticate, orderController.getMyJobRequests);
router.patch('/request/:id', authenticate, orderController.updateJobRequestStatus);

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
router.get('/:id/completed-details', authenticate, orderController.getCompletedJobDetails);

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
// ── Removed: POST /api/orders (createOrder) ──────────────────────────────────
//
// It created the Order with the roles inverted — caller as payer, service owner as
// payee — which is the opposite of every other path, and the resulting `pending`
// order was payable. It also required no application and no ownership check, so one
// account could order another user's listing and inflate that owner's completed-job
// and earnings counters. No component called it. Orders come from the award flow:
// POST /api/safepay/create-contract or POST /api/chats/:chatId/contracts.

// ── Removed: PATCH /api/orders/:id and DELETE /api/orders/:id ────────────────
//
// Both were generic, either-party endpoints with their own private idea of which
// order transitions were legal, and both could move money-bearing orders:
//
//   PATCH  declared `paid → completed` legal and authorised EITHER party, so a
//          provider could complete their own paid order — skipping review, skipping
//          evidence, and skipping releasePayoutToProvider entirely. The customer's
//          approval was then refused as "already completed" and the escrowed money
//          became unreachable by any code path.
//
//   DELETE set `cancelled` from ANY state including paid/in_progress/
//          ready_for_review, with no refund, no payout and no dispute check.
//
// Neither was called by the web frontend (the `useUpdateOrderStatusMutation` hook
// existed but no component used it) or by the mobile app. The supported lifecycle
// is the SafePay flow in providerWorkController + SafePayCheckoutController, which
// already guards every transition properly, plus the admin routes under
// /api/admin/orders. Deleting them was preferred over adding guards, because
// keeping them would have meant maintaining a fifth competing state machine.

module.exports = router;
