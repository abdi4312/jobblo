const SubscriptionPlan = require("../models/SubscriptionPlan");

exports.getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true });
    res.status(200).json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching plans" });
  }
};
