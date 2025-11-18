const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

/**
 * @swagger
 * components:
 *   schemas:
 *     Review:
 *       type: object
 *       required:
 *         - serviceId
 *         - reviewerId
 *         - rating
 *       properties:
 *         _id:
 *           type: string
 *           description: Review ID
 *         serviceId:
 *           type: string
 *           description: ID of the service being reviewed
 *         reviewerId:
 *           type: string
 *           description: ID of the user writing the review
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           description: Rating from 1 to 5 stars
 *         comment:
 *           type: string
 *           maxLength: 1000
 *           description: Review comment (optional)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     ReviewWithStats:
 *       type: object
 *       properties:
 *         reviews:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Review'
 *         stats:
 *           type: object
 *           properties:
 *             averageRating:
 *               type: number
 *               description: Average rating for the service
 *             totalReviews:
 *               type: number
 *               description: Total number of reviews
 */

/**
 * @swagger
 * /api/services/{id}/reviews:
 *   post:
 *     summary: Submit a review for a service
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reviewerId
 *               - rating
 *             properties:
 *               reviewerId:
 *                 type: string
 *                 description: ID of the reviewer
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating from 1 to 5 stars
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Review comment
 *     responses:
 *       201:
 *         description: Review created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       400:
 *         description: Invalid input or user already reviewed this service
 *       404:
 *         description: Service or reviewer not found
 */
router.post('/services/:id/reviews', reviewController.createReview);

/**
 * @swagger
 * /api/services/{id}/reviews:
 *   get:
 *     summary: Get all reviews for a service
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service ID
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReviewWithStats'
 *       400:
 *         description: Invalid service ID
 *       404:
 *         description: Service not found
 */
router.get('/services/:id/reviews', reviewController.getServiceReviews);

/**
 * @swagger
 * /api/reviews:
 *   get:
 *     summary: Get all reviews
 *     tags: [Reviews]
 *     responses:
 *       200:
 *         description: List of all reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Review'
 */
router.get('/reviews', reviewController.getAllReviews);

/**
 * @swagger
 * /api/reviews/{id}:
 *   delete:
 *     summary: Delete a review
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       400:
 *         description: Invalid review ID
 *       404:
 *         description: Review not found
 */
router.delete('/reviews/:id', reviewController.deleteReview);

/**
 * @swagger
 * /api/reviews/latest:
 *   get:
 *     summary: Get latest reviews across the platform
 *     tags: [Reviews]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of reviews to return (default 5)
 *     responses:
 *       200:
 *         description: Latest reviews retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reviews:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Review'
 *                 count:
 *                   type: integer
 *                   description: Number of reviews returned
 */
router.get('/reviews/latest', reviewController.getLatestReviews);

/**
 * @swagger
 * /api/reviews/user/{id}:
 *   get:
 *     summary: Get all reviews for services owned by a specific user
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReviewWithStats'
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 */
router.get('/reviews/user/:id', reviewController.getUserReviews);

module.exports = router;