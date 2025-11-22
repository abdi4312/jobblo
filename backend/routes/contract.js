const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Contracts
 *   description: Kontrakter mellom kunde og tilbyder
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Contract:
 *       type: object
 *       required:
 *         - orderId
 *         - content
 *       properties:
 *         _id:
 *           type: string
 *         orderId:
 *           type: string
 *           description: ID til ordren kontrakten knyttes til
 *         content:
 *           type: string
 *           description: Selve kontraktsteksten
 *         signedByCustomer:
 *           type: boolean
 *         signedByProvider:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/contracts/{id}:
 *   get:
 *     summary: Hent en kontrakt
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticate, contractController.getContractById);

/**
 * @swagger
 * /api/contracts:
 *   post:
 *     summary: Opprett en kontrakt for en ordre
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticate, contractController.createContract);

/**
 * @swagger
 * /api/contracts/{id}/sign:
 *   patch:
 *     summary: Signer kontrakten (kunde eller tilbyder)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:id/sign', authenticate, contractController.signContract);

/**
 * @swagger
 * /api/contracts/{id}:
 *   delete:
 *     summary: Slett en kontrakt
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', authenticate, contractController.deleteContract);

module.exports = router;
