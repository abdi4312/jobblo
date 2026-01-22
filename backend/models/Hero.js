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

// 🔁 Auto active / expire logic (Fixed Version)
HeroSchema.pre("save", async function () {
  const now = new Date();

  // "this" keyword current document ko refer karta hai
  if (this.activeFrom && this.expireAt) {
    this.isActive = now >= this.activeFrom && now <= this.expireAt;
  }
  
  // Async hook mein next() ki zaroorat nahi hoti, Mongoose khud handle kar leta hai
});

module.exports = mongoose.model("Hero", HeroSchema);