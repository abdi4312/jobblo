const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { authenticate } = require("../middleware/auth");

router.post("/generate-job-info", authenticate, aiController.generateJobInfo);
router.post("/generate-title", authenticate, aiController.generateTitle);

module.exports = router;
