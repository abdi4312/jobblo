const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    lastName: { type: String, trim: true },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String },
    avatarPublicId: { type: String },
    bannerUrl: { type: String },
    bannerPublicId: { type: String },
    bio: { type: String },
    role: {
      type: String,
      enum: ["user", "superAdmin", "provider", "company"],
      default: "user",
    },
    companyName: { type: String, trim: true },
    orgNumber: { type: String, trim: true },
    orgType: { type: String, trim: true },
    locations: [{ type: String }],
    website: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    postNumber: { type: String, trim: true },
    postSted: { type: String, trim: true },
    birthDate: { type: String },
    gender: { type: String },
    address: { type: String },
    postNumber: { type: String },
    postSted: { type: String },
    country: { type: String },
    subscription: {
      type: String,
      enum: [
        "Standard",
        "Plus",
        "Pro",
        "Start",
        "Premium",
        "Fleksibel",
        "Jobblo Pluss",
      ],
      default: "Standard",
    },
    planType: {
      type: String,
      enum: ["business", "private"],
      default: "private",
      required: true,
    },
    experience: [
      {
        title: { type: String },
        company: { type: String },
        startDate: { type: Date },
        endDate: { type: Date },
        description: { type: String },
      },
    ],
    verified: { type: Boolean, default: false },
    isTrusted: { type: Boolean, default: false },
    lastLogin: { type: Date },
    availability: [{ start: Date, end: Date }],
    availabilityText: { type: String },
    skills: [{ type: String }],
    portfolio: [
      {
        title: { type: String },
        description: { type: String },
        imageUrl: { type: String },
        link: { type: String },
      },
    ],
    previousProjects: [
      {
        title: { type: String },
        description: { type: String },
        imageUrl: { type: String },
        category: { type: String },
        date: { type: Date },
        link: { type: String },
      },
    ],
    certifications: [
      {
        title: { type: String },
        url: { type: String },
        publicId: { type: String },
        issuedBy: { type: String },
        date: { type: Date },
        description: { type: String },
      },
    ],
    earnings: { type: Number, default: 0 },
    spending: { type: Number, default: 0 },
    oauthProviders: [
      {
        provider: { type: String },
        providerId: { type: String },
      },
    ],
    accountStatus: {
      type: String,
      enum: ["active", "inactive", "verified"],
      default: "active",
    },

    averageRating: {
      type: Number,
      default: 0,
    },

    reviewCount: {
      type: Number,
      default: 0,
    },
    completedJobs: {
      type: Number,
      default: 0,
    },

    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pointsBalance: {
      type: Number,
      default: 0,
    },
    pointsHistory: [
      {
        points: Number,
        reason: String,
        orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
        shopItemId: { type: mongoose.Schema.Types.ObjectId, ref: "JobbloShop" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // 📊 CONTACT LIMIT TRACKING
    monthlyContactUsage: {
      type: Number,
      default: 0,
    },
    lastContactReset: {
      type: Date,
      default: Date.now,
    },
    stripeCustomerId: {
      type: String,
    },
  },
  { timestamps: true },
);

// Add index to prevent duplicate OAuth providers
// Virtual field for totalEarned (maps to earnings)
userSchema.virtual("totalEarned").get(function () {
  return this.earnings || 0;
});

// Ensure virtuals are included when converting to JSON
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

userSchema.index({
  "oauthProviders.provider": 1,
  "oauthProviders.providerId": 1,
});

module.exports = mongoose.model("User", userSchema);
