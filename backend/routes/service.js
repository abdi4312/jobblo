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
 *             description: "Trenger hjelp til å flytte møbler fra leilighet til lager."
 *             price: 2000
 *             location:
 *               address: "Dronningens gate 10"
 *               city: "Trondheim"
 *               coordinates: [10.3951, 63.4305]
 *             categories: ["Flytting", "Transport"]
 *             urgent: false
 *             equipment: "trengs utstyr"
 *             fromDate: "2025-11-01"
 *             toDate: "2025-11-02"
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

/**
 * @swagger
 * /api/services/{id}/details:
 *   get:
 *     summary: Hent full info om tjeneste inkludert leverandør, statistikk og lignende tjenester
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
 *         description: Full info om tjenesten
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 service:
 *                   $ref: '#/components/schemas/Service'
 *                   description: Komplett tjenesteinformasjon
 *                 provider:
 *                   type: object
 *                   description: Leverandørens profilinformasjon
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     avatarUrl:
 *                       type: string
 *                     verified:
 *                       type: boolean
 *                     role:
 *                       type: string
 *                     subscription:
 *                       type: string
 *                 stats:
 *                   type: object
 *                   description: Statistikk for tjenesten
 *                   properties:
 *                     totalOrders:
 *                       type: number
 *                       description: Totalt antall bestillinger
 *                     completedOrders:
 *                       type: number
 *                       description: Antall fullførte bestillinger
 *                 similarServices:
 *                   type: array
 *                   description: Liste over lignende tjenester basert på kategori, pris og lokasjon
 *                   items:
 *                     $ref: '#/components/schemas/Service'
 *       400:
 *         description: Ugyldig tjeneste-ID format
 *       404:
 *         description: Tjenesten ble ikke funnet
 */
router.get('/:id/details', serviceController.getServiceDetails);

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
 *
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
 *
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

/**
 * @swagger
 * /api/services/{id}/location:
 *   put:
 *     summary: Oppdater GeoJSON-lokasjon for en tjeneste
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
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lokasjon oppdatert
 */

/**
 * @swagger
 * /api/services/nearby:
 *   get:
 *     summary: Hent tjenester i nærheten basert på radius
 *     tags: [Tjenester]
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         required: true
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         required: true
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         required: true
 *         description: Radius i meter
 *     responses:
 *       200:
 *         description: Liste over tjenester i nærheten
 */

/**
 * @swagger
 * /api/services/{id}/time-entries:
 *   post:
 *     summary: Legg til en time entry for en tjeneste
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
 *             type: object
 *             properties:
 *               hours:
 *                 type: number
 *               date:
 *                 type: string
 *                 format: date-time
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Time entry lagt til
 *
 *   get:
 *     summary: Hent alle time entries for en tjeneste
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
 *         description: Liste over time entries
 */

module.exports = router;
