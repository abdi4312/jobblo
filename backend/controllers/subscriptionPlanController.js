const SubscriptionPlan = require("../models/SubscriptionPlan");

exports.getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find(); // Admin might want to see inactive ones too
    res.status(200).json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error fetching plans" });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Use findByIdAndUpdate with $set to replace nested objects and arrays correctly
    const plan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.status(200).json({ message: "Plan updated successfully", plan });
  } catch (err) {
    console.error("Update plan error:", err);
    res
      .status(500)
      .json({ message: "Server error updating plan", error: err.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const newPlan = new SubscriptionPlan(req.body);
    await newPlan.save();
    res
      .status(201)
      .json({ message: "Plan created successfully", plan: newPlan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error creating plan" });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findByIdAndDelete(id);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error deleting plan" });
  }
};
