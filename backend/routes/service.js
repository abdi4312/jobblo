const expressconst express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Tjenester
 *   description: API for å håndtere tjenester/oppdrag
 */

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
 *         userId:
 *           type: string
 *           description: ID til brukeren som opprettet tjenesten
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: number
 *         location:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [Point]
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               description: [longitude, latitude]
 *             address:
 *               type: string
 *             city:
 *               type: string
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Liste over bilde-URLer
 *         imageMetadata:
 *           type: array
 *           description: Opplastingsmetadata for bilder
 *           items:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               blobName:
 *                 type: string
 *               uploadedAt:
 *                 type: string
 *                 format: date-time
 *         urgent:
 *           type: boolean
 *         status:
 *           type: string
 *           enum: [open, closed, in_progress]
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         duration:
 *           type: object
 *           properties:
 *             value:
 *               type: number
 *             unit:
 *               type: string
 *               enum: [minutes, hours, days]
 *         fromDate:
 *           type: string
 *           format: date
 *         toDate:
 *           type: string
 *           format: date
 *         equipment:
 *           type: string
 *           enum: [utstyrfri, delvis utstyr, trengs utstyr]
 *         isFavorited:
 *           type: boolean
 *         timeEntries:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               hours:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date-time
 *               note:
 *                 type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * -------------------------------
 *        ROUTES (CORRECT ORDER)
 * -------------------------------
 */

// GEO – må komme først
router.put('/:id/location', serviceController.updateLocation);
router.get('/nearby', serviceController.getNearbyServices);

// Mine tjenester
router.get('/my-posted', authenticate, serviceController.getMyPostedServices);

// CRUD – Create & All
router.get('/', serviceController.getAllServices);

/**
 * @swagger
 * /api/services:
 *   post:
 *     summary: Opprett en tjeneste
 *     tags: [Tjenester]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Service'
 *           example:
 *             userId: "66ffbb129becc42fbc90a555"
 *             title: "Flyttehjelp ønskes"
 *             description: "Trenger hjelp til flytting."
 *             price: 2000
 *             categories: ["Flytting"]
 *             images:
 *               - "https://blob.../service/123/a.jpg"
 *             imageMetadata:
 *               - url: "https://blob.../service/123/a.jpg"
 *                 blobName: "service/123/a.jpg"
 *             location:
 *               address: "Dronningens gate 10"
 *               city: "Oslo"
 *     responses:
 *       201:
 *         description: Tjenesten ble opprettet
 */
router.post('/', serviceController.createService);

// Full detaljvisning – må komme før /:id
router.get('/:id/details', serviceController.getServiceDetails);

// Hent enkel tjeneste
router.get('/:id', serviceController.getServiceById);

/**
 * @swagger
 * /api/services/{id}:
 *   put:
 *     summary: Oppdater en tjeneste
 *     tags: [Tjenester]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Service'
 *           example:
 *             title: "Oppdatert tittel"
 *             images:
 *               - "https://blob.../service/123/nyttBilde.jpg"
 *             imageMetadata:
 *               - url: "https://blob.../service/123/nyttBilde.jpg"
 *                 blobName: "service/123/nyttBilde.jpg"
 *     responses:
 *       200:
 *         description: Tjenesten ble oppdatert
 */
router.put('/:id', serviceController.updateService);

/**
 * @swagger
 * /api/services/{id}:
 *   delete:
 *     summary: Slett en tjeneste
 *     tags: [Tjenester]
 *     responses:
 *       204:
 *         description: Tjenesten ble slettet
 */
router.delete('/:id', serviceController.deleteService);

// Time-entries
router.post('/:id/time-entries', serviceController.addTimeEntry);
router.get('/:id/time-entries', serviceController.getTimeEntries);

module.exports = router;
