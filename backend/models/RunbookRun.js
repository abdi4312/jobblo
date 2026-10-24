const mongoose = require('mongoose');

/** One execution of a runbook: the diagnostic results at that moment and the steps people ticked off. */
const runbookRunSchema = new mongoose.Schema(
  {
    runbook: { type: String, required: true, index: true },
    incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null, index: true },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    state: { type: String, enum: ['pass', 'warn', 'fail'], required: true },
    checks: [{ _id: false, key: String, title: String, state: String, detail: String, ms: Number }],
    steps: [{ _id: false, index: Number, doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, doneAt: Date, note: { type: String, maxlength: 1000 } }],
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    outcome: { type: String, maxlength: 2000, default: null },
  },
  { timestamps: true }
);

runbookRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('RunbookRun', runbookRunSchema);
