const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getMyApplications, withdrawApplication } = require('../controllers/myApplicationsController');

// GET  /api/my-applications        — list all my applications (as provider/applicant)
router.get('/', authenticate, getMyApplications);

// DELETE /api/my-applications/:requestId — withdraw a pending application
router.delete('/:requestId', authenticate, withdrawApplication);

module.exports = router;
