const express = require("express");
const router = express.Router();
const { getAllPlans } = require("../controllers/subscriptionPlanController");

// GET /api/plans (public)
router.get("/", getAllPlans);

module.exports = router;
