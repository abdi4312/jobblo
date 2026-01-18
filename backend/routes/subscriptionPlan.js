const express = require("express");
const router = express.Router();
const { getAllPlans } = require("../controllers/subscriptionPlanController");
const { authorizeUser } = require("../middleware/auth");

// GET /api/plans
router.get("/", authorizeUser, getAllPlans);

module.exports = router;
