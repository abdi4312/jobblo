const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticate } = require('../middleware/auth');

// ------------------- GeoJSON -------------------
router.put('/:id/location', serviceController.updateLocation);
router.get('/nearby', serviceController.getNearbyServices);
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);
router.post('/', serviceController.createService);
router.put('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);
router.post('/:id/time-entries', serviceController.addTimeEntry);
router.get('/:id/time-entries', serviceController.getTimeEntries);

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
 *               description: Gateadresse (f.eks. "Karl Johans gate 12")
 *             city:
 *               type: string
 *               description: By (f.eks. "Oslo")
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *           description: Liste med kategorinavn (ikke ID)
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Bilde-URLer
 *         urgent:
 *           type: boolean
 *           description: Om tjenesten haster
 *         status:
 *           type: string
 *           enum: [open, closed, in_progress]
 *           description: Status på tjenesten
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Stikkord eller søkeord
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
 *           description: Startdato for når jobben skal utføres
 *         toDate:
 *           type: string
 *           format: date
 *           description: Sluttdato for når jobben skal utføres
 *         equipment:
 *           type: string
 *           enum: [utstyrfri, delvis utstyr, trengs utstyr]
 *           description: Hvorvidt jobben krever utstyr
 *         isFavorited:
 *           type: boolean
 *           description: Om brukeren har favorittisert tjenesten
 *         timeEntries:
 *           type: array
 *           description: Registrerte timer på tjenesten
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
 *
 *   examples:
 *     ExampleService:
 *       summary: Eksempel på tjeneste
 *       value:
 *         _id: "6718e21f98a3c43a6c8d9c4b"
 *         userId: "66ffbb129becc42fbc90a555"
 *         title: "Male stue og kjøkken"
 *         description: "Ønsker hjelp til å male vegger og tak i stue og kjøkken."
 *         price: 4500
 *         location:
 *           type: "Point"
 *           coordinates: [10.7461, 59.9127]
 *           address: "Karl Johans gate 12"
 *           city: "Oslo"
 *         categories: ["Maling", "Oppussing"]
 *         images: ["https://example.com/images/malejobb1.jpg"]
 *         urgent: true
 *         status: "open"
 *         tags: ["innendørs", "privat", "rask"]
 *         duration:
 *           value: 2
 *           unit: "days"
 *         fromDate: "2025-10-24"
 *         toDate: "2025-10-25"
 *         equipment: "delvis utstyr"
 *         isFavorited: false
 *         createdAt: "2025-10-23T18:30:00Z"
 *         updatedAt: "2025-10-23T18:30:00Z"
 */

/**
 * @swagger
 * /api/services/my-posted:
 *   get:
 *     summary: Hent alle tjenester/oppdrag du har lagt ut
 *     tags: [Tjenester]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste over alle tjenester/oppdrag du har lagt ut
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       401:
 *         description: Token mangler eller ugyldig
 */
router.get('/my-posted', authenticate, serviceController.getMyPostedServices);

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Hent alle tjenester
 *     tags: [Tjenester]
 *     responses:
 *       200:
 *         description: Liste over alle tjenester
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *
 const express = require('express');
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
 *           description: Service-ID
 *         userId:
 *           type: string
 *           description: ID til brukeren som la ut tjenesten
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
 *               description: "[longitude, latitude]"
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
 *           description: Metadata om opplastede bilder (Azure Blob)
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

/* -----------------------------
      ROUTER ORDER (IMPORTANT)
------------------------------*/

// GEO FIRST
router.put('/:id/location', serviceController.updateLocation);

router.get('/nearby', serviceController.getNearbyServices);

// MY POSTED
router.get('/my-posted', authenticate, serviceController.getMyPostedServices);

// GET ALL
router.get('/', serviceController.getAllServices);

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
 *             $ref: '#/components/schemas/Service'
 *           example:
 *             userId: "66ffbb129becc42fbc90a555"
 *             title: "Flyttehjelp ønskes"
 *             description: "Trenger hjelp til å flytte møbler."
 *             price: 2000
 *             location:
 *               address: "Dronningens gate 10"
 *               city: "Oslo"
 *               coordinates: [10.3951, 63.4305]
 *             categories: ["Flytting"]
 *             images:
 *               - "https://yourblob.blob.core.windows.net/bilder/service/demo1.png"
 *             imageMetadata:
 *               - url: "https://yourblob.blob.core.windows.net/bilder/service/demo1.png"
 *                 blobName: "service/66ffbb129becc42fbc90a555/demo1.png"
 *     responses:
 *       201:
 *         description: Tjenesten ble opprettet
 */
router.post('/', serviceController.createService);

// DETAILS (must be above /:id)
router.get('/:id/details', serviceController.getServiceDetails);

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     summary: Hent en tjeneste
 *     tags: [Tjenester]
 *   put:
 *     summary: Oppdater en tjeneste
 *     tags: [Tjenester]
 *   delete:
 *     summary: Slett en tjeneste
 *     tags: [Tjenester]
 */
router.get('/:id', serviceController.getServiceById);
router.put('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);

/**
 * @swagger
 * /api/services/{id}/location:
 *   put:
 *     summary: Oppdater GeoJSON-lokasjon
 *     tags: [Tjenester]
 */
router.put('/:id/location', serviceController.updateLocation);

/**
 * @swagger
 * /api/services/nearby:
 *   get:
 *     summary: Hent tjenester i nærheten
 *     tags: [Tjenester]
 */
router.get('/nearby', serviceController.getNearbyServices);

/**
 * @swagger
 * /api/services/{id}/time-entries:
 *   post:
 *     summary: Legg til time entry
 *     tags: [Tjenester]
 *   get:
 *     summary: Hent alle time entries
 *     tags: [Tjenester]
 */
router.post('/:id/time-entries', serviceController.addTimeEntry);
router.get('/:id/time-entries', serviceController.getTimeEntries);

module.exports = router;
