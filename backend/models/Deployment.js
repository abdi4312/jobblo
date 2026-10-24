const mongoose = require('mongoose');

/**
 * One row per API release, recorded by services/monitoring/deployments.js on the first boot
 * of a new version/commit (later boots of the same release only bump `boots`).
 */
const deploymentSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    commit: { type: String, default: null },
    branch: { type: String, default: null },
    environment: { type: String, default: null },
    host: { type: String, default: null },
    deployedAt: { type: Date, required: true, index: true },
    lastBootAt: { type: Date, default: null },
    boots: { type: Number, default: 1 },
    previous: { type: mongoose.Schema.Types.ObjectId, ref: 'Deployment', default: null },
  },
  { versionKey: false }
);

deploymentSchema.index({ version: 1, commit: 1 });

module.exports = mongoose.model('Deployment', deploymentSchema);
