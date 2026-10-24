const crypto = require('crypto');

/**
 * Test & quality center: test runs reported by CI, failures, flaky tests (fail and pass on
 * the same commit), coverage trend, GitHub Actions checks and release-blocking gates.
 */

const SUITES = ['backend', 'frontend', 'mobile', 'e2e'];
const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const int = (v) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const pct = (v) => (Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 100) / 100 : undefined);

/** Constant-time token check; ingest is off unless QUALITY_INGEST_TOKEN is set. */
function tokenOk(given, expected = process.env.QUALITY_INGEST_TOKEN) {
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Pure: whitelist one report. Unit-tested. */
function normalizeReport(body, now = new Date()) {
  const b = body && typeof body === 'object' ? body : {};
  if (!SUITES.includes(b.suite)) return { error: `suite must be one of ${SUITES.join(', ')}` };
  const c = b.coverage && typeof b.coverage === 'object' ? b.coverage : null;
  return {
    doc: {
      at: now,
      suite: b.suite,
      source: b.source === 'local' ? 'local' : 'ci',
      branch: str(b.branch, 120),
      sha: str(b.sha, 40),
      ciRunId: str(String(b.ciRunId ?? ''), 40),
      ciUrl: typeof b.ciUrl === 'string' && /^https:\/\/github\.com\//.test(b.ciUrl) ? b.ciUrl.slice(0, 300) : null,
      tests: int(b.tests),
      passed: int(b.passed),
      failed: int(b.failed),
      skipped: int(b.skipped),
      durationMs: int(b.durationMs) || null,
      coverage: c ? { lines: pct(c.lines), statements: pct(c.statements), functions: pct(c.functions), branches: pct(c.branches) } : undefined,
      failures: (Array.isArray(b.failures) ? b.failures : []).slice(0, 100).map((f) => ({ file: str(f?.file, 200), title: str(f?.title, 300), message: str(f?.message, 1000) })).filter((f) => f.title),
      slowest: (Array.isArray(b.slowest) ? b.slowest : []).slice(0, 10).map((s) => ({ file: str(s?.file, 200), durationMs: int(s?.durationMs) })).filter((s) => s.file),
    },
  };
}

const testId = (f) => `${f.file || ''} › ${f.title}`;

/**
 * Pure: tests that failed in one run and passed in another run of the same suite on the
 * same commit — the code did not change, the result did. Unit-tested.
 */
function flakyTests(runs) {
  const bySha = new Map();
  for (const r of runs) {
    if (!r.sha || !r.tests) continue;
    const k = `${r.suite}|${r.sha}`;
    if (!bySha.has(k)) bySha.set(k, []);
    bySha.get(k).push(r);
  }
  const flaky = new Map();
  for (const group of bySha.values()) {
    if (group.length < 2) continue;
    const failedIn = new Map();
    for (const r of group) for (const f of r.failures || []) failedIn.set(testId(f), [...(failedIn.get(testId(f)) || []), r]);
    for (const [id, failedRuns] of failedIn) {
      if (failedRuns.length === group.length) continue; // failed every time: a real failure
      const f = flaky.get(id) || { id, suite: group[0].suite, flips: 0, lastAt: null, shas: new Set() };
      f.flips += 1;
      f.shas.add(group[0].sha);
      f.lastAt = failedRuns.reduce((a, r) => (!a || r.at > a ? r.at : a), f.lastAt);
      flaky.set(id, f);
    }
  }
  return [...flaky.values()].map((f) => ({ ...f, shas: [...f.shas].slice(0, 5) })).sort((a, b) => b.flips - a.flips);
}

/** Pure: gate list → verdict. Unit-tested. */
function evaluateGates(gates) {
  const blocking = gates.filter((g) => g.state === 'fail' && g.blocking);
  return { verdict: blocking.length ? 'blocked' : gates.some((g) => g.state === 'fail' || g.state === 'warn') ? 'warning' : 'clear', blocking: blocking.map((g) => g.key) };
}

async function overview({ days = 30 } = {}) {
  const QualityRun = require('../../models/QualityRun');
  const from = new Date(Date.now() - days * 86_400_000);
  const [runs, github, breaking, critical] = await Promise.all([
    QualityRun.find({ at: { $gte: from } }).sort({ at: -1 }).limit(500).lean(),
    require('./github').githubRuns(),
    require('../../models/ContractEvent').countDocuments({ breaking: true, acknowledgedAt: null }),
    require('../../models/Incident').countDocuments({ status: { $ne: 'resolved' }, severity: 'critical' }),
  ]);
  const main = process.env.QUALITY_MAIN_BRANCH || 'main';
  const latestOf = (suite, branch) => runs.find((r) => r.suite === suite && (!branch || r.branch === branch));
  const suites = SUITES.filter((s) => runs.some((r) => r.suite === s)).map((suite) => {
    const mine = runs.filter((r) => r.suite === suite);
    const latest = latestOf(suite, main) || mine[0];
    const prev = mine.find((r) => r !== latest && r.branch === latest.branch && r.coverage?.lines != null);
    return {
      suite,
      latest,
      runs: mine.length,
      passRate: Math.round((mine.filter((r) => !r.failed).length / mine.length) * 1000) / 10,
      coverageDelta: latest.coverage?.lines != null && prev ? Math.round((latest.coverage.lines - prev.coverage.lines) * 100) / 100 : null,
    };
  });

  // Most frequently failing tests.
  const failCount = new Map();
  for (const r of runs) for (const f of r.failures || []) {
    const id = testId(f);
    const e = failCount.get(id) || { id, suite: r.suite, file: f.file, title: f.title, message: f.message, count: 0, lastAt: r.at, branches: new Set() };
    e.count += 1;
    if (r.branch) e.branches.add(r.branch);
    failCount.set(id, e);
  }
  const flaky = flakyTests(runs);

  // CI checks from GitHub Actions.
  const ci = github.runs || [];
  const finished = ci.filter((r) => r.status === 'completed');
  const lastMainCi = ci.find((r) => r.branch === main && r.status === 'completed');

  const minCoverage = Number(process.env.QUALITY_MIN_COVERAGE) || null;
  const maxDrop = Number(process.env.QUALITY_MAX_COVERAGE_DROP) || 1;
  const gates = [];
  for (const s of suites) {
    gates.push({ key: `${s.suite}_tests`, label: `${s.suite}: tests pass on ${s.latest.branch || 'latest run'}`, blocking: true, state: s.latest.failed ? 'fail' : 'pass', detail: s.latest.failed ? `${s.latest.failed} failing (${s.latest.sha?.slice(0, 7) || 'no sha'})` : `${s.latest.passed}/${s.latest.tests} passed` });
    if (s.latest.coverage?.lines != null) {
      const below = minCoverage && s.latest.coverage.lines < minCoverage;
      const dropped = s.coverageDelta != null && s.coverageDelta < -maxDrop;
      gates.push({ key: `${s.suite}_coverage`, label: `${s.suite}: coverage${minCoverage ? ` ≥ ${minCoverage}%` : ''} and not dropping more than ${maxDrop} pt`, blocking: true, state: below || dropped ? 'fail' : 'pass', detail: `${s.latest.coverage.lines}% lines${s.coverageDelta != null ? ` (${s.coverageDelta >= 0 ? '+' : ''}${s.coverageDelta} pt)` : ''}` });
    }
  }
  if (!suites.length) gates.push({ key: 'reports', label: 'Test results reported', blocking: false, state: 'warn', detail: 'No test run reported yet — set QUALITY_INGEST_TOKEN and the CI secrets (see docs).' });
  gates.push({ key: 'flaky', label: 'No flaky tests', blocking: false, state: flaky.length ? 'warn' : 'pass', detail: flaky.length ? `${flaky.length} test(s) failed and passed on the same commit` : 'None detected' });
  gates.push(
    github.configured === false || github.error
      ? { key: 'ci', label: `CI green on ${main}`, blocking: false, state: 'warn', detail: github.reason || github.error }
      : { key: 'ci', label: `CI green on ${main}`, blocking: true, state: !lastMainCi ? 'warn' : lastMainCi.conclusion === 'success' ? 'pass' : 'fail', detail: lastMainCi ? `${lastMainCi.name}: ${lastMainCi.conclusion} (${lastMainCi.sha})` : `No finished run on ${main} in the last 25` }
  );
  gates.push({ key: 'contracts', label: 'No unacknowledged breaking API change', blocking: true, state: breaking ? 'fail' : 'pass', detail: breaking ? `${breaking} change(s) — acknowledge on API Contracts after checking clients` : 'None' });
  gates.push({ key: 'incidents', label: 'No open critical incident', blocking: true, state: critical ? 'fail' : 'pass', detail: critical ? `${critical} open` : 'None' });

  return {
    days,
    mainBranch: main,
    ingestEnabled: Boolean(process.env.QUALITY_INGEST_TOKEN),
    gates,
    ...evaluateGates(gates),
    suites,
    runs: runs.slice(0, 50).map(({ failures, slowest, ...r }) => ({ ...r, failures: (failures || []).length })),
    failing: [...failCount.values()].sort((a, b) => b.count - a.count).slice(0, 25).map((e) => ({ ...e, branches: [...e.branches].slice(0, 5) })),
    flaky,
    coverage: runs.filter((r) => r.coverage?.lines != null).reverse().map((r) => ({ t: r.at, suite: r.suite, lines: r.coverage.lines, branches: r.coverage.branches, functions: r.coverage.functions })),
    ci: {
      configured: github.configured !== false && !github.error,
      reason: github.reason || github.error || null,
      runs: ci,
      successRate: finished.length ? Math.round((finished.filter((r) => r.conclusion === 'success').length / finished.length) * 1000) / 10 : null,
      reruns: ci.filter((r) => r.attempt > 1).length,
    },
  };
}

async function latestFailures(id) {
  const run = await require('../../models/QualityRun').findById(id).lean();
  return run || null;
}

module.exports = { tokenOk, normalizeReport, flakyTests, evaluateGates, overview, latestFailures, SUITES };
