const SubscriptionPlan = require('../models/SubscriptionPlan');
const calculateDiscount = require('../utils/calculateDiscount');
const { validateCouponLogic } = require('../utils/couponValidation');

const Coupon = require('../models/Coupon');

// =========================
// Create Coupon (Admin Only)
// =========================
exports.createCoupon = async (req, res) => {
  try {
    const { name, code, type, amount, activeDate, expiresDate, usageLimit, targetPlanType } =
      req.body;

    const existing = await Coupon.findOne({ code });
    if (existing) return res.status(400).json({ error: 'Coupon code already exists' });

    const coupon = await Coupon.create({
      createdBy: req.user._id,
      name,
      code,
      type: type || 'percentage',
      amount,
      activeDate: activeDate || Date.now(),
      expiresDate,
      usageLimit: usageLimit || 0,
      targetPlanType: targetPlanType || 'all',
      usedBy: [],
    });

    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// =========================
// Get All Coupons (Admin Only)
// =========================
exports.getAllCoupons = async (req, res) => {
  try {
    // 1. Automatically mark expired coupons as inactive (Ye step pehle hi hona chahiye)
    await Coupon.updateMany(
      { expiresDate: { $lt: new Date() }, active: true },
      { $set: { active: false } }
    );

    // 2. Pagination Logic
    const page = parseInt(req.query.page) || 1; // Default page 1
    const limit = parseInt(req.query.limit) || 10; // Default limit 10
    const skip = (page - 1) * limit;

    // 3. Get total count for frontend pagination UI
    const totalCoupons = await Coupon.countDocuments();

    // 4. Fetch Coupons with limit and skip
    // .sort({ createdAt: -1 }) add kiya hai taaki naye coupons pehle dikhein
    const coupons = await Coupon.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

    // 5. Send Response with Meta Data
    res.json({
      coupons,
      currentPage: page,
      totalPages: Math.ceil(totalCoupons / limit),
      totalCoupons,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =========================
// Update Coupon (Admin Only)
// =========================
exports.updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      type,
      amount,
      activeDate,
      expiresDate,
      usageLimit,
      targetPlanType,
      active,
    } = req.body;

    const updateFields = {};

    if (typeof name === 'string' && name.trim()) {
      updateFields.name = name.trim();
    }

    if (typeof code === 'string' && code.trim()) {
      updateFields.code = code.toUpperCase().trim();
    }

    if (type) updateFields.type = type;

    if (amount !== undefined) {
      updateFields.amount = Number(amount);
    }

    if (usageLimit !== undefined) updateFields.usageLimit = Number(usageLimit);
    if (targetPlanType) updateFields.targetPlanType = targetPlanType;

    if (activeDate && activeDate.trim() !== '') {
      const parsedActiveDate = new Date(activeDate);
      if (!isNaN(parsedActiveDate.getTime())) {
        updateFields.activeDate = parsedActiveDate;
      }
    }

    let parsedExpiryDate;

    if (expiresDate) {
      parsedExpiryDate = new Date(expiresDate);
      updateFields.expiresDate = parsedExpiryDate;
    }

    // ✅ ACTIVE LOGIC
    if (typeof active === 'boolean') {
      // agar frontend se active bheja ho
      updateFields.active = active;
    } else if (parsedExpiryDate) {
      // agar active nahi bheja, to expiresDate se decide karo
      updateFields.active = parsedExpiryDate > new Date();
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedCoupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: updatedCoupon,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }
    res.status(500).json({ error: err.message });
  }
};

// =========================
// Delete Coupon (Admin Only)
// =========================
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =========================
// Validate Coupon (User)
// =========================
exports.validateCoupon = async (req, res) => {
  try {
    const { code, planId } = req.body;
    const userId = req.user._id;

    if (!code || !planId) {
      return res.status(400).json({ error: 'Code and Plan ID are required' });
    }

    const [coupon, plan] = await Promise.all([
      Coupon.findOne({ code: code.toUpperCase() }),
      SubscriptionPlan.findById(planId),
    ]);

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // logic moved to utils/couponValidation.js
    validateCouponLogic(coupon, plan, userId);

    const pricing = calculateDiscount(plan.price, coupon);

    res.json({
      success: true,
      message: 'Coupon validated successfully',
      data: {
        code: coupon.code,
        type: coupon.type,
        amount: coupon.amount,
        originalPrice: pricing.originalPrice,
        discountAmount: pricing.discountAmount,
        finalPrice: pricing.finalPrice,
        couponId: coupon._id,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
