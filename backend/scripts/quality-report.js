/**
 * Send one test run to the developer console's Test & Quality page.
 *
 *   npx jest --ci --json --outputFile=jest-results.json --coverage --coverageReporters=json-summary
 *   QUALITY_REPORT_URL=https://api.example/api/quality/report QUALITY_INGEST_TOKEN=… \
 *     node scripts/quality-report.js backend jest-results.json coverage/coverage-summary.json
 *
 * Reads Jest's own --json output and the coverage summary, sends totals, coverage and the
 * failing tests (never the test source or env). Branch / sha / run id come from the GitHub
 * Actions environment when present. Missing URL or token: prints and exits 0, so a fork or a
 * local run never fails because reporting is not set up.
 */
const fs = require('fs');
const path = require('path');

const [suite = 'backend', resultsFile = 'jest-results.json', coverageFile] = process.argv.slice(2);
const url = process.env.QUALITY_REPORT_URL;
const token = process.env.QUALITY_INGEST_TOKEN;
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const strip = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, ''); // ANSI colours

/** Pure: Jest --json output (+ coverage-summary.json) → report body. Exported for the test. */
function toReport(results, coverage, env = process.env, suiteName = suite) {
  const files = results?.testResults || [];
  const rel = (f) => path.relative(process.cwd(), f || '').replace(/\\/g, '/');
  const failures = [];
  for (const f of files) {
    for (const t of f.assertionResults || []) if (t.status === 'failed') failures.push({ file: rel(f.name), title: t.fullName || t.title, message: strip((t.failureMessages || [])[0]).split('\n').slice(0, 6).join('\n').slice(0, 1000) });
    // A file that fails to load has no assertions, only a message.
    if (f.status === 'failed' && !(f.assertionResults || []).some((t) => t.status === 'failed')) failures.push({ file: rel(f.name), title: '(test file failed to run)', message: strip(f.message).slice(0, 1000) });
  }
  const total = coverage?.total;
  const repo = env.GITHUB_REPOSITORY;
  return {
    suite: suiteName,
    source: env.GITHUB_ACTIONS ? 'ci' : 'local',
    branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || null,
    sha: env.GITHUB_SHA || null,
    ciRunId: env.GITHUB_RUN_ID ? `${env.GITHUB_RUN_ID}.${env.GITHUB_RUN_ATTEMPT || 1}` : null,
    ciUrl: repo && env.GITHUB_RUN_ID ? `https://github.com/${repo}/actions/runs/${env.GITHUB_RUN_ID}` : null,
    tests: results?.numTotalTests || 0,
    passed: results?.numPassedTests || 0,
    failed: (results?.numFailedTests || 0) + (results?.numRuntimeErrorTestSuites || 0),
    skipped: (results?.numPendingTests || 0) + (results?.numTodoTests || 0),
    durationMs: results?.startTime ? Math.max(0, Math.max(...files.map((f) => f.endTime || 0)) - results.startTime) : null,
    coverage: total ? { lines: total.lines?.pct, statements: total.statements?.pct, functions: total.functions?.pct, branches: total.branches?.pct } : undefined,
    failures: failures.slice(0, 100),
    slowest: files
      .map((f) => ({ file: rel(f.name), durationMs: (f.endTime || 0) - (f.startTime || 0) }))
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 10),
  };
}

async function main() {
  const results = readJson(resultsFile);
  if (!results) return console.log(`[quality] no Jest results at ${resultsFile} — nothing to report`);
  const report = toReport(results, coverageFile ? readJson(coverageFile) : null);
  console.log(`[quality] ${suite}: ${report.passed}/${report.tests} passed, ${report.failed} failed${report.coverage ? `, ${report.coverage.lines}% lines` : ''}`);
  if (!url || !token) return console.log('[quality] QUALITY_REPORT_URL / QUALITY_INGEST_TOKEN not set — not sent');
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Quality-Token': token }, body: JSON.stringify(report), signal: AbortSignal.timeout(15_000) });
  console.log(`[quality] sent: HTTP ${res.status}`);
}

if (require.main === module) main().catch((e) => console.log(`[quality] not sent: ${e.message}`));
module.exports = { toReport };
