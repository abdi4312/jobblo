const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticate } = require('../middleware/auth');

/**
 * -------------------------------------------------------
 *  SWAGGER COMPONENTS (Schemas for Service)
 * -------------------------------------------------------
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       required:
 *         - title
 *       properties:
 *         _id:
 *           type: string
 *         userId:
 *           type: string
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
 *         imageMetadata:
 *           type: array
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
 */


/**
 * -------------------------------------------------------
 *  GET ALL SERVICES
 * -------------------------------------------------------
 */

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Get all services
 *     tags: [Tjenester]
 *     responses:
 *       200:
 *         description: Returns all services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */
router.get('/', serviceController.getAllServices);


/**
 * -------------------------------------------------------
 *  GET MY POSTED SERVICES
 * -------------------------------------------------------
 */

/**
 * @swagger
 * /api/services/my-posted:
 *   get:
 *     summary: Get all services created by logged-in user
 *     tags: [Tjenester]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's posted services
 */
router.get('/my-posted', authenticate, serviceController.getMyPostedServices);


/**
 * -------------------------------------------------------
 *  GEOJSON ROUTES
 * -------------------------------------------------------
 */

/**
 * @swagger
 * /api/services/nearby:
 *   get:
 *     summary: Get services nearby using coordinates
 *     tags: [Tjenester]
 */
router.get('/nearby', serviceController.getNearbyServices);

/**
 * @swagger
 * /api/services/{id}/location:
 *   put:
 *     summary: Update service location
 *     tags: [Tjenester]
 */
router.put('/:id/location', authenticate, serviceController.updateLocation);


/**
 * -------------------------------------------------------
 *  CREATE SERVICE
 * -------------------------------------------------------
 */

/**
 * @swagger
 * /api/services:
 *   post:
 *     summary: Opprett en ny tjeneste (Norway)
 *     tags: [Tjenester]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - price
 *               - location
 *             properties:
 *               title:
 *                 type: string
 *                 example: Rengjøring av bolig
 *               description:
 *                 type: string
 *                 example: Profesjonell rengjøring av leilighet
 *               price:
 *                 type: number
 *                 example: 500
 *               location:
 *                 type: object
 *                 required:
 *                   - address
 *                   - city
 *                   - coordinates
 *                 properties:
 *                   address:
 *                     type: string
 *                     example: Main Street 10
 *                   city:
 *                     type: string
 *                     example: Oslo
 *                   coordinates:
 *                     type: array
 *                     description: "[longitude, latitude] – Norway"
 *                     minItems: 2
 *                     maxItems: 2
 *                     items:
 *                       type: number
 *                     example: [10.7461, 59.9127]
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - Cleaning
 *                   - House Service
 *               urgent:
 *                 type: boolean
 *                 example: false
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example:
 *                   - cleaning
 *                   - home
 *               duration:
 *                 type: object
 *                 properties:
 *                   value:
 *                     type: number
 *                     example: 2
 *                   unit:
 *                     type: string
 *                     enum: [minutes, hours, days]
 *                     example: hours
 *     responses:
 *       201:
 *         description: Tjeneste opprettet
 *       400:
 *         description: Ugyldig forespørsel
 *       401:
 *         description: Ikke autorisert
 */
router.post('/', authenticate, serviceController.createService);


/**
 * -------------------------------------------------------
 *  SERVICE DETAILS
 * -------------------------------------------------------
 */

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     summary: Get service by ID
 *     tags: [Tjenester]
 */
router.get('/:id', serviceController.getServiceById);


/**
 * -------------------------------------------------------
 *  UPDATE SERVICE (OWNER ONLY)
 * -------------------------------------------------------
 */

/**
 * @swagger
 * /api/services/{id}:
 *   put:
 *     summary: Update a service
 *     tags: [Tjenester]
 */
router.put('/:id', authenticate, serviceController.updateService);


/**
 * -------------------------------------------------------
 *  DELETE SERVICE (OWNER ONLY)
 * -------------------------------------------------------
 */

/**
 * @swagger
 * /api/services/{id}:
 *   delete:
 *     summary: Delete a service
 *     tags: [Tjenester]
 */
router.delete('/:id', authenticate, serviceController.deleteService);


/**
 * -------------------------------------------------------
 *  TIME ENTRIES
 * -------------------------------------------------------
 */

/**
 * @swagger
 * /api/services/{id}/time-entries:
 *   post:
 *     summary: Add a time entry to service
 *     tags: [Tjenester]
 */
router.post('/:id/time-entries', authenticate, serviceController.addTimeEntry);

/**
 * @swagger
 * /api/services/{id}/time-entries:
 *   get:
 *     summary: Get all time entries for a service
 *     tags: [Tjenester]
 */
router.get('/:id/time-entries', authenticate, serviceController.getTimeEntries);


module.exports = router;
