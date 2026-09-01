/* eslint-disable no-console */
/**
 * Build the BEFORE vs AFTER comparison.
 *
 *   node evals/report.js before-gpt35 after-4omini > evals/results/report.md
 *
 * Every case is listed, including the ones that regressed. Nothing is filtered.
 */
const fs = require('fs');
const path = require('path');
const { DIMENSIONS } = require('./rubric');

const [beforeTag, afterTag] = process.argv.slice(2);
if (!beforeTag || !afterTag) {
  console.error('usage: node evals/report.js <beforeTag> <afterTag>');
  process.exit(1);
}

const load = (tag) => JSON.parse(fs.readFileSync(path.join(__dirname, 'results', `${tag}.json`), 'utf8'));
const before = load(beforeTag);
const after = load(afterTag);

const byId = (run) => Object.fromEntries(run.results.map((r) => [r.id, r]));
const B = byId(before);
const A = byId(after);
const ids = before.results.map((r) => r.id);

const out = [];
const p = (s = '') => out.push(s);

p(`# Jobblo AI — BEFORE vs AFTER`);
p();
p(`| | BEFORE | AFTER |`);
p(`|---|---|---|`);
p(`| Prompt | v1 (frozen baseline) | v2 (services/ai/jobListingPrompt.js) |`);
p(`| Model | \`${before.summary.model}\` | \`${after.summary.model}\` |`);
p(`| Judge | \`${before.summary.judgeModel}\` | \`${after.summary.judgeModel}\` |`);
p(`| Cases | ${before.summary.caseCount} | ${after.summary.caseCount} |`);
p(`| Hard-check pass | ${before.summary.passed}/${before.summary.caseCount} | ${after.summary.passed}/${after.summary.caseCount} |`);
p(`| **Avg final score** | **${before.summary.avgFinalScore}** | **${after.summary.avgFinalScore}** |`);
p(`| Avg rubric mean | ${before.summary.avgRubricMean} | ${after.summary.avgRubricMean} |`);
p(`| Avg latency | ${before.summary.avgLatencyMs} ms | ${after.summary.avgLatencyMs} ms |`);
p(`| Avg prompt tokens | ${before.summary.avgPromptTokens} | ${after.summary.avgPromptTokens} |`);
p(`| Avg completion tokens | ${before.summary.avgCompletionTokens} | ${after.summary.avgCompletionTokens} |`);
p(`| Run cost (all cases) | $${before.summary.totalCostUsd} | $${after.summary.totalCostUsd} |`);
p();

const delta = after.summary.avgFinalScore - before.summary.avgFinalScore;
const pct = (delta / before.summary.avgFinalScore) * 100;
p(`**Improvement: ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} points (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)**`);
p();

// ── Per-dimension ────────────────────────────────────────────────────────────
p(`## Dimension averages`);
p();
p(`| Dimension | Before | After | Δ |`);
p(`|---|---|---|---|`);
for (const d of DIMENSIONS) {
  const avg = (run) => {
    const v = run.results.map((r) => r.judge && r.judge[d]).filter(Number.isFinite);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const b = avg(before);
  const a = avg(after);
  p(`| ${d} | ${b.toFixed(2)} | ${a.toFixed(2)} | ${a - b >= 0 ? '+' : ''}${(a - b).toFixed(2)} |`);
}
p();

// ── Per-case ─────────────────────────────────────────────────────────────────
let improved = 0;
let equal = 0;
let regressed = 0;
const EPS = 0.15; // scores within this are treated as unchanged, not as movement

p(`## Per-case results`);
p();
p(`| Case | Bucket | Lang | Before | After | Δ | Notes |`);
p(`|---|---|---|---|---|---|---|`);
for (const id of ids) {
  const b = B[id];
  const a = A[id];
  const d = a.finalScore - b.finalScore;
  if (d > EPS) improved += 1;
  else if (d < -EPS) regressed += 1;
  else equal += 1;

  const notes = [];
  if (b.failures.length) notes.push(`before: ${b.failures.map((f) => f.code).join(', ')}`);
  if (a.failures.length) notes.push(`**after: ${a.failures.map((f) => f.code).join(', ')}**`);
  if (!notes.length) notes.push('both clean');

  p(
    `| ${id} | ${b.bucket} | ${b.lang} | ${b.finalScore.toFixed(2)} | ${a.finalScore.toFixed(2)} | ${d >= 0 ? '+' : ''}${d.toFixed(2)} | ${notes.join(' · ')} |`
  );
}
p();
p(`- improved: **${improved}**`);
p(`- unchanged (within ±${EPS}): **${equal}**`);
p(`- regressed: **${regressed}**`);
p();

// ── Regressions in full ──────────────────────────────────────────────────────
const regressions = ids
  .map((id) => ({ id, b: B[id], a: A[id], d: A[id].finalScore - B[id].finalScore }))
  .filter((r) => r.d < -EPS)
  .sort((x, y) => x.d - y.d);

p(`## Regressions (${regressions.length})`);
p();
if (!regressions.length) p('_None._');
for (const r of regressions) {
  p(`### ${r.id} — ${r.b.finalScore.toFixed(2)} → ${r.a.finalScore.toFixed(2)} (${r.d.toFixed(2)})`);
  p();
  p('**BEFORE**');
  p('```');
  p(`${r.b.output?.title}\n\n${r.b.output?.description}`);
  p('```');
  p('**AFTER**');
  p('```');
  p(`${r.a.output?.title}\n\n${r.a.output?.description}`);
  p('```');
  p(`After failures: ${r.a.failures.map((f) => `${f.code}(${f.detail})`).join(', ') || 'none'}`);
  p();
}

// ── Worst remaining ──────────────────────────────────────────────────────────
p(`## Worst remaining AFTER responses`);
p();
const worst = [...after.results].sort((x, y) => x.finalScore - y.finalScore).slice(0, 3);
for (const r of worst) {
  p(`### ${r.id} — ${r.finalScore.toFixed(2)}`);
  p();
  p(`Input: \`${JSON.stringify(r.input)}\``);
  p('```');
  p(`${r.output?.title}\n\n${r.output?.description}`);
  if (r.output?.openQuestions?.length) p(`\nopenQuestions: ${JSON.stringify(r.output.openQuestions)}`);
  p('```');
  p(`Failures: ${r.failures.map((f) => `${f.code}(${f.detail})`).join(', ') || 'none'}`);
  p(`Judge: ${r.judge?.rationale || 'n/a'}`);
  p();
}

// ── Full side-by-side ────────────────────────────────────────────────────────
p(`## Full side-by-side`);
p();
for (const id of ids) {
  const b = B[id];
  const a = A[id];
  p(`### ${id} (${b.bucket}, ${b.lang}) — ${b.finalScore.toFixed(2)} → ${a.finalScore.toFixed(2)}`);
  p();
  p(`**Input**: \`${JSON.stringify(b.input)}\``);
  p();
  p(`**BEFORE**`);
  p('```');
  p(`${b.output?.title}\n\n${b.output?.description}`);
  p('```');
  p(`**AFTER**`);
  p('```');
  p(`${a.output?.title}\n\n${a.output?.description}`);
  if (a.output?.openQuestions?.length) p(`\nopenQuestions: ${JSON.stringify(a.output.openQuestions)}`);
  p('```');
  p();
}

console.log(out.join('\n'));
