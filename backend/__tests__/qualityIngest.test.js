const express = require('express');
const request = require('supertest');

jest.mock('../models/QualityRun', () => ({ create: jest.fn(async (doc) => ({ _id: 'r1', ...doc })) }));
const QualityRun = require('../models/QualityRun');
const { normalizeReport, flakyTests, evaluateGates, tokenOk } = require('../services/monitoring/quality');
const { toReport } = require('../scripts/quality-report');

const app = () => {
  const a = express();
  a.use(express.json());
  a.use('/api/quality', require('../routes/quality'));
  return a;
};

describe('quality intake (CI → /api/quality/report)', () => {
  afterEach(() => {
    delete process.env.QUALITY_INGEST_TOKEN;
    QualityRun.create.mockClear();
  });
  it('is off (404) until a token is configured', async () => {
    expect((await request(app()).post('/api/quality/report').send({ suite: 'backend' })).status).toBe(404);
  });
  it('rejects a wrong token and stores a valid report', async () => {
    process.env.QUALITY_INGEST_TOKEN = 'secret-token-123';
    expect((await request(app()).post('/api/quality/report').set('X-Quality-Token', 'nope').send({ suite: 'backend' })).status).toBe(401);
    const ok = await request(app()).post('/api/quality/report').set('X-Quality-Token', 'secret-token-123').send({ suite: 'backend', tests: 10, passed: 9, failed: 1, failures: [{ file: 'a.test.js', title: 'x works' }], ciUrl: 'https://evil.example/x' });
    expect(ok.status).toBe(201);
    expect(QualityRun.create).toHaveBeenCalledWith(expect.objectContaining({ suite: 'backend', failed: 1, ciUrl: null }));
  });
  it('validates the suite and compares tokens safely', () => {
    expect(normalizeReport({ suite: 'nope' }).error).toBeDefined();
    process.env.QUALITY_INGEST_TOKEN = 'abc';
    expect(tokenOk('abc')).toBe(true);
    expect(tokenOk('abcd')).toBe(false);
    expect(tokenOk(undefined)).toBe(false);
  });
});

describe('quality analysis', () => {
  const run = (sha, failures, extra = {}) => ({ suite: 'backend', sha, tests: 10, at: new Date(), failures: failures.map((title) => ({ file: 'a.test.js', title })), ...extra });
  it('flags tests that fail and pass on the same commit, not ones that always fail', () => {
    const f = flakyTests([run('s1', ['flaky one', 'always broken']), run('s1', ['always broken']), run('s2', ['other']), run('s3', ['solo'])]);
    expect(f.map((x) => x.id)).toEqual(['a.test.js › flaky one']);
  });
  it('blocks a release only on failing blocking gates', () => {
    expect(evaluateGates([{ key: 'a', state: 'pass', blocking: true }, { key: 'b', state: 'warn', blocking: false }]).verdict).toBe('warning');
    expect(evaluateGates([{ key: 'a', state: 'fail', blocking: true }])).toEqual({ verdict: 'blocked', blocking: ['a'] });
    expect(evaluateGates([{ key: 'a', state: 'fail', blocking: false }]).verdict).toBe('warning');
    expect(evaluateGates([{ key: 'a', state: 'pass', blocking: true }]).verdict).toBe('clear');
  });
  it('turns Jest --json output into a report', () => {
    const r = toReport(
      {
        numTotalTests: 3,
        numPassedTests: 1,
        numFailedTests: 1,
        numPendingTests: 1,
        numRuntimeErrorTestSuites: 1,
        startTime: 1000,
        testResults: [
          { name: `${process.cwd()}/__tests__/a.test.js`, status: 'failed', startTime: 1000, endTime: 1500, assertionResults: [{ status: 'failed', fullName: 'a works', failureMessages: ['\u001b[31mExpected 1\u001b[39m\nat line'] }, { status: 'passed', fullName: 'b' }] },
          { name: `${process.cwd()}/__tests__/b.test.js`, status: 'failed', message: 'Cannot find module x', startTime: 1000, endTime: 1100, assertionResults: [] },
        ],
      },
      { total: { lines: { pct: 41.5 }, statements: { pct: 40 }, functions: { pct: 30 }, branches: { pct: 20 } } },
      { GITHUB_ACTIONS: 'true', GITHUB_SHA: 'abc', GITHUB_REF_NAME: 'main', GITHUB_RUN_ID: '9', GITHUB_RUN_ATTEMPT: '2', GITHUB_REPOSITORY: 'o/r' },
      'backend'
    );
    expect(r).toMatchObject({ suite: 'backend', source: 'ci', branch: 'main', sha: 'abc', ciRunId: '9.2', ciUrl: 'https://github.com/o/r/actions/runs/9', tests: 3, failed: 2, skipped: 1, durationMs: 500, coverage: { lines: 41.5 } });
    expect(r.failures).toEqual([
      { file: '__tests__/a.test.js', title: 'a works', message: 'Expected 1\nat line' },
      { file: '__tests__/b.test.js', title: '(test file failed to run)', message: 'Cannot find module x' },
    ]);
  });
});
