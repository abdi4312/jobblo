const express = require("express");
const router = express.Router();
const { getAllPlans } = require("../controllers/subscriptionPlanController");
const { authenticate } = require("../middleware/auth");

// GET /api/plans
router.get("/", authenticate, getAllPlans);

module.exports = router;
