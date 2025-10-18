const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
// Oppdater GeoJSON-lokasjon for en tjeneste
router.put('/:id/location', serviceController.updateLocation);

router.get('/nearby', serviceController.getNearbyServices);
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
router.get('/my-posted', serviceController.getMyPostedServices);

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


// ------------------- Kart / GeoJSON -------------------

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
 * /api/services/map:
 *   get:
 *     summary: Hent tjenester innenfor et kartutsnitt (bounding box)
 *     tags: [Tjenester]
 *     parameters:
 *       - in: query
 *         name: neLat
 *         schema:
 *           type: number
 *         required: true
 *       - in: query
 *         name: neLng
 *         schema:
 *           type: number
 *         required: true
 *       - in: query
 *         name: swLat
 *         schema:
 *           type: number
 *         required: true
 *       - in: query
 *         name: swLng
 *         schema:
 *           type: number
 *         required: true
 *     responses:
 *       200:
 *         description: Liste over tjenester innenfor bounding box
 */

// ------------------- Tidsregistrering -------------------

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
 */

/**
 * @swagger
 * /api/services/{id}/time-entries:
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

// ------------------- Tidsregistrering -------------------
router.post('/:id/time-entries', serviceController.addTimeEntry);
router.get('/:id/time-entries', serviceController.getTimeEntries);


module.exports = router;
