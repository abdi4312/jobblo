// routes/filterRoutes.js
const express = require("express");
const router = express.Router();
const filterController = require("../controllers/filterController");

/**
 * @swagger
 * tags:
 *   name: Filter
 *   description: Filtrering og utforskning av tjenester
 */

/**
 * @swagger
 * /api/filter/options:
 *   get:
 *     summary: Hent tilgjengelige filtervalg
 *     description: Returnerer alle tilgjengelige kategorier, prisintervall og sorteringsvalg.
 *     tags: [Filter]
 *     responses:
 *       200:
 *         description: Filtervalg hentet
 *       500:
 *         description: Serverfeil ved henting av filtervalg
 */
router.get("/options", filterController.getFilterOptions);

/**
 * @swagger
 * /api/filter/apply:
 *   post:
 *     summary: Bruk valgte filtre og hent matchende tjenester
 *     description: Returnerer tjenester som matcher de valgte filterkriteriene.
 *     tags: [Filter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categories:
 *                 type: array
 *                 items: { type: string }
 *               priceRange:
 *                 type: object
 *                 properties:
 *                   min: { type: number }
 *                   max: { type: number }
 *               urgentOnly:
 *                 type: boolean
 *               verifiedProvidersOnly:
 *                 type: boolean
 *               searchKeyword:
 *                 type: string
 *               sortBy:
 *                 type: string
 *                 enum: ["newest", "price_low", "price_high", "rating_high", "nearby"]
 *     responses:
 *       200:
 *         description: Liste over filtrerte tjenester
 *       500:
 *         description: Serverfeil ved henting av resultater
 */

router.post("/apply", filterController.applyFilters);

module.exports = router;
