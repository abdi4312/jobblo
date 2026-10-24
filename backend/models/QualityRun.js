const mongoose = require('mongoose');

/**
 * One test-suite run reported by CI (scripts/quality-report.js → POST /api/quality/report):
 * totals, coverage and the failing tests. Passing tests are implied (total − failed), which
 * is enough to spot a test that fails and passes on the same commit (flaky). Kept 180 days.
 */
const qualityRunSchema = new mongoose.Schema(
  {
    at: { type: Date, required: true },
    suite: { type: String, required: true }, // backend | frontend | mobile | e2e
    source: { type: String, enum: ['ci', 'local'], default: 'ci' },
    branch: { type: String, default: null },
    sha: { type: String, default: null },
    ciRunId: { type: String, default: null },
    ciUrl: { type: String, default: null },
    tests: { type: Number, default: 0 },
    passed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    durationMs: { type: Number, default: null },
    coverage: { lines: Number, statements: Number, functions: Number, branches: Number },
    failures: [{ _id: false, file: String, title: String, message: String }],
    slowest: [{ _id: false, file: String, durationMs: Number }],
  },
  { versionKey: false }
);

qualityRunSchema.index({ suite: 1, at: -1 });
qualityRunSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model('QualityRun', qualityRunSchema);
