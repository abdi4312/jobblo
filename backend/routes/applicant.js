const express = require('express');
const router = express.Router();
const applicantController = require('../controllers/applicantController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Applicants
 *   description: Søkerhåndtering for oppdrag
 */

/**
 * @swagger
 * /api/applicants/{serviceId}:
 *   get:
 *     summary: Hent alle søkere til et spesifikt oppdrag
 *     tags: [Applicants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [rating, completedJobs, favorites, createdAt]
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [favorites, archived, notArchived]
 *     responses:
 *       200:
 *         description: Liste over søkere
 *       403:
 *         description: Ikke autorisert
 *       404:
 *         description: Oppdrag ikke funnet
 */
router.get('/my/overview', authenticate, applicantController.getMyServicesWithApplicants);
router.get('/:serviceId', authenticate, applicantController.getApplicantsForService);
router.patch('/:requestId/favorite', authenticate, applicantController.toggleFavorite);
router.patch('/:requestId/archive', authenticate, applicantController.toggleArchive);
router.patch('/:requestId/decline', authenticate, applicantController.declineApplicant);

module.exports = router;
