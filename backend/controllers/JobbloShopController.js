const JobbloShop = require("../models/JobbloShop");
const User = require("../models/User");

exports.getjobbloShop = async (req, res) => {
  try {
    const jobbloShop = await JobbloShop.find({ isActive: true });

    if (!jobbloShop || jobbloShop.length === 0) {
      return res.status(404).json({ message: "Ingen aktive butikker funnet" });
    }

    res.status(200).json(jobbloShop);
  } catch (err) {
    console.error("Feil ved henting av JobbloShop:", err);
    res.status(500).json({ error: "Kunne ikke hente jobbloShop data" });
  }
};

exports.buyItem = async (req, res) => {
  const { id } = req.body;
  const userId = req.user.id;
  try {
    const item = await JobbloShop.findById(id);

    if (!item) {
      return res.status(404).json({ error: "Item database mein nahi mila" });
    }

    if (!item.isActive) {
      return res.status(400).json({ error: "Ye item ab active nahi hai" });
    }

    const cost = item.coins;
    if (cost === undefined) {
      return res
        .status(500)
        .json({ error: "Item ki price model mein defined nahi hai" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User profile nahi mili" });
    }

    if (user.pointsBalance < cost) {
      return res
        .status(400)
        .json({ error: "Aapke paas kaafi points nahi hain!" });
    }

    user.pointsBalance -= cost;

    user.pointsHistory.push({
      points: -cost,
      type: "spend",
      reason:  item.title,
      shopItemId: item._id,
      createdAt: new Date(),
    });
    await user.save();

    res.status(200).json({
      success: true,
      message: "Purchase successful!",
      remainingPoints: user.pointsBalance,
    });
  } catch (err) {
    console.error("BUY_ERROR DETAILS:", err);
    if (err.name === "CastError") {
      return res.status(400).json({ error: "Invalid ID format" });
    }
    res.status(500).json({ error: "Server Error: " + err.message });
  }
};
