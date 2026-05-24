const express = require("express");
const router = express.Router();
const safePayController = require("../controllers/safePayController");
const { authenticate } = require("../middleware/auth");

router.post("/create-contract", authenticate, safePayController.createContract);
router.get("/contract/:orderId", authenticate, safePayController.getContract);

module.exports = router;
