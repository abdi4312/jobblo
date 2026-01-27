const express = require("express");
const router = express.Router();
const CouponController = require("../controllers/couponController");
const { authenticate, requireAdmin } = require("../middleware/auth");

// =========================
// Admin Routes
// =========================

// Create coupon (Admin only)
router.post("/", authenticate, requireAdmin, CouponController.createCoupon);

// Get all coupons (Admin or User can see)
router.get("/", authenticate, CouponController.getAllCoupons);

// Update coupon (Admin only)
router.put("/:id", authenticate, requireAdmin, CouponController.updateCoupon);

// Delete coupon (Admin only)
router.delete("/:id", authenticate, requireAdmin, CouponController.deleteCoupon);

// =========================
// User Route
// =========================

// Redeem coupon (User only)
router.post("/validate", authenticate, CouponController.validateCoupon);

module.exports = router;
