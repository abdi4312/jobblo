/* eslint-disable no-console */
/**
 * Recompute hard checks and final scores from an already-saved run.
 *
 *   node evals/rescore.js before-gpt35 before-4omini after-gpt4omini
 *
 * The judge's 1-5 dimension scores are kept exactly as they were — only the
 * deterministic layer is re-derived. This lets a detector bug be fixed without
 * re-billing the API and without giving any variant a fresh roll of the dice.
 * Rewrites each results file in place.
 */
const fs = require('fs');
const path = require('path');
const { cases, CATEGORIES } = require('./cases');
const { hardChecks, score } = require('./rubric');

const tags = process.argv.slice(2);
if (!tags.length) {
  console.error('usage: node evals/rescore.js <tag> [<tag>...]');
  process.exit(1);
}

for (const tag of tags) {
  const file = path.join(__dirname, 'results', `${tag}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  for (const r of data.results) {
    const testCase = cases.find((c) => c.id === r.id);
    if (!testCase) continue;
    if (!r.output) continue; // API error / unparseable — leave the failure as-is
    const { failures, metrics } = hardChecks(testCase, r.output, CATEGORIES);
    const scored = score(r.judge, failures);
    r.failures = failures;
    r.metrics = metrics;
    Object.assign(r, scored);
  }

  const results = data.results;
  const passed = results.filter((r) => r.passed).length;
  data.summary.passed = passed;
  data.summary.failed = results.length - passed;
  data.summary.avgFinalScore = Number(
    (results.reduce((a, r) => a + r.finalScore, 0) / results.length).toFixed(3)
  );
  data.summary.avgRubricMean = Number(
    (results.reduce((a, r) => a + r.rubricMean, 0) / results.length).toFixed(3)
  );
  data.summary.rescoredAt = new Date().toISOString();

  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(
    `${tag}: pass ${passed}/${results.length}  avgFinal ${data.summary.avgFinalScore}  avgRubric ${data.summary.avgRubricMean}`
  );
}
