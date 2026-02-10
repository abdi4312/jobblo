const mongoose = require("mongoose");

const jobbloShop = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  coins: { type: Number, required: true },
  category: { type: String, required: true },
  isActive: { type: Boolean, default: true },
});

module.exports = mongoose.model("JobbloShop", jobbloShop);