const Coupon = require("../models/Coupon");

// =========================
// Create Coupon (Admin Only)
// =========================
exports.createCoupon = async (req, res) => {
  try {
    const { name, code, amount, expiresDate } = req.body;

    const existing = await Coupon.findOne({ code });
    if (existing) 
      return res.status(400).json({ error: "Coupon code already exists" });

    const coupon = await Coupon.create({
      createdBy: req.user._id,
      name,
      code,
      amount,
      expiresDate,
      usedBy: [] // Initialize empty array
    });

    res.status(201).json(coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// =========================
// Get All Coupons
// =========================
exports.getAllCoupons = async (req, res) => {
  try {
    // Automatically mark expired coupons as inactive
    await Coupon.updateMany(
      { expiresDate: { $lt: new Date() }, active: true },
      { $set: { active: false } }
    );

    const coupons = await Coupon.find();
    res.json(coupons);
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
    const updateData = req.body;

    const coupon = await Coupon.findByIdAndUpdate(id, updateData, { new: true });
    if (!coupon) 
      return res.status(404).json({ error: "Coupon not found" });

    res.json(coupon);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// =========================
// Delete Coupon (Admin Only)
// =========================
exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) 
      return res.status(404).json({ error: "Coupon not found" });

    res.json({ message: "Coupon deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =========================
// Redeem Coupon (User)
// =========================
exports.redeemCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    const coupon = await Coupon.findOne({ code });
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    if (!coupon.active) return res.status(400).json({ error: "Coupon inactive or expired" });

    if (coupon.usedBy.includes(userId))
      return res.status(400).json({ error: "You have already used this coupon" });

    // Mark coupon as used by user
    coupon.usedBy.push(userId);
    await coupon.save();

    res.json({ message: "Coupon applied successfully", coupon });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
