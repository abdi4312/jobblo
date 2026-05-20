/**
 * Validates a coupon against a subscription plan and a user.
 * @param {Object} coupon - The coupon document from DB
 * @param {Object} plan - The subscription plan document from DB
 * @param {string} userId - The ID of the user applying the coupon
 * @throws {Error} - Throws error with descriptive message if validation fails
 */
const validateCouponLogic = (coupon, plan, userId) => {
  // 1. Check if coupon exists and is active
  if (!coupon || !coupon.active) {
    throw new Error("Invalid or inactive coupon");
  }

  // 2. Check Active Date (Starting date)
  if (coupon.activeDate && new Date(coupon.activeDate) > new Date()) {
    throw new Error(
      `This coupon will be active starting ${new Date(coupon.activeDate).toLocaleDateString()}`,
    );
  }

  // 3. Check Expiry
  if (coupon.expiresDate && new Date(coupon.expiresDate) < new Date()) {
    throw new Error("Coupon has expired");
  }

  // 3. Check Usage Limit (Overall)
  if (coupon.usageLimit > 0 && coupon.usedBy.length >= coupon.usageLimit) {
    throw new Error("Coupon usage limit reached");
  }

  // 4. Check if User already used it
  if (userId) {
    const alreadyUsed = coupon.usedBy.some(
      (id) => id.toString() === userId.toString(),
    );
    if (alreadyUsed) {
      throw new Error("You have already used this coupon");
    }
  }

  // 5. Check Plan Compatibility
  if (
    plan &&
    coupon.targetPlanType !== "all" &&
    coupon.targetPlanType !== plan.type
  ) {
    throw new Error(
      `This coupon is only valid for ${coupon.targetPlanType} plans`,
    );
  }

  return true;
};

module.exports = { validateCouponLogic };
