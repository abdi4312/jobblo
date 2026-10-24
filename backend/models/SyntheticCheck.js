const mongoose = require('mongoose');

/** A developer-defined HTTP probe. Hosts are restricted by services/monitoring/synthetic.js. */
const syntheticCheckSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true, maxlength: 500 },
    method: { type: String, enum: ['GET', 'HEAD'], default: 'GET' },
    expectStatus: { type: Number, default: 200, min: 100, max: 599 },
    expectText: { type: String, default: null, maxlength: 200 },
    enabled: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('SyntheticCheck', syntheticCheckSchema);
