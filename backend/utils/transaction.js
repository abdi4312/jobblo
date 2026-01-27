const Transaction = require("../models/Transaction");

exports.upsertTransaction = async ({
  userId,
  serviceId = null,

  planId = null,
  planName = null,
  planType = null,

  stripeSessionId,
  amount,
  currency = "nok",

  status = "pending",
  type,

  discountAmount = 0,
  discountCoupon = null,
  coupon = null,
}) => {
  if (!stripeSessionId) {
    throw new Error("stripeSessionId is required");
  }

  return await Transaction.findOneAndUpdate(
    { stripeSessionId },
    {
      userId,
      serviceId,

      planId,
      planName,
      planType,

      stripeSessionId,
      amount,
      currency,
      status,
      type,

      discountAmount,
      discountCoupon,
      coupon,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
};
