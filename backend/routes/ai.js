const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { authenticate } = require("../middleware/auth");

/**
 * @swagger
 * /api/ai/generate-job-info:
 *   post:
 *     summary: Generate job description and estimated price
 *     tags: [AI]
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
 *             properties:
 *               title:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully generated job info
 *       400:
 *         description: Title is required
 */
router.post("/generate-job-info", authenticate, aiController.generateJobInfo);

/**
 * @swagger
 * /api/ai/generate-title:
 *   post:
 *     summary: Generate job title based on description
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully generated title
 *       400:
 *         description: Description is required
 */
router.post("/generate-title", authenticate, aiController.generateTitle);

/**
 * @swagger
 * /api/ai/generate-full-listing:
 *   post:
 *     summary: Generate a complete, structured job listing from a prompt
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully generated full listing
 *       400:
 *         description: Prompt is required
 */
router.post(
  "/generate-full-listing",
  authenticate,
  aiController.generateFullJobListing,
);

module.exports = router;
