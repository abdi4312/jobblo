const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },

    // selve kontrakten
    content: { type: String, required: true },
    price: { type: Number, required: true },
    ScheduledDate: { type: Date },
    address: { type: String },
    version: { type: Number, default: 1 },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    previousVersions: [
      {
        content: String,
        timestamp: Date,
      },
    ],

    // snapshots for juridisk bevis
    serviceSnapshot: {
      title: String,
      description: String,
      category: String,
    },

    // orderSnapshot: {
    //     price: Number,
    //     scheduledDate: Date,
    //     address: String
    // },

    customerSnapshot: {
      userId: String,
      name: String,
    },

    providerSnapshot: {
      userId: String,
      name: String,
    },

    // signering
    signedByCustomer: { type: Boolean, default: false },
    signedByProvider: { type: Boolean, default: false },
    signedByCustomerAt: Date,
    signedByProviderAt: Date,
    customerSignature: String,
    providerSignature: String,

    customerIp: String,
    providerIp: String,

    // status
    status: {
      type: String,
      enum: ["draft", "pending_signatures", "signed", "cancelled"],
      default: "draft",
    },

    // PDF-versjon
    pdfUrl: String,
  },
  { timestamps: true }
);
module.exports = mongoose.model("Contract", contractSchema);
