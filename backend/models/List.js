const mongoose = require("mongoose");

const listSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    public: { type: Boolean, default: false },
    latestservice: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
    services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
    contributors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("List", listSchema);
