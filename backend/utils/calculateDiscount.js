function calculateDiscount(planPrice, coupon) {
  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    discountAmount = (planPrice * coupon.amount) / 100;
  } else {
    // fixed amount
    discountAmount = coupon.amount;
  }
  const finalPrice = Math.max(planPrice - discountAmount, 0);
  return { originalPrice: planPrice, discountAmount, finalPrice, couponId: coupon._id };
}

module.exports = calculateDiscount;
