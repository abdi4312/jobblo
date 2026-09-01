/* eslint-disable no-console */
/**
 * Re-run the LLM judge over the outputs already stored in a results file,
 * without re-calling the model under test.
 *
 *   node evals/rejudge.js before-gpt35 before-4omini
 *
 * Used when the rubric text itself is corrected. Keeping the generated outputs
 * fixed matters: re-generating would resample the model and mix a rubric change
 * with sampling noise, and the two arms would no longer be compared on the same
 * text. Rewrites each results file in place.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { cases, CATEGORIES } = require('./cases');
const { hardChecks, score } = require('./rubric');
const { judge, JUDGE_MODEL } = require('./judge');

// The judge model sits on a 30k TPM org cap. maxRetries is high and
// concurrency is 2 so a 429 is absorbed by backoff instead of silently
// leaving half the file scored under the old rubric.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 8 });
const tags = process.argv.slice(2);

async function pool(items, size, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    })
  );
}

(async () => {
  for (const tag of tags) {
    const file = path.join(__dirname, 'results', `${tag}.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const failed = [];

    await pool(data.results, 2, async (r) => {
      const testCase = cases.find((c) => c.id === r.id);
      if (!testCase || !r.output) return;
      try {
        const j = await judge(openai, testCase, r.output);
        r.judge = j.scores;
        r.judgeUsage = j.usage;
      } catch (err) {
        console.error(`  rejudge FAILED ${r.id}: ${err.message}`);
        failed.push(r.id);
        return;
      }
      const { failures, metrics } = hardChecks(testCase, r.output, CATEGORIES);
      r.failures = failures;
      r.metrics = metrics;
      Object.assign(r, score(r.judge, failures));
    });

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
    data.summary.judgeModel = JUDGE_MODEL;
    data.summary.rejudgedAt = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(
      `${tag}: pass ${passed}/${results.length}  avgFinal ${data.summary.avgFinalScore}  avgRubric ${data.summary.avgRubricMean}`
    );
    if (failed.length) {
      // A partially re-judged file mixes two rubrics and is not comparable.
      console.error(`  ${failed.length} case(s) NOT re-judged: ${failed.join(', ')}`);
      console.error('  File is INCONSISTENT — re-run before using these numbers.');
      process.exitCode = 1;
    }
  }
})();
