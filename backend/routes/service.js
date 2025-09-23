const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       required:
 *         - title
 *         - userId
 *       properties:
 *         _id:
 *           type: string
 *           description: Service-ID
 *         userId:
 *           type: string
 *           description: ID til brukeren som la ut tjenesten
 *         title:
 *           type: string
 *           description: Tittel på tjenesten
 *         description:
 *           type: string
 *           description: Beskrivelse av tjenesten
 *         price:
 *           type: number
 *           description: Pris for tjenesten
 *         location:
 *           type: string
 *           description: Lokasjon for tjenesten
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *           description: Kategorier (IDer)
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Bilde-URLer
 *         urgent:
 *           type: boolean
 *           description: Om tjenesten er haster
 *         status:
 *           type: string
 *           enum: [open, closed, in_progress]
 *           description: Status på tjenesten
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Stikkord
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Hent alle tjenesteer
 *     tags: [Tjenester]
 *     responses:
 *       200:
 *         description: Liste over alle tjenesteer
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */
router.get('/', serviceController.getAllServices);

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     summary: Hent en spesifikk tjeneste
 *     tags: [Tjenester]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for tjenesten
 *     responses:
 *       200:
 *         description: En tjeneste
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Tjenesten ble ikke funnet
 */
router.get('/:id', serviceController.getServiceById);

/**
 * @swagger
 * /api/services:
 *   post:
 *     summary: Opprett en ny tjeneste
 *     tags: [Tjenester]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID til brukeren som oppretter tjenesten
 *               title:
 *                 type: string
 *                 description: Tittel på tjenesten
 *               description:
 *                 type: string
 *                 description: Beskrivelse av tjenesten
 *               price:
 *                 type: number
 *                 description: Pris for tjenesten
 *               location:
 *                 type: string
 *                 description: Lokasjon for tjenesten
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Kategorier (IDer)
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Bilde-URLer
 *               urgent:
 *                 type: boolean
 *                 description: Om tjenesten er haster
 *               status:
 *                 type: string
 *                 enum: [open, closed, in_progress]
 *                 description: Status på tjenesten
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Stikkord
 *     responses:
 *       201:
 *         description: Tjenesten ble opprettet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Ugyldig input
 *       404:
 *         description: Bruker ikke funnet
 */
router.post('/', serviceController.createService);

/**
 * @swagger
 * /api/services/{id}:
 *   put:
 *     summary: Oppdater en tjeneste
 *     tags: [Tjenester]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for tjenesten
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Service'
 *     responses:
 *       200:
 *         description: Tjenesten ble oppdatert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Ugyldig input eller dataformat
 *       404:
 *         description: Tjeneste eller bruker ikke funnet
 *       500:
 *         description: Server-feil
 */
router.put('/:id', serviceController.updateService);

/**
 * @swagger
 * /api/services/{id}:
 *   delete:
 *     summary: Slett en tjeneste
 *     tags: [Tjenester]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: ID for tjenesten
 *     responses:
 *       204:
 *         description: Tjenesten ble slettet
 *       404:
 *         description: Tjenesten ble ikke funnet
 */
router.delete('/:id', serviceController.deleteService);


module.exports = router;
