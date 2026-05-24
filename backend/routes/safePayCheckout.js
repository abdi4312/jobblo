const express = require("express");
const router = express.Router();
const SafePayCheckoutController = require("../controllers/SafePayCheckoutController");
const { authenticate } = require("../middleware/auth");

router.get(
  "/details/:orderId",
  authenticate,
  SafePayCheckoutController.getCheckoutDetails,
);
router.post(
  "/create-session",
  authenticate,
  SafePayCheckoutController.createSafePaySession,
);
router.post(
  "/approve",
  authenticate,
  SafePayCheckoutController.approveAndPayout,
);

module.exports = router;
