const mongoose = require("mongoose");

const HeroSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    subtitleSecondary: { type: String },
    description: { type: String },
    image: { type: String, required: true },

    activeFrom: { type: Date, required: true },
    expireAt: { type: Date, required: true },

    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);
// 🔁 Auto active / expire logic
HeroSchema.pre("save", function (next) {
  const now = new Date();

  if (now >= this.activeFrom && now <= this.expireAt) {
    this.isActive = true;
  } else {
    this.isActive = false;
  }

  next();
});
// ⚠️ Dette er den viktige linjen du mangler
module.exports = mongoose.model("Hero", HeroSchema);
