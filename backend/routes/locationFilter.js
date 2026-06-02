// routes/locationFilter.js
const express = require("express");
const router = express.Router();
const locationFilterController = require("../controllers/locationFilterController");

/**
 * @swagger
 * tags:
 *   name: LocationFilter
 *   description: Lokasjonsfilter for Norge
 */

/**
 * @swagger
 * /api/location-filter/tree:
 *   get:
 *     summary: Hent lokasjonstre (Fylke -> Kommune -> Bydel)
 *     description: Returnerer det komplette lokasjonstre med fylker, kommuner og bydeler.
 *     tags: [LocationFilter]
 *     responses:
 *       200:
 *         description: Lokasjonstre hentet
 *       500:
 *         description: Serverfeil ved henting av lokasjonstre
 */
router.get("/tree", locationFilterController.getLocationTree);

/**
 * @swagger
 * /api/location-filter/stats:
 *   get:
 *     summary: Hent antall jobb per lokasjon
 *     description: Returnerer antall åpne jobber per fylke, kommune og bydel.
 *     tags: [LocationFilter]
 *     responses:
 *       200:
 *         description: Lokasjonsstatistikk hentet
 *       500:
 *         description: Serverfeil ved henting av statistikk
 */
router.get("/stats", locationFilterController.getLocationStats);

module.exports = router;
