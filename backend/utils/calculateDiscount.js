function calculateDiscount(planPrice, coupon) {
  let discountAmount = 0;
  if (coupon.amount <= 100) {
    discountAmount = (planPrice * coupon.amount) / 100;
  } else {
    discountAmount = coupon.amount;
  }
  const finalPrice = Math.max(planPrice - discountAmount, 0);
  return { originalPrice: planPrice, discountAmount, finalPrice, couponId: coupon._id };
}

module.exports = calculateDiscount;
