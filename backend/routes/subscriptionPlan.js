const express = require('express');
const router = express.Router();
const {
  getAllPlans,
  updatePlan,
  createPlan,
  deletePlan,
} = require('../controllers/subscriptionPlanController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/plans (public)
router.get('/', getAllPlans);

// Admin routes
router.post('/', authenticate, requireAdmin, createPlan);
router.put('/:id', authenticate, requireAdmin, updatePlan);
router.delete('/:id', authenticate, requireAdmin, deletePlan);

module.exports = router;
