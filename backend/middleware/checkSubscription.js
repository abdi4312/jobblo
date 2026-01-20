const Contract = require("../models/Contract");

const SubscriptionPlan = require("../models/SubscriptionPlan");
const Subscription = require("../models/Subscription");

const onMonthAge = new Date();

exports.checkSubscription = async (req, res, next) => {
  try {
    const user = req.user;
    const userId = req.user._id;
    console.log("userId", user);
    
    const subscription = await Subscription.findOne({ userId: userId });
    console.log("subscription.plan", subscription.currentPlan);

    if (!user.subscription) {
      return res.status(403).json({ message: "No subscription found" });
    }

    if (user.subscription !== subscription.currentPlan.plan) {
      return res.status(403).json({ message: "Subscription does not match" });
    }

    if (
      user.subscription.plan !== "Free" &&
      subscription.currentPlan.endDate < Date.now()
    ) {
      return res.status(403).json({ message: "Subscription expired" });
    }

    if (subscription.currentPlan.plan === "Free") {
      const freePlan = await SubscriptionPlan.findOne({
        name: subscription.currentPlan.plan,
      });

      console.log("freePlan", freePlan);

      onMonthAge.setMonth(onMonthAge.getMonth() - 1);

      const ContractsLastMonth = await Contract.countDocuments({
        clientId: userId,
        createdAt: { $gte: onMonthAge },
      });

      console.log("Contracts in last month:", ContractsLastMonth);

      if (ContractsLastMonth >= freePlan.freeViews) {
        return res.status(403).json({ message: "Upgrade to get access" });
      }
      //   const chat = await ChatMessage.find({ clientId: user._id });
      //   console.log("chat", chat);
      //   console.log("freePlan", freePlan);

      // if(freePlan.maxJobsPerMonth < user.jobsCreatedThisMonth){
      //     return res.status(403).json({ message: "Free plan limit reached" });
      // }
    }

    if (!subscription)
      return res.status(403).json({ message: "No subscription found" });
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
