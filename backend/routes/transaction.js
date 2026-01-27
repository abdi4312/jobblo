const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const { authenticate, requireAdmin } = require("../middleware/auth");

// Sabhi transactions fetch karne ke liye (Admin only)
router.get("/", authenticate, requireAdmin, transactionController.getTransactions);

// Specific user ki transactions ke liye (User view)
// router.get("/user", authenticate, transactionController.getUserTransactions);

// Single transaction details ke liye
// router.get("/:id", authenticate, transactionController.getTransactionById);

router.patch("/:id/status",authenticate, requireAdmin, transactionController.updateTransactionStatus);

module.exports = router;