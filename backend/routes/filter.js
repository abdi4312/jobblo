// routes/filterRoutes.js
const express = require("express");
const router = express.Router();
const filterController = require('../controllers/filterController');

/**
 * @swagger
 * tags:
 *   name: Filter
 *   description: Filtrering og utforskning av jobber
 */

/**
 * @swagger
 * /api/filter/options:
 *   get:
 *     summary: Hent tilgjengelige filtervalg
 *     description: Returnerer alle tilgjengelige kategorier, prisintervall og sorteringsalternativer for filtrering av jobber.
 *     tags: [Filter]
 *     responses:
 *       200:
 *         description: Filtervalg hentet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 filters:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Flytting", "Maling", "Rengjøring"]
 *                     priceRange:
 *                       type: object
 *                       properties:
 *                         min:
 *                           type: number
 *                           example: 100
 *                         max:
 *                           type: number
 *                           example: 5000
 *                     sortOptions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["newest", "price_low", "price_high", "rating_high", "nearby"]
 *       500:
 *         description: Feil ved henting av filtervalg
 */

/**
 * @swagger
 * /api/filter/apply:
 *   post:
 *     summary: Bruk valgte filtre og hent resultater
 *     description: Returnerer jobber som matcher de valgte filterkriteriene.
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
 *                 items:
 *                   type: string
 *                 example: ["Flytting", "Maling"]
 *               priceRange:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: number
 *                     example: 200
 *                   max:
 *                     type: number
 *                     example: 1500
 *               urgentOnly:
 *                 type: boolean
 *                 example: false
 *               verifiedProvidersOnly:
 *                 type: boolean
 *                 example: true
 *               searchKeyword:
 *                 type: string
 *                 example: "leilighet"
 *               sortBy:
 *                 type: string
 *                 enum: ["newest", "price_low", "price_high", "rating_high", "nearby"]
 *                 example: "newest"
 *     responses:
 *       200:
 *         description: Liste over filtrerte jobber
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: number
 *                   example: 24
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "66b1234567890abc12345678"
 *                       title:
 *                         type: string
 *                         example: "Flyttehjelp Oslo sentrum"
 *                       category:
 *                         type: string
 *                         example: "Flytting"
 *                       price:
 *                         type: number
 *                         example: 1200
 *                       urgent:
 *                         type: boolean
 *                         example: false
 *                       location:
 *                         type: string
 *                         example: "Oslo, Norge"
 *       500:
 *         description: Kunne ikke hente filtrerte resultater
 */

router.get("/options", filterController.getFilterOptions);
router.post("/apply", filterController.applyFilters);


module.exports = router;
