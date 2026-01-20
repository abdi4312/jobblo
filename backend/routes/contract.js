const express = require("express");
const router = express.Router();
const contractController = require("../controllers/contractController");
const { authenticate } = require("../middleware/auth");
const {checkSubscription} = require("../middleware/checkSubscription");

/**
 * @swagger
 * tags:
 *   name: Contracts
 *   description: Contracts between client and provider. Orders are auto-created once contract is fully signed.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Contract:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         serviceId:
 *           type: string
 *         clientId:
 *           type: string
 *         providerId:
 *           type: string
 *         content:
 *           type: string
 *         price:
 *           type: number
 *         scheduledDate:
 *           type: string
 *           format: date-time
 *         address:
 *           type: string
 *         status:
 *           type: string
 *           enum: [draft, pending_signatures, signed, cancelled]
 *         signedByCustomer:
 *           type: boolean
 *         signedByProvider:
 *           type: boolean
 *         signedByCustomerAt:
 *           type: string
 *           format: date-time
 *         signedByProviderAt:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/contracts/{serviceId}:
 *   get:
 *     summary: Get contracts for a service (Client or Provider)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of contracts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 contracts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Contract'
 *       401:
 *         description: Unauthorized
 */
router.get("/:serviceId", authenticate, contractController.getMyContracts);

/**
 * @swagger
 * /api/contracts:
 *   post:
 *     summary: Create a contract (Client only)
 *     description: Providers cannot create contracts for their own services.
 *     tags: [Contracts]
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
 *               - content
 *               - price
 *             properties:
 *               serviceId:
 *                 type: string
 *               content:
 *                 type: string
 *               price:
 *                 type: number
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: Contract created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 contract:
 *                   $ref: '#/components/schemas/Contract'
 *       400:
 *         description: Validation error or contract already exists
 *       403:
 *         description: Provider cannot create contract for own service
 */
router.post("/", authenticate,checkSubscription, contractController.createContract);

/**
 * @swagger
 * /api/contracts/{id}/sign:
 *   patch:
 *     summary: Sign contract (Client or Provider)
 *     description: |
 *       - First signature → status becomes `pending_signatures`
 *       - Second signature → status becomes `signed`
 *       - When status becomes `signed`, an Order is automatically created
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contract signed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 contract:
 *                   $ref: '#/components/schemas/Contract'
 *       400:
 *         description: Already signed
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Contract not found
 */
router.patch("/:id/sign", authenticate, contractController.signContract);

/**
 * @swagger
 * /api/contracts/{id}:
 *   delete:
 *     summary: Delete contract (Client or Provider)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contract deleted successfully
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Contract not found
 */
router.delete("/:id", authenticate, contractController.deleteContract);

module.exports = router;
