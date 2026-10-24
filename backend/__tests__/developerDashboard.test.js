const { requireDeveloper, requireAdmin } = require('../middleware/auth');
const { percentile, toRow } = require('../middleware/requestMetrics');
const { parseRange } = require('../controllers/developer/developerController');

function run(mw, role) {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json() { return this; } };
  let passed = false;
  mw({ user: role ? { role } : undefined }, res, () => { passed = true; });
  return passed ? 'next' : res.statusCode;
}

test('developer routes admit developer and superAdmin only', () => {
  expect(run(requireDeveloper, 'developer')).toBe('next');
  expect(run(requireDeveloper, 'superAdmin')).toBe('next');
  expect(run(requireDeveloper, 'user')).toBe(403);
  expect(run(requireDeveloper, 'provider')).toBe(403);
  expect(run(requireDeveloper, undefined)).toBe(401);
});

test('admin routes stay superAdmin-only', () => {
  expect(run(requireAdmin, 'superAdmin')).toBe('next');
  expect(run(requireAdmin, 'developer')).toBe(403);
});

test('percentile uses nearest-rank', () => {
  const v = Array.from({ length: 100 }, (_, i) => i + 1);
  expect(percentile(v, 50)).toBe(50);
  expect(percentile(v, 95)).toBe(95);
  expect(percentile(v, 99)).toBe(99);
  expect(percentile([], 95)).toBe(0);
});

test('metric rows bucket status codes', () => {
  const row = toRow(
    { method: 'GET', route: '/api/x', count: 4, failed: 2, durSum: 40, durMax: 20, codes: { 200: 2, 404: 1, 500: 1 }, samples: [5, 5, 10, 20] },
    new Date(0)
  );
  expect(row).toMatchObject({ c2xx: 2, c4xx: 1, c5xx: 1, c404: 1, c500: 1, p50: 5, p99: 20 });
});

test('parseRange falls back to 24h on bad input', () => {
  const r = parseRange({ from: 'nope' });
  expect(r.to - r.from).toBe(24 * 3600 * 1000);
  expect(parseRange({ range: '30d' }).bucketMs).toBe(24 * 3600 * 1000);
});

test('route label uses the template, or a bounded prefix when unrouted', () => {
  const { routeOf } = require('../middleware/requestMetrics');
  expect(routeOf({ route: { path: '/:id' }, baseUrl: '/api/orders', originalUrl: '/api/orders/42' })).toBe('/api/orders/:id');
  expect(routeOf({ originalUrl: '/api/developer/overview/x/y?range=1h' })).toBe('/api/developer/overview/*');
});

describe('orderIssues (shared stuck/inconsistency rules)', () => {
  const { orderIssues } = require('../controllers/developer/diagnosticsController');
  const cfg = { autoReleaseDays: 14, abandonedOrderHours: 72 };
  const now = Date.parse('2026-10-23T12:00:00Z');
  const daysAgo = (d) => new Date(now - d * 86400000);
  const codes = (order, docs) => orderIssues(order, docs, now, cfg).map((i) => i.code).sort();

  test('a healthy paid, in-progress order has no issues', () => {
    const order = { status: 'in_progress', paymentStatus: 'paid', createdAt: daysAgo(2), checkoutAmountMinor: 50000 };
    expect(codes(order, { payment: { status: 'completed', refundStatus: 'none', capturedAmountMinor: 50000 }, sph: {} })).toEqual([]);
  });

  test('completed + paid with no payout and unreleased payment is unsettled money', () => {
    const order = { status: 'completed', paymentStatus: 'paid', createdAt: daysAgo(5) };
    expect(codes(order, { payment: { status: 'completed', refundStatus: 'none' }, sph: {} })).toEqual(['unsettled_money']);
    expect(codes(order, { payment: { status: 'completed' }, payout: { status: 'transferred' }, sph: {} })).toEqual([]);
  });

  test('flags missing records, amount and refund mismatches', () => {
    const order = { status: 'paid', paymentStatus: 'paid', createdAt: daysAgo(1), checkoutAmountMinor: 100 };
    expect(codes(order, {})).toEqual(['missing_safepay_history', 'paid_without_payment']);
    expect(codes(order, { payment: { status: 'refunded', refundStatus: 'failed', capturedAmountMinor: 90 }, sph: {} })).toEqual([
      'amount_mismatch',
      'refund_needs_reconciliation',
      'refund_state_mismatch',
    ]);
  });

  test('time-based rules respect the scheduler thresholds', () => {
    expect(codes({ status: 'ready_for_review', paymentStatus: 'paid', readyForReviewAt: daysAgo(15) }, { payment: { status: 'completed' }, sph: {} })).toEqual(['review_overdue']);
    expect(codes({ status: 'ready_for_review', paymentStatus: 'paid', readyForReviewAt: daysAgo(13) }, { payment: { status: 'completed' }, sph: {} })).toEqual([]);
    expect(codes({ status: 'awaiting_payment', paymentStatus: 'unpaid', createdAt: daysAgo(4) })).toEqual(['abandoned_checkout']);
    expect(codes({ status: 'awaiting_payment', paymentStatus: 'unpaid' })).toEqual([]);
    expect(codes({ status: 'paid', paymentStatus: 'paid', providerConnectDeadlineAt: daysAgo(1) }, { payment: { status: 'completed' }, sph: {} })).toEqual(['connect_deadline_passed']);
    expect(codes({ status: 'in_progress', paymentStatus: 'paid', payoutLockId: 'x', payoutLockedAt: daysAgo(1) }, { payment: { status: 'completed' }, sph: {} })).toEqual(['stale_payout_lock']);
  });

  test('disputed order needs an open dispute', () => {
    const order = { status: 'disputed', paymentStatus: 'paid' };
    const docs = { payment: { status: 'disputed' }, sph: {} };
    expect(codes(order, { ...docs, dispute: { status: 'under_review' } })).toEqual([]);
    expect(codes(order, { ...docs, dispute: { status: 'resolved' } })).toEqual(['dispute_state_mismatch']);
  });
});

describe('security event classification', () => {
  const { classify, maskEmail } = require('../services/monitoring/securityEvents');
  test('maps responses to security signals', () => {
    expect(classify({ status: 401, path: '/api/auth/login' })).toBe('login_failed');
    expect(classify({ status: 429, path: '/api/anything' })).toBe('rate_limited');
    expect(classify({ status: 400, path: '/api/auth/verify-otp' })).toBe('otp_failed');
    expect(classify({ status: 401, path: '/api/orders', code: 'TOKEN_EXPIRED' })).toBe('token_expired');
    expect(classify({ status: 401, path: '/api/orders', code: 'SESSION_REVOKED' })).toBe('session_revoked');
    expect(classify({ status: 401, path: '/api/orders', code: 'TOKEN_MISSING' })).toBe('unauthenticated');
    expect(classify({ status: 403, path: '/api/admin/users' })).toBe('permission_denied');
    expect(classify({ status: 400, path: '/api/orders' })).toBeNull();
    expect(classify({ status: 404, path: '/api/x' })).toBeNull();
  });
  test('masks emails', () => {
    expect(maskEmail('Ali.Hassan@Example.com')).toBe('a***@example.com');
    expect(maskEmail('not-an-email')).toBeNull();
    expect(maskEmail(undefined)).toBeNull();
  });
});

test('query shapes keep keys and drop every value', () => {
  const { shape } = require('../services/monitoring/apm');
  const out = shape({ email: 'secret@x.com', age: { $gt: 30 }, tags: [{ name: 'a' }] });
  expect(out).toEqual({ email: '?', age: { $gt: '?' }, tags: [{ name: '?' }] });
  expect(JSON.stringify(out)).not.toMatch(/secret|30/);
});

describe('alert rules', () => {
  const { evaluateRules, DEFAULT_THRESHOLDS: t } = require('../services/monitoring/alerts');
  const calm = { mongoUp: true, api: { count: 1000, c5xx: 1, p95: 120 }, criticalErrors: 0, criticalCodes: [], webhookFailures: 0, schedulerFailures: 0, failedJobs: [], loginFailureIps: [], queueStuck: 0 };
  const keys = (m) => evaluateRules({ ...calm, ...m }, t).map((a) => a.fingerprint).sort();

  test('a healthy system raises nothing', () => expect(keys({})).toEqual([]));
  test('each breached threshold raises its own deduplicable alert', () => {
    expect(keys({ api: { count: 100, c5xx: 10, p95: 3000 } })).toEqual(['api_error_rate', 'api_latency']);
    expect(keys({ api: { count: 5, c5xx: 5, p95: 9000 } })).toEqual([]); // too little traffic to judge
    expect(keys({ criticalErrors: 1, criticalCodes: ['X'] })).toEqual(['critical_errors']);
    expect(keys({ webhookFailures: 3, schedulerFailures: 2, queueStuck: 1 })).toEqual(['queue_stuck', 'scheduler_failures', 'stripe_webhook_failures']);
    expect(keys({ loginFailureIps: [{ ip: '1.2.3.4', n: 25 }, { ip: '5.6.7.8', n: 3 }] })).toEqual(['login_failures:1.2.3.4']);
    expect(keys({ mongoUp: false })).toEqual(['mongo_down']);
  });
});

test('metric rows keep the top client IPs and sum the rest', () => {
  const { toRow } = require('../middleware/requestMetrics');
  const ips = new Map(Array.from({ length: 60 }, (_, i) => [`10.0.0.${i}`, { n: i + 1, failed: i === 59 ? 3 : 0 }]));
  const row = toRow({ method: 'GET', route: '/api/x', count: 1830, failed: 3, durSum: 1, durMax: 1, codes: {}, samples: [1], ips, ipsOther: 7 }, new Date(0));
  expect(row.ips).toHaveLength(50);
  expect(row.ips[0]).toEqual({ ip: '10.0.0.59', n: 60, failed: 3 }); // busiest first
  expect(row.ipsOther).toBe(7 + (1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10)); // overflow + the 10 smallest
});

test('client IPs unwrap IPv4-mapped addresses', () => {
  const { clientIp } = require('../services/monitoring/securityEvents');
  expect(clientIp({ ip: '::ffff:192.168.1.5' })).toBe('192.168.1.5');
  expect(clientIp({ ip: '2001:db8::1' })).toBe('2001:db8::1');
  expect(clientIp({})).toBeNull();
});

describe('IP blocking', () => {
  const { parseTarget, build } = require('../services/monitoring/ipBlocks');
  test('accepts single IPs and narrow ranges, refuses wide or invalid ones', () => {
    expect(parseTarget('203.0.113.7').target).toBe('203.0.113.7');
    expect(parseTarget('::ffff:203.0.113.7').target).toBe('203.0.113.7');
    expect(parseTarget('203.0.113.0/24').target).toBe('203.0.113.0/24');
    expect(parseTarget('10.0.0.0/8').error).toMatch(/prefix/);
    expect(parseTarget('2001:db8::/32').error).toMatch(/prefix/);
    expect(parseTarget('example.com').error).toBeTruthy();
  });
  test('the block list matches addresses and subnets only', () => {
    const list = build([{ target: '203.0.113.0/24' }, { target: '198.51.100.9' }]);
    expect(list.check('203.0.113.200', 'ipv4')).toBe(true);
    expect(list.check('198.51.100.9', 'ipv4')).toBe(true);
    expect(list.check('198.51.100.10', 'ipv4')).toBe(false);
  });
  test('blocked responses are classified as ip_blocked', () => {
    const { classify } = require('../services/monitoring/securityEvents');
    expect(classify({ status: 403, path: '/api/x', code: 'IP_BLOCKED' })).toBe('ip_blocked');
  });
});

test('ip risk verdicts', () => {
  const { ipRisk } = require('../controllers/developer/operationsController');
  expect(ipRisk({ requests: 500, failed: 3, security: {} }).risk).toBe('normal');
  expect(ipRisk({ requests: 10, failed: 0, security: { login_failed: 6 } }).risk).toBe('suspicious');
  expect(ipRisk({ requests: 10, failed: 0, security: { login_failed: 25 } }).risk).toBe('high');
  expect(ipRisk({ requests: 40, failed: 30, security: { rate_limited: 2 } }).risk).toBe('high');
  expect(ipRisk({ requests: 40, failed: 30, security: {} }, true).risk).toBe('blocked');
  expect(ipRisk({ requests: 10, failed: 0, accounts: 8, security: { login_failed: 9 } }).reasons[0]).toBe('9 failed logins on 8 accounts');
});

test('email hashes tell accounts apart even when masks collide', () => {
  const { maskEmail, emailHash } = require('../services/monitoring/securityEvents');
  expect(maskEmail('victim1@example.com')).toBe(maskEmail('victim2@example.com'));
  expect(emailHash('victim1@example.com')).not.toBe(emailHash('victim2@example.com'));
  expect(emailHash('Victim1@Example.com ')).toBe(emailHash('victim1@example.com'));
  expect(emailHash('nope')).toBeNull();
});

describe('access model and step-up', () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  const { hasAccess, requireAccess } = require('../controllers/developer/approvalsController');
  const { requireStepUp } = require('../services/developer/stepUp');
  const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json() { return this; } });
  const run = (mw, req) => {
    const r = res();
    let passed = false;
    mw(req, r, () => { passed = true; });
    return passed ? 'next' : r.statusCode;
  };

  test('readonly < operations < superAdmin; new developers default to readonly', () => {
    expect(hasAccess({ role: 'developer' }, 'operations')).toBe(false);
    expect(hasAccess({ role: 'developer', developerAccess: 'readonly' }, 'operations')).toBe(false);
    expect(hasAccess({ role: 'developer', developerAccess: 'operations' }, 'operations')).toBe(true);
    expect(hasAccess({ role: 'developer', developerAccess: 'operations' }, 'superAdmin')).toBe(false);
    expect(hasAccess({ role: 'superAdmin' }, 'superAdmin')).toBe(true);
    expect(run(requireAccess('operations'), { user: { role: 'developer' } })).toBe(403);
  });

  test('step-up token only works for the same user and session', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ sub: 'u1', sid: 's1', purpose: 'dev-step-up' }, process.env.JWT_SECRET, { expiresIn: 60 });
    const req = (user, sid, t = token) => ({ user: { _id: user }, sessionId: sid, get: () => t });
    expect(run(requireStepUp, req('u1', 's1'))).toBe('next');
    expect(run(requireStepUp, req('u2', 's1'))).toBe(401);
    expect(run(requireStepUp, req('u1', 's2'))).toBe(401);
    expect(run(requireStepUp, req('u1', 's1', null))).toBe(401);
    const other = jwt.sign({ sub: 'u1', sid: 's1', purpose: 'something-else' }, process.env.JWT_SECRET);
    expect(run(requireStepUp, req('u1', 's1', other))).toBe(401);
  });

  test('sensitive actions validate before anything is stored', async () => {
    const { ACTIONS } = require('../services/developer/sensitiveActions');
    await expect(ACTIONS.thresholds_set.prepare({ thresholds: { apiP95Ms: -1 } })).rejects.toThrow(/Invalid/);
    await expect(ACTIONS.thresholds_set.prepare({ thresholds: {} })).rejects.toThrow(/Nothing/);
    expect(await ACTIONS.thresholds_set.prepare({ thresholds: { apiP95Ms: 1500 } })).toEqual({ thresholds: { apiP95Ms: 1500 } });
    await expect(ACTIONS.developer_access.prepare({ userId: 'x', access: 'admin' })).rejects.toThrow(/readonly or operations/);
    // An array key passes a String() regex test and would update every listed key via $in.
    await expect(ACTIONS.flag_set.prepare({ key: ['feature_x', 'stripe_mode'], enabled: true })).rejects.toThrow(/Not a feature flag/);
    await expect(ACTIONS.flag_set.prepare({ key: 'stripe_mode', enabled: true })).rejects.toThrow(/Not a feature flag/);
    expect(ACTIONS.env_set).toBeUndefined(); // env values are .env-only, never set from the dashboard
    // IP blocking is self-service for operations developers; config changes still need approval.
    expect(ACTIONS.ip_block.selfService).toBe(true);
    expect(ACTIONS.ip_unblock.selfService).toBe(true);
    expect(ACTIONS.flag_set.selfService).toBeUndefined();
    expect(ACTIONS.developer_access.selfService).toBeUndefined();
  });
});

test('investigation search recognises what kind of id was pasted', () => {
  const { classifyQuery } = require('../controllers/developer/diagnosticsController');
  expect(classifyQuery('6a982fc4e1b2c3d4e5f60718')).toBe('objectId');
  expect(classifyQuery(' pi_3Abc123 ')).toBe('stripe');
  expect(classifyQuery('cs_test_a1B2')).toBe('stripe');
  expect(classifyQuery('evt_1XyZ')).toBe('stripe');
  expect(classifyQuery('203.0.113.7')).toBe('ip');
  expect(classifyQuery('2001:db8::1')).toBe('ip');
  expect(classifyQuery('Ola@Example.no')).toBe('email');
  expect(classifyQuery('ERR-20261023-AB12')).toBe('reference');
  expect(classifyQuery('pi_')).toBe('reference');
  expect(classifyQuery('')).toBeNull();
});

test('index drift flags missing and non-unique indexes the schema declares', () => {
  const { indexDrift } = require('../controllers/developer/integrityController');
  const declared = [[{ orderId: 1 }, { unique: true }], [{ status: 1, createdAt: -1 }, {}], [{ email: 1 }, { unique: true }]];
  const actual = [{ name: '_id_', key: { _id: 1 } }, { name: 'status_1_createdAt_-1', key: { status: 1, createdAt: -1 } }, { name: 'email_1', key: { email: 1 } }, { name: 'old_1', key: { old: 1 } }];
  const byKey = Object.fromEntries(indexDrift(declared, actual).map((d) => [d.key, d]));
  expect(byKey['orderId:1']).toMatchObject({ problem: 'missing', severity: 'critical' });
  expect(byKey['email:1']).toMatchObject({ problem: 'not_unique', severity: 'critical' });
  expect(byKey['old:1']).toMatchObject({ problem: 'undeclared', severity: 'info' });
  expect(byKey['status:1,createdAt:-1']).toBeUndefined();
});

describe('backup & restore drills', () => {
  const b = require('../services/backup');
  test('drill count comparison tolerates in-flight writes but not lost data', () => {
    const expected = [{ name: 'users', count: 1000 }, { name: 'orders', count: 50000 }, { name: 'payments', count: 10 }];
    expect(b.compareCounts(expected, [{ name: 'users', count: 1003 }, { name: 'orders', count: 49960 }, { name: 'payments', count: 10 }])).toEqual([]);
    expect(b.compareCounts(expected, [{ name: 'users', count: 900 }, { name: 'orders', count: 50000 }])).toEqual([
      { name: 'users', expected: 1000, actual: 900 },
      { name: 'payments', expected: 10, actual: 0 },
    ]);
  });
  test('offsite command is split without a shell and placeholders are filled', () => {
    expect(b.offsiteArgs('rclone copyto {file} b2:jobblo/{name}', '/srv/backups/db-1.archive.gz')).toEqual(['rclone', 'copyto', '/srv/backups/db-1.archive.gz', 'b2:jobblo/db-1.archive.gz']);
  });
  test('credentials never reach error messages', () => {
    expect(b.redact('failed: mongodb+srv://admin:s3cret@cluster0.x.mongodb.net/db')).toBe('failed: mongodb+srv://***@cluster0.x.mongodb.net/db');
  });
  test('stale or missing backups raise alerts only when backups are configured', () => {
    const { evaluateRules, DEFAULT_THRESHOLDS } = require('../services/monitoring/alerts');
    const base = { mongoUp: true, api: { count: 0, c5xx: 0, p95: 0 }, criticalErrors: 0, criticalCodes: [], webhookFailures: 0, schedulerFailures: 0, failedJobs: [], loginFailureIps: [], queueStuck: 0 };
    const keys = (backup) => evaluateRules({ ...base, backup }, DEFAULT_THRESHOLDS).map((a) => a.fingerprint);
    expect(keys(null)).toEqual([]);
    expect(keys({ configured: true, maxAgeHours: 26, ageHours: 3, lastDrillFailed: null })).toEqual([]);
    expect(keys({ configured: true, maxAgeHours: 26, ageHours: 30, lastDrillFailed: null })).toEqual(['backup_stale']);
    expect(keys({ configured: true, maxAgeHours: 26, ageHours: null, lastDrillFailed: 'Checksum mismatch' })).toEqual(['backup_missing', 'restore_drill_failed']);
  });
});

describe('SafePay state machine inspector', () => {
  const { reconstructPath, machineIssues } = require('../controllers/developer/safepayInspectorController');
  const h = (action, data) => ({ action, timestamp: new Date(), data });
  test('rebuilds the path from history actions and from/to records', () => {
    const { steps, recordedStatus } = reconstructPath({
      history: [h('contract_created'), h('payment_confirmed'), h('job_started'), h('evidence_uploaded'), h('ready_for_review'), h('work_approved')],
    });
    expect(steps.map((s) => `${s.from}>${s.to}`)).toEqual(['null>paid', 'paid>in_progress', 'in_progress>ready_for_review', 'ready_for_review>completed']);
    expect(steps.slice(1).every((s) => s.legal)).toBe(true);
    expect(recordedStatus).toBe('completed');
  });
  test('flags illegal and unrecorded transitions', () => {
    const order = { status: 'cancelled', history: [h('payment_confirmed'), h('status_change', { from: 'paid', to: 'completed' })] };
    expect(machineIssues(order).map((i) => i.code)).toEqual(['illegal_transition', 'unrecorded_transition']);
  });
  test('companion records must agree with the order status', () => {
    const order = { status: 'completed', history: [] };
    expect(machineIssues(order, { payment: { status: 'released' }, sph: { status: 'completed' }, payout: { status: 'transferred' } })).toEqual([]);
    expect(machineIssues(order, { payment: { status: 'released' }, sph: { status: 'payment_received' }, payout: { status: 'transferred' } }).map((i) => i.code)).toEqual(['safePay_state_mismatch']);
    expect(machineIssues({ status: 'cancelled', history: [] }, { payment: { status: 'released' } }).map((i) => i.code)).toEqual(['payment_state_mismatch']);
    expect(machineIssues({ status: 'shipped', history: [] }).map((i) => i.code)).toEqual(['unknown_status']);
  });
});

describe('synthetic monitoring', () => {
  const { checkUrlAllowed } = require('../services/monitoring/synthetic');
  const hosts = new Set(['api.jobblo.no', 'jobblo.no']);
  test('custom probes may only target our own hosts', () => {
    expect(checkUrlAllowed('https://api.jobblo.no/api/categories', hosts)).toBeNull();
    expect(checkUrlAllowed('http://169.254.169.254/latest/meta-data', hosts)).toMatch(/not allowed/);
    expect(checkUrlAllowed('https://api.jobblo.no.evil.com/', hosts)).toMatch(/not allowed/);
    expect(checkUrlAllowed('https://user:pw@jobblo.no/', hosts)).toMatch(/credentials/);
    expect(checkUrlAllowed('gopher://jobblo.no/', hosts)).toMatch(/http/);
    expect(checkUrlAllowed('not a url', hosts)).toMatch(/valid/);
  });
  test('a probe pages only after two consecutive failures', () => {
    const { evaluateRules, DEFAULT_THRESHOLDS } = require('../services/monitoring/alerts');
    const base = { mongoUp: true, api: { count: 0, c5xx: 0, p95: 0 }, criticalErrors: 0, criticalCodes: [], webhookFailures: 0, schedulerFailures: 0, failedJobs: [], loginFailureIps: [], queueStuck: 0, backup: null };
    expect(evaluateRules({ ...base, syntheticDown: [] }, DEFAULT_THRESHOLDS)).toEqual([]);
    expect(evaluateRules({ ...base, syntheticDown: [{ key: 'login', name: 'Login journey', n: 2, error: 'Expected 200, got 500' }] }, DEFAULT_THRESHOLDS).map((a) => a.fingerprint)).toEqual(['synthetic:login']);
  });
});

describe('mobile telemetry intake', () => {
  const { normalize, fingerprint, MAX_BATCH } = require('../services/monitoring/mobileTelemetry');
  const ctx = { installId: 'inst_12345678', sessionId: 'sess_12345678', platform: 'ios', appVersion: '1.4.0', build: '42', device: 'iPhone 15' };
  const now = Date.parse('2026-10-24T12:00:00Z');
  test('rejects batches without ids and drops unknown fields and types', () => {
    expect(normalize({ events: [] }).error).toMatch(/installId/);
    expect(normalize({ ...ctx, installId: 'x' }).error).toMatch(/installId/);
    const { docs } = normalize({ ...ctx, platform: 'symbian', events: [{ type: 'error', message: 'boom', $where: '1', userId: 'evil' }, { type: 'nope' }, { type: 'api' }] }, null, now);
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ type: 'error', platform: null, message: 'boom', fatal: false, kind: 'js', userId: null });
    expect(docs[0].$where).toBeUndefined();
  });
  test('caps batch size, string lengths and timestamps', () => {
    const many = Array.from({ length: MAX_BATCH + 10 }, () => ({ type: 'session', at: '2030-01-01T00:00:00Z' }));
    const { docs } = normalize({ ...ctx, events: many }, null, now);
    expect(docs).toHaveLength(MAX_BATCH);
    expect(docs[0].at.getTime()).toBe(now); // future timestamp replaced
    const long = normalize({ ...ctx, events: [{ type: 'error', message: 'x'.repeat(10_000), stack: 'y'.repeat(10_000) }] }, null, now).docs[0];
    expect(long.message).toHaveLength(500);
    expect(long.stack).toHaveLength(4000);
  });
  test('the same bug groups across builds and ids', () => {
    const a = fingerprint('TypeError', "Cannot read property 'x' of undefined (order 6ad90a9e94221dfd9681ff17)", 'at renderJob (index.bundle:12:345)\nat x');
    const b = fingerprint('TypeError', "Cannot read property 'x' of undefined (order 6ace7d7225def6e39b271b33)", 'at renderJob (index.bundle:99:1)\nat y');
    const c = fingerprint('TypeError', "Cannot read property 'x' of undefined (order 6ace7d7225def6e39b271b33)", 'at renderProfile (index.bundle:1:1)');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

test('dependency verdicts combine live checks and error rates', () => {
  const { verdict } = require('../controllers/developer/dependencyController');
  expect(verdict({ configured: false, live: { ok: false } })).toBe('off');
  expect(verdict({ live: { ok: false } })).toBe('down');
  expect(verdict({ live: { ok: true } })).toBe('healthy');
  expect(verdict({ live: { ok: true }, errorRate: 0.1 })).toBe('degraded');
  expect(verdict({ live: { ok: true }, failures: 2 })).toBe('degraded');
  expect(verdict({ errorRate: 0 })).toBe('healthy');
  expect(verdict({})).toBe('unknown');
});

describe('SLO error budgets', () => {
  const { evaluate } = require('../services/monitoring/slo');
  const none = { good: 0, bad: 0 };
  test('budget, remaining and status', () => {
    // 99.5 % of 10 000 → 50 bad allowed; 10 spent → 80 % left.
    const r = evaluate(99.5, { good: 9990, bad: 10 }, none, none);
    expect(r.sli).toBeCloseTo(99.9);
    expect(r.budget).toBeCloseTo(50);
    expect(r.remaining).toBeCloseTo(80);
    expect(r.status).toBe('ok');
    expect(evaluate(99.5, { good: 9960, bad: 40 }, none, none).status).toBe('at_risk'); // 20 % left
    expect(evaluate(99.5, { good: 9900, bad: 100 }, none, none).status).toBe('breached');
    expect(evaluate(99.5, none, none, none).status).toBe('no_data');
  });
  test('burn rate is bad share over the allowed share', () => {
    const r = evaluate(99.9, { good: 100000, bad: 10 }, { good: 985, bad: 15 }, { good: 5990, bad: 10 });
    expect(r.burn1h).toBeCloseTo(15); // 1.5 % bad vs 0.1 % allowed
    expect(r.status).toBe('fast_burn');
    expect(evaluate(99.9, { good: 100000, bad: 10 }, { good: 1000, bad: 0 }, { good: 9930, bad: 70 }).status).toBe('at_risk'); // slow burn 7×
  });
});

describe('deployment impact verdicts', () => {
  const { judge, windows } = require('../services/monitoring/deployments');
  const w = (requests, c5xx, p95, slowShare = null) => ({ requests, c5xx, p95, slowShare });
  test('needs traffic on both sides', () => expect(judge(w(10, 0, 100), w(500, 0, 100)).verdict).toBe('insufficient'));
  test('error-rate and latency regressions', () => {
    expect(judge(w(1000, 1, 200), w(1000, 30, 200)).verdict).toBe('regression');
    expect(judge(w(1000, 1, 200), w(1000, 3, 200)).verdict).toBe('healthy'); // fewer than 5 errors after
    expect(judge(w(1000, 0, 300), w(1000, 0, 900)).reasons[0]).toMatch(/p95 latency 300 ms → 900 ms/);
    expect(judge(w(1000, 0, 300), w(1000, 0, 400)).verdict).toBe('healthy'); // +100 ms is not a regression
  });
  test('new error types and slow requests warn; drops count as improved', () => {
    expect(judge(w(1000, 0, 200), w(1000, 0, 200), { newErrors: 2 }).verdict).toBe('warning');
    expect(judge(w(1000, 0, 200, 0.01), w(1000, 0, 200, 0.05)).verdict).toBe('warning');
    expect(judge(w(1000, 40, 200), w(1000, 5, 200)).verdict).toBe('improved');
  });
  test('windows stop at the next release', () => {
    const at = new Date('2026-10-24T10:00:00Z');
    expect(windows(at, new Date('2026-10-24T12:00:00Z'), 6).span).toBe(2 * 3600e3);
  });
});

describe('cost center', () => {
  const { validateConfig, project, monthRange } = require('../services/monitoring/costs');
  test('config validation', () => {
    expect(validateConfig({}).error).toMatch(/Nothing/);
    expect(validateConfig({ monthlyBudgetNok: -1 }).error).toMatch(/Budget/);
    expect(validateConfig({ fixed: [{ name: '', monthlyNok: 10 }] }).error).toMatch(/name/);
    expect(validateConfig({ fixed: [{ name: 'VPS', monthlyNok: 'x' }] }).error).toMatch(/VPS/);
    expect(validateConfig({ prices: { usdToNok: -2 } }).error).toMatch(/usdToNok/);
    const ok = validateConfig({ monthlyBudgetNok: '2500', fixed: [{ name: ' Hetzner VPS ', category: 'Hosting', monthlyNok: 349.555 }], prices: { bankIdPerAuthNok: 1.2, evil: 5 } });
    expect(ok.value).toEqual({ monthlyBudgetNok: 2500, fixed: [{ name: 'Hetzner VPS', category: 'Hosting', monthlyNok: 349.56 }], prices: { bankIdPerAuthNok: 1.2 } });
  });
  test('month-end projection scales metered cost by elapsed time', () => {
    const [from, to] = monthRange('2026-10');
    expect(to.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    const tenDays = from.getTime() + 10 * 86400e3;
    expect(project(100, from, to, tenDays)).toBeCloseTo(310);
    expect(project(100, from, to, to.getTime() + 1)).toBe(100); // past month: actuals
  });
});

describe('capacity forecasting', () => {
  const { linearFit, forecast } = require('../services/monitoring/capacity');
  const DAY = 86400e3;
  const t0 = Date.parse('2026-10-01T00:00:00Z');
  const line = (days, start, perDay) => Array.from({ length: days }, (_, i) => ({ x: t0 + i * DAY, y: start + i * perDay }));
  test('fits a perfect line', () => {
    const f = linearFit(line(10, 100, 5));
    expect(f.slope * DAY).toBeCloseTo(5);
    expect(f.r2).toBeCloseTo(1);
    expect(linearFit([{ x: 1, y: 1 }])).toBeNull();
  });
  test('days until a limit, and no ETA when shrinking or limitless', () => {
    const now = t0 + 9 * DAY; // last point: 100 + 9*10 = 190
    const f = forecast(line(10, 100, 10), 500, now);
    expect(f.perDay).toBeCloseTo(10);
    expect(f.daysToLimit).toBeCloseTo(31); // (500 - 190) / 10
    expect(f.in30).toBeCloseTo(490);
    expect(f.confidence).toBe('high');
    expect(forecast(line(10, 500, -5), 1000, now).daysToLimit).toBeNull();
    expect(forecast(line(10, 100, 10), null, now).daysToLimit).toBeNull();
    expect(forecast(line(2, 100, 10), 500, now).confidence).toBe('insufficient');
  });
});

describe('configuration drift', () => {
  const { diffStates, policyChecks, fp, handledStripeEvents } = require('../services/monitoring/configDrift');
  const base = { nodeVersion: 'v20.1.0', version: '1.0.0', commit: 'aaa', env: [['A', fp('1')], ['B', ''], ['C', fp('x')]], packages: [['express', '5.0.0']], globalConfig: [['flags', fp('{}')]] };
  test('reports what changed without exposing values', () => {
    const next = { ...base, nodeVersion: 'v22.0.0', env: [['A', fp('2')], ['B', fp('now set')], ['D', '']], packages: [['express', '5.1.0'], ['zod', '3.0.0']], globalConfig: [] };
    const changes = diffStates(base, next).map((c) => `${c.area}:${c.key}:${c.change}`);
    expect(changes).toEqual(expect.arrayContaining(['runtime:Node.js:changed', 'env:A:changed', 'env:B:set', 'env:D:declared', 'env:C:removed', 'packages:express:changed', 'packages:zod:added', 'globalConfig:flags:removed']));
    expect(JSON.stringify(diffStates(base, next))).not.toMatch(/now set/);
    expect(diffStates(base, base)).toEqual([]);
  });
  test('policy rules: production-only rules are n/a outside production', () => {
    const dev = policyChecks({ NODE_ENV: 'development', JWT_SECRET: 'x'.repeat(40), JWT_REFRESH_SECRET: 'y'.repeat(40), SESSION_SECRET: 'z'.repeat(40) });
    expect(dev.find((r) => r.key === 'host_bind').ok).toBeNull();
    expect(dev.find((r) => r.key === 'jwt_secret').ok).toBe(true);
    const prod = policyChecks({ NODE_ENV: 'production', JWT_SECRET: 'same', JWT_REFRESH_SECRET: 'same', ALLOWED_ORIGINS: '*', HOST: '0.0.0.0', ENABLE_SCHEDULER: 'false', MONGO_URI: 'mongodb://localhost/db' });
    const failing = prod.filter((r) => r.ok === false).map((r) => r.key);
    expect(failing).toEqual(expect.arrayContaining(['jwt_secret', 'cors', 'host_bind', 'scheduler', 'mongo_auth', 'backups']));
    expect(policyChecks({ NODE_ENV: 'production', MONGO_URI: 'mongodb+srv://u:p@cluster/db' }).find((r) => r.key === 'mongo_auth').ok).toBe(true);
  });
  test('handled Stripe events are read from the dispatcher source', () => {
    expect(handledStripeEvents()).toEqual(expect.arrayContaining(['checkout.session.completed', 'charge.refunded', 'transfer.reversed']));
  });
});

describe('staging failure simulator', () => {
  const { availability, matches, validate } = require('../services/monitoring/faults');
  test('never available in production or without the flag', () => {
    expect(availability({ NODE_ENV: 'production', ENABLE_FAILURE_SIMULATOR: 'true' }).enabled).toBe(false);
    expect(availability({ NODE_ENV: 'development' }).enabled).toBe(false);
    expect(availability({ NODE_ENV: 'staging', ENABLE_FAILURE_SIMULATOR: 'true' }).enabled).toBe(true);
  });
  test('route faults never hit the developer API, telemetry or other prefixes; expire on time', () => {
    const now = Date.now();
    const exp = { type: 'http_error', target: '/api/orders', endsAt: new Date(now + 60e3), stoppedAt: null };
    expect(matches(exp, { type: 'http_error', path: '/api/orders/123' }, now)).toBe(true);
    expect(matches(exp, { type: 'http_error', path: '/api/services' }, now)).toBe(false);
    expect(matches({ ...exp, target: '/api/' }, { type: 'http_error', path: '/api/developer/failures' }, now)).toBe(false);
    expect(matches({ ...exp, target: '/api/' }, { type: 'http_error', path: '/api/mobile/telemetry' }, now)).toBe(false);
    expect(matches(exp, { type: 'http_error', path: '/api/orders' }, now + 61e3)).toBe(false);
    expect(matches({ ...exp, stoppedAt: new Date() }, { type: 'http_error', path: '/api/orders' }, now)).toBe(false);
    expect(matches({ type: 'scheduler', target: 'reconcileMoneyState', endsAt: new Date(now + 60e3) }, { type: 'scheduler', target: 'retryFailedPayouts' }, now)).toBe(false);
  });
  test('experiment validation', () => {
    expect(validate({ type: 'nuke' }).error).toMatch(/Unknown/);
    expect(validate({ type: 'email', durationMinutes: 120, reason: 'test it' }).error).toMatch(/Duration/);
    expect(validate({ type: 'email', durationMinutes: 5, reason: 'x' }).error).toMatch(/reason/);
    expect(validate({ type: 'http_error', target: '/api/developer', durationMinutes: 5, reason: 'try it', errorRate: 50 }).error).toMatch(/developer/);
    expect(validate({ type: 'http_latency', target: '/api/orders', durationMinutes: 5, reason: 'slow it', latencyMs: 10 }).error).toMatch(/Latency/);
    expect(validate({ type: 'http_error', target: '/api/orders', durationMinutes: 5, reason: 'break it', errorRate: 25, statusCode: 502 }).value).toMatchObject({ target: '/api/orders', errorRate: 25, statusCode: 502, minutes: 5 });
  });
});

describe('fraud & abuse rules', () => {
  const { isPublicIp, fingerprints, overlap, score, OFF_PLATFORM } = require('../services/monitoring/fraud');
  test('private, loopback and link-local addresses are never correlated', () => {
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.79.147', '169.254.1.1', '100.64.0.1', 'fd00::1', 'fe80::1', 'garbage', null]) expect(isPublicIp(ip)).toBe(false);
    for (const ip of ['84.211.10.5', '::ffff:84.211.10.5', '2a02:fe0::1', '172.32.0.1']) expect(isPublicIp(ip)).toBe(true);
  });
  test('shared public IP or specific device links two accounts; generic devices do not', () => {
    const fp = fingerprints([
      { userId: 'a', ip: '84.211.10.5', deviceName: 'iPhone 15 Pro', os: 'iOS' },
      { userId: 'b', ip: '84.211.10.5', deviceName: 'Pixel 8', os: 'Android' },
      { userId: 'c', ip: '192.168.0.2', deviceName: 'iPhone 15 Pro', os: 'iOS' },
      { userId: 'd', ip: '192.168.0.2', deviceName: 'Desktop', os: 'Windows' },
      { userId: 'e', ip: '10.0.0.1', deviceName: 'Desktop', os: 'Windows' },
    ]);
    expect(overlap(fp.get('a'), fp.get('b')).ips).toEqual(['84.211.10.5']);
    expect(overlap(fp.get('a'), fp.get('c')).devices).toEqual(['iphone 15 pro']);
    expect(overlap(fp.get('d'), fp.get('e'))).toBeNull(); // same generic device, private IPs
  });
  test('score: strongest hit per rule, capped at 100', () => {
    expect(score([{ rule: 'self_dealing', weight: 40, evidence: 'x' }, { rule: 'self_dealing', weight: 40, evidence: 'y' }, { rule: 'shared_ip', weight: 25, evidence: 'z' }])).toEqual({ score: 65, level: 'high' });
    expect(score([{ rule: 'disputes', weight: 20, evidence: 'a' }, { rule: 'off_platform', weight: 15, evidence: 'b' }]).level).toBe('medium');
    expect(score(Array.from({ length: 6 }, (_, i) => ({ rule: `r${i}`, weight: 30, evidence: '' }))).score).toBe(100);
  });
  test('off-platform pattern catches contact/payment details, not normal chat', () => {
    const re = new RegExp(OFF_PLATFORM, 'i');
    for (const t of ['Ring meg på 912 34 567', 'send til ola@gmail.com', 'Betal direkte med Vipps', 'kan vi ta det utenfor appen?', 'kontonr 1234.56.78901', 'pay me directly']) expect(re.test(t)).toBe(true);
    for (const t of ['Hei! Når passer det?', 'Jobben tar ca 3 timer', 'Pris 1500 kr inkl. materialer', 'Adressen er Storgata 12']) expect(re.test(t)).toBe(false);
  });
});

describe('API contract monitoring', () => {
  const { shapeOf, toPairs, classify, fromSwagger } = require('../services/monitoring/contracts');
  const v = (body, count) => ({ count, fields: toPairs(shapeOf(body)) });
  const ok = { success: true, data: { user: { _id: '6ad90a9e94221dfd9681ff17', name: 'Ola', age: 30, tags: ['a'] }, items: [{ id: 1, price: 10 }] } };
  test('shape records names and types only, collapsing data-like keys', () => {
    const s = shapeOf({ ...ok, byDay: { '2026-10-01': 3, '2026-10-02': 4 }, secret: 'hunter2' });
    expect(s.get('data.user.name')).toBe('string');
    expect(s.get('data.items[].price')).toBe('number');
    expect(s.get('byDay.*')).toBe('number');
    expect(s.has('byDay.2026-10-01')).toBe(false);
    expect(JSON.stringify([...s])).not.toMatch(/hunter2|Ola/);
  });
  test('removed required field and changed type are breaking; new field is additive', () => {
    const prior = [v(ok, 40)];
    const removed = classify(prior, toPairs(shapeOf({ success: true, data: { user: { _id: 'x', age: 30, tags: [] }, items: [{ id: 1, price: 10 }] } })));
    expect(removed.map((c) => `${c.kind}:${c.path}`)).toEqual(['removed:data.user.name']); // empty tags[] is not a removal
    const retyped = classify(prior, toPairs(shapeOf({ ...ok, data: { ...ok.data, items: [{ id: '1', price: 10 }] } })));
    expect(retyped).toEqual([expect.objectContaining({ kind: 'type_changed', path: 'data.items[].id', breaking: true })]);
    const added = classify(prior, toPairs(shapeOf({ ...ok, data: { ...ok.data, total: 1 } })));
    expect(added).toEqual([expect.objectContaining({ kind: 'added', path: 'data.total', breaking: false })]);
  });
  test('optional fields, null parents and thin history stay quiet', () => {
    const prior = [v(ok, 30), v({ ...ok, data: { ...ok.data, coupon: { code: 'X' } } }, 5)];
    expect(classify(prior, toPairs(shapeOf(ok)))).toEqual([]); // coupon is optional (14 %)
    expect(classify(prior, toPairs(shapeOf({ ...ok, data: { ...ok.data, user: null } }))).filter((c) => c.kind === 'removed')).toEqual([]);
    expect(classify([v(ok, 5)], toPairs(shapeOf({ success: true })))).toEqual([]); // < 20 samples
  });
  test('swagger paths normalise to express templates', () => expect(fromSwagger('/api/services/{id}/location')).toBe('/api/services/:id/location'));
});

test('contract shapes keep field names when only one key looks like data', () => {
  const { shapeOf, fromSwagger } = require('../services/monitoring/contracts');
  const s = shapeOf({ _id: 'x', name: 'a', '2fa': true });
  expect(s.get('name')).toBe('string');
  expect(s.get('*')).toBe('boolean');
  expect(fromSwagger('/')).toBe('/');
  expect(fromSwagger('/api/favorites/{serviceId}')).toBe('/api/favorites/:serviceId');
});

describe('Stripe Connect health', () => {
  const { problems } = require('../services/monitoring/connectHealth');
  const { readinessFromAccount } = require('../services/stripeConnectReadiness');
  const acct = (over = {}) => ({ payouts_enabled: true, details_submitted: true, charges_enabled: true, capabilities: { transfers: 'active' }, requirements: { currently_due: [], past_due: [], pending_verification: [], eventually_due: [], errors: [] }, ...over });
  test('readiness is the same strict rule the payout gate uses', () => {
    expect(readinessFromAccount(acct()).ready).toBe(true);
    expect(readinessFromAccount(acct({ capabilities: { transfers: 'inactive' } })).ready).toBe(false);
    expect(readinessFromAccount(acct({ requirements: { past_due: ['external_account'], currently_due: ['external_account'] } })).payoutOnboardingStatus).toBe('started');
    expect(readinessFromAccount(acct({ requirements: { disabled_reason: 'requirements.past_due' } })).payoutOnboardingStatus).toBe('restricted');
  });
  test('flags missing accounts, restrictions and stale database flags', () => {
    const codes = (db, a, id = 'acct_1') => problems({ db, stripe: a && readinessFromAccount(a), accountId: id }).map((p) => p.code);
    expect(codes({}, null, null)).toEqual([]);
    expect(codes({}, null)).toEqual(['account_missing_in_stripe']);
    expect(codes({ payoutEnabled: true }, acct())).toEqual([]);
    expect(codes({ payoutEnabled: true }, acct({ requirements: { disabled_reason: 'rejected.fraud', past_due: ['x'] } }))).toEqual(expect.arrayContaining(['disabled', 'past_due', 'db_says_ready']));
    expect(codes({ payoutEnabled: false }, acct())).toEqual(['db_says_not_ready']);
    const soon = Math.floor((Date.now() + 3 * 86400e3) / 1000);
    expect(problems({ db: {}, stripe: readinessFromAccount(acct({ payouts_enabled: false, requirements: { currently_due: ['individual.id_number'], current_deadline: soon } })), accountId: 'a' }).find((p) => p.code === 'deadline').severity).toBe('high');
  });
});

describe('financial ledger', () => {
  const { buildLedger } = require('../services/monitoring/ledger');
  const order = (o = {}) => ({ _id: 'o1', status: 'completed', paymentStatus: 'paid', agreedPrice: 1500, checkoutAmountMinor: 154500, ...o });
  const payment = { capturedAmountMinor: 154500, refundedAmountMinor: 0, amount: 1500 };
  const payout = { status: 'transferred', grossAmount: 1500, platformFee: 45, taxAmount: 0, netProviderAmount: 1455 };
  test('a completed, paid-out order balances: both fees kept, nothing held', () => {
    const l = buildLedger({ order: order(), payment, payout, transfers: [{ amount: 145500, amountReversed: 0 }] });
    expect(l).toMatchObject({ charged: 154500, paidOut: 145500, customerFee: 4500, providerFee: 4500, kept: 9000, held: 0, issues: [] });
  });
  test('fully refunded cancelled order keeps nothing and holds nothing', () => {
    const l = buildLedger({ order: order({ status: 'cancelled', paymentStatus: 'refunded' }), payment: { ...payment, refundedAmountMinor: 154500 }, refundOps: [{ type: 'refund', status: 'succeeded', amount: 154500 }] });
    expect(l).toMatchObject({ refunded: 154500, kept: 0, held: 0, issues: [] });
  });
  test('money stuck on a closed order, overpaying and mismatched records are flagged', () => {
    expect(buildLedger({ order: order({ agreedPrice: 36, checkoutAmountMinor: 3700 }), payment: { capturedAmountMinor: 3700 } }).issues.map((i) => i.code)).toEqual(['held_on_closed_order']);
    const over = buildLedger({ order: order({ status: 'cancelled' }), payment: { ...payment, refundedAmountMinor: 154500 }, payout, transfers: [{ amount: 145500 }], refundOps: [{ type: 'refund', status: 'succeeded', amount: 154500 }] });
    expect(over.issues.map((i) => i.code)).toContain('overdisbursed');
    const wrong = buildLedger({ order: order(), payment, payout, transfers: [{ amount: 140000 }], refundOps: [{ type: 'refund', status: 'succeeded', amount: 100 }] });
    expect(wrong.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['transfer_amount_mismatch', 'refund_records_disagree']));
    expect(buildLedger({ order: order(), payment, payout: { ...payout, netProviderAmount: 1400 } }).issues.map((i) => i.code)).toContain('payout_arithmetic');
  });
});

test('ledger: an open order holds the whole charge in escrow (fees not yet earned)', () => {
  const { buildLedger } = require('../services/monitoring/ledger');
  const l = buildLedger({ order: { _id: 'o', status: 'paid', paymentStatus: 'paid', agreedPrice: 780, checkoutAmountMinor: 80300 }, payment: { capturedAmountMinor: 80300 } });
  expect(l).toMatchObject({ kept: 0, held: 80300, issues: [] });
});

describe('business transaction tracing', () => {
  const { stagesOf, position } = require('../services/monitoring/transactions');
  const t = (h) => new Date(Date.parse('2026-10-01T00:00:00Z') + h * 3600e3);
  const now = Date.parse('2026-10-20T00:00:00Z');
  const full = { service: { createdAt: t(0) }, firstBidAt: t(1), order: { status: 'completed', createdAt: t(2), paymentConfirmedAt: t(3), startedAt: t(4), readyForReviewAt: t(5), completedAt: t(6) }, payout: { status: 'transferred', transferCompletedAt: t(7) }, review: { createdAt: t(6) } };
  test('a finished job is complete and not stuck', () => {
    expect(position(stagesOf(full), { order: full.order, now })).toMatchObject({ current: 'reviewed', skipped: [], stuck: false });
  });
  test('a review cannot hide a payout that never happened', () => {
    const noPayout = { ...full, payout: null };
    expect(position(stagesOf(noPayout), { order: noPayout.order, now })).toMatchObject({ current: 'completed', skipped: ['paid_out'], stuck: true });
  });
  test('a job without bids waits at "posted"; a refunded cancellation is a finished branch', () => {
    expect(position(stagesOf({ service: { createdAt: t(0) } }), { now })).toMatchObject({ current: 'posted', stuck: true });
    const refunded = { status: 'cancelled', paymentStatus: 'refunded', createdAt: t(2), paymentConfirmedAt: t(3) };
    expect(position(stagesOf({ service: { createdAt: t(0) }, order: refunded }), { order: refunded, now })).toMatchObject({ branch: 'refunded', stuck: false });
  });
});

describe('real-user monitoring intake', () => {
  const { normalize, templatePage, rate } = require('../services/monitoring/rum');
  test('pages are templated; internal pages and junk are dropped', () => {
    expect(templatePage('/jobs/6ad90a9e94221dfd9681ff17?ref=mail')).toBe('/jobs/:id');
    expect(templatePage('/profile/42/reviews')).toBe('/profile/:id/reviews');
    const { docs } = normalize({ sessionId: 'abcdefgh12', device: 'phone', events: [
      { type: 'view', page: '/', loadMs: 1234 },
      { type: 'view', page: '/developer/slo' },
      { type: 'view', page: '/dashboard/users' },
      { type: 'vital', page: '/', metric: 'LCP', value: 3100 },
      { type: 'vital', page: '/', metric: 'FID', value: 10 },
      { type: 'vital', page: '/', metric: 'CLS', value: -1 },
      { type: 'error', page: '/home', message: 'x is not a function', source: 'https://jobblo.no/assets/index-abc.js?v=1:10:22' },
      { type: 'hack', page: '/' },
    ] });
    expect(docs.map((d) => d.type)).toEqual(['view', 'vital', 'error']);
    expect(docs[0]).toMatchObject({ device: 'desktop', loadMs: 1234 });
    expect(docs[1]).toMatchObject({ metric: 'LCP', rating: 'needs-improvement' });
    expect(docs[2].fingerprint).toHaveLength(16);
    expect(normalize({ events: [] }).error).toMatch(/sessionId/);
  });
  test('Google thresholds', () => {
    expect(rate('LCP', 2500)).toBe('good');
    expect(rate('INP', 350)).toBe('needs-improvement');
    expect(rate('CLS', 0.3)).toBe('poor');
  });
});

describe('user impact: collectRefs', () => {
  const { collectRefs } = require('../services/monitoring/impact');
  const u = '6a0ca362b21f79777e464466';
  const o1 = '6ace836adf7a80f34810998c';
  const o2 = '6a982fc4c9f28a8d07c772c4';
  it('collects users, orders and Stripe ids, and counts rows it cannot attribute', () => {
    const r = collectRefs([
      { userId: u, metadata: { orderId: o1 } },
      { userId: null, metadata: { userId: u, orders: [{ orderId: o2 }, { orderId: 'junk' }] } },
      { metadata: { objectId: 'pi_3Abc', eventType: 'x' } },
      { metadata: { correlationId: 'REQ-1', userId: null } },
      { metadata: null },
    ]);
    expect(r.users).toEqual([u]);
    expect(r.orders.sort()).toEqual([o1, o2].sort());
    expect(r.stripe).toEqual(['pi_3Abc']);
    expect(r.unattributed).toBe(2);
  });
  it('rejects ids that are not ObjectIds or known Stripe prefixes', () => {
    const r = collectRefs([{ userId: 'admin', metadata: { orderId: 123, objectId: 'evt_1' } }]);
    expect(r).toEqual({ users: [], orders: [], stripe: [], unattributed: 1 });
  });
});

describe('marketplace health: segment + verdict', () => {
  const { segment, verdict } = require('../services/monitoring/marketplace');
  const now = Date.parse('2026-10-10T12:00:00Z');
  const t = (h) => new Date(now - h * 3_600_000);
  it('computes applicant rate, hires, first-application time and unanswered jobs per segment', () => {
    const jobs = [
      { _id: 'a', categories: ['Hage'], price: 100, status: 'completed', createdAt: t(100) },
      { _id: 'b', categories: ['Hage', 'Flytting'], price: 300, status: 'open', createdAt: t(72) },
      { _id: 'c', categories: ['Hage'], price: 200, status: 'open', createdAt: t(10) },
    ];
    const apps = [
      { serviceId: 'a', providerId: 'p1', createdAt: t(98) },
      { serviceId: 'a', providerId: 'p2', createdAt: t(90) },
    ];
    const orders = [{ serviceId: 'a', status: 'completed' }, { serviceId: 'b', status: 'cancelled' }];
    const [hage, flytting] = segment(jobs, apps, orders, (j) => j.categories, now);
    expect(hage).toMatchObject({ key: 'Hage', posted: 3, applications: 2, providers: 2, hires: 1, unanswered: 1, applicantRate: 33.3, medianFirstAppHours: 2, medianPrice: 200, verdict: 'undersupplied' });
    // b is >48 h old, open, no applicants; its cancelled order is not a hire.
    expect(flytting).toMatchObject({ posted: 1, hires: 0, unanswered: 1, verdict: 'thin' });
  });
  it('labels segments', () => {
    const base = { posted: 10, unanswered: 0, applicantRate: 90, appsPerJob: 3, hireRate: 40 };
    expect(verdict(base)).toBe('healthy');
    expect(verdict({ ...base, appsPerJob: 12, hireRate: 10 })).toBe('oversupplied');
    expect(verdict({ ...base, hireRate: 10 })).toBe('low_conversion');
    expect(verdict({ ...base, unanswered: 4 })).toBe('undersupplied');
  });
});

describe('event consistency', () => {
  const { outOfOrder, orderSequence, bursts } = require('../services/monitoring/eventConsistency');
  const at = (m) => new Date(Date.parse('2026-10-01T00:00:00Z') + m * 60_000);
  it('flags lifecycle events that arrive after a later stage of the same object', () => {
    const issues = outOfOrder([
      { type: 'customer.subscription.deleted', at: at(5) },
      { type: 'customer.subscription.created', at: at(1) },
      { type: 'customer.subscription.updated', at: at(7) },
      { type: 'invoice.paid', at: at(8) }, // other family: never compared
    ]);
    expect(issues).toEqual([{ late: 'customer.subscription.updated', after: 'customer.subscription.deleted', lateAt: at(7), afterAt: at(5) }]);
    expect(outOfOrder([{ type: 'refund.created', at: at(1) }, { type: 'refund.updated', at: at(2) }])).toEqual([]);
  });
  it('finds out-of-order and missing job steps', () => {
    expect(orderSequence({ status: 'completed', paymentStatus: 'paid', createdAt: at(0), paymentConfirmedAt: at(10), completedAt: at(20) })).toEqual([]);
    const bad = orderSequence({ status: 'completed', paymentStatus: 'paid', createdAt: at(0), paymentConfirmedAt: at(30), completedAt: at(20) });
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatchObject({ kind: 'out_of_order' });
    expect(bad[0].detail).toMatch(/^completed .* before paid/);
    expect(orderSequence({ status: 'completed', paymentStatus: 'refunded', createdAt: at(0) }).map((i) => i.kind)).toEqual(['missing', 'missing']);
  });
  it('groups repeats inside the window only', () => {
    const rows = [
      { _id: 1, k: 'a', at: at(0) },
      { _id: 2, k: 'a', at: at(1) },
      { _id: 3, k: 'a', at: at(10) },
      { _id: 4, k: 'b', at: at(0) },
    ];
    expect(bursts(rows, (r) => r.k, 2 * 60_000)).toEqual([{ key: 'a', n: 2, first: at(0), last: at(1), ids: ['1', '2'] }]);
  });
});

describe('migration center: schemaRules', () => {
  const mongoose = require('mongoose');
  const { schemaRules } = require('../services/monitoring/migrations');
  it('lists enum and hard-required paths, skipping defaults, validators and internals', () => {
    const s = new mongoose.Schema({
      kind: { type: String, enum: ['a', 'b'], required: true },
      owner: { type: mongoose.Schema.Types.ObjectId, required: true },
      status: { type: String, enum: ['x'], default: 'x' },
      soft: { type: String, required: () => false },
      withDefault: { type: Number, required: true, default: 0 },
      nested: { mode: { type: String, enum: ['m'] } },
      tags: [{ type: String, enum: ['t'] }],
    });
    expect(schemaRules(s)).toEqual([
      { path: 'kind', rule: 'enum', values: ['a', 'b'] },
      { path: 'kind', rule: 'required' },
      { path: 'owner', rule: 'required' },
      { path: 'status', rule: 'enum', values: ['x'] },
      { path: 'nested.mode', rule: 'enum', values: ['m'] },
    ]);
  });
});

describe('external services', () => {
  const { classify, templateOp, fold } = require('../services/monitoring/externalCalls');
  it('classifies outcomes, including provider throttling hidden in error text', () => {
    expect(classify(200)).toBe('ok');
    expect(classify(429)).toBe('rate_limited');
    expect(classify(null, '454 4.7.0 Too many login attempts')).toBe('rate_limited');
    expect(classify(null, 'messaging/message-rate-exceeded')).toBe('rate_limited');
    expect(classify(503)).toBe('error');
    expect(classify(null, 'timeout')).toBe('error');
    expect(classify(402, 'card_declined')).toBe('client_error');
  });
  it('templates ids out of provider paths', () => {
    expect(templateOp('post', '/v1/payment_intents/pi_3QnZx8Abc12/capture?x=1')).toBe('POST /v1/payment_intents/:id/capture');
    expect(templateOp('GET', '/v1/accounts/acct_1QxYz2AbCdEf/login_links')).toBe('GET /v1/accounts/:id/login_links');
    expect(templateOp('POST', '/v1/setup_intents')).toBe('POST /v1/setup_intents');
  });
  it('folds minute rows and single events into totals, weighted p95 and per-op stats', () => {
    const m = (min, op, count, p95, extra = {}) => ({ minute: new Date(Date.UTC(2026, 9, 1, 0, min)), op, count, durSum: count * 100, durMax: p95, p95, ...extra });
    const f = fold([m(1, 'A', 90, 100), m(2, 'A', 9, 900, { errors: 1, lastError: '503' }), m(70, 'B', 1, 5000, { rateLimited: 1, lastError: '429' })], 3_600_000);
    expect(f).toMatchObject({ calls: 100, errors: 1, rateLimited: 1, errorRate: 2, avgMs: 100, p95: 900, maxMs: 5000, lastError: '429' });
    expect(f.series).toHaveLength(2);
    expect(f.series[0]).toMatchObject({ calls: 99, errors: 1, p95: 900 });
    expect(f.ops[0]).toMatchObject({ op: 'A', calls: 99, failed: 1 });
  });
});

describe('runbooks', () => {
  const { RUNBOOKS, CHECKS, forFingerprint, overall } = require('../services/monitoring/runbooks');
  it('maps alert fingerprints (exact and prefix) to runbooks', () => {
    expect(forFingerprint('synthetic:web')).toEqual(['synthetic']);
    expect(forFingerprint('login_failures:1.2.3.4')).toEqual(['brute_force']);
    expect(forFingerprint('critical_errors')).toEqual(['api_errors', 'money']);
    expect(forFingerprint('api_error_rate_extra')).toEqual([]);
    expect(forFingerprint(null)).toEqual([]);
  });
  it('every runbook references real checks and gated recovery steps only', () => {
    const approvals = ['none', 'operations', 'step-up', 'change-request', 'human'];
    for (const r of RUNBOOKS) {
      for (const c of r.checks) expect(CHECKS[c]).toBeDefined();
      for (const s of r.steps.filter((x) => x.kind === 'recover')) {
        expect(approvals).toContain(s.approval);
        expect(Boolean(s.link || s.manual || s.endpoint)).toBe(true);
      }
    }
  });
  it('rolls check results up to the worst state', () => {
    expect(overall([{ state: 'pass' }, { state: 'warn' }])).toBe('warn');
    expect(overall([{ state: 'error' }])).toBe('warn');
    expect(overall([{ state: 'pass' }, { state: 'fail' }])).toBe('fail');
  });
});

describe('privacy & data lifecycle', () => {
  const { retentionStatus, userLeftovers, subjectRequests } = require('../services/monitoring/privacy');
  it('judges retention from TTL index and overdue records', () => {
    const p = { retentionDays: 30 };
    expect(retentionStatus(p, { ttlDays: 30, overdue: 0, count: 5 }).state).toBe('pass');
    expect(retentionStatus(p, { ttlDays: 0, overdue: 0, count: 5 }).state).toBe('pass');
    expect(retentionStatus(p, { ttlDays: null, overdue: 0, count: 5 }).state).toBe('warn');
    expect(retentionStatus(p, { ttlDays: 90, overdue: 3, count: 5 }).state).toBe('fail');
    expect(retentionStatus({ retentionDays: 1825, legal: true }, { ttlDays: null, overdue: 2, count: 5 }).state).toBe('warn');
    expect(retentionStatus({ retentionDays: null }, { ttlDays: null, overdue: 0, count: 5 }).state).toBe('pass');
  });
  it('finds personal data left on a deleted account', () => {
    const anonymised = { name: 'Slettet bruker', email: 'slettet+1@jobblo.invalid', phone: null, portfolio: [], identityVerification: undefined };
    expect(userLeftovers(anonymised)).toEqual([]);
    expect(userLeftovers({ name: 'Kari', email: 'kari@example.no', phone: '+4790000000', portfolio: [{}] })).toEqual(['email', 'name', 'phone', 'portfolio']);
  });
  it('picks data-subject requests from tickets and tracks the 30-day deadline', () => {
    const now = Date.parse('2026-10-31T00:00:00Z');
    const t = (subject, status, daysAgo) => ({ _id: subject, subject, message: '', status, createdAt: new Date(now - daysAgo * 86_400_000), userId: null });
    const r = subjectRequests([t('Slett kontoen min', 'open', 35), t('Innsyn i mine data', 'in_progress', 5), t('Betaling feilet', 'open', 40), t('GDPR delete', 'closed', 60)], now);
    expect(r.map((x) => [x.subject, x.kind, x.overdue])).toEqual([
      ['Slett kontoen min', 'deletion', true],
      ['Innsyn i mine data', 'access/export', false],
      ['GDPR delete', 'deletion', false],
    ]);
    expect(r[1].daysLeft).toBe(25);
  });
});

describe('search & geolocation health', () => {
  const { geoIssue, listingFindings } = require('../services/monitoring/searchHealth');
  const at = (coordinates) => ({ location: coordinates === undefined ? undefined : { coordinates } });
  it('classifies listing coordinates', () => {
    expect(geoIssue(at([10.75, 59.91]))).toBeNull(); // Oslo
    expect(geoIssue(at([15.6, 78.2]))).toBeNull(); // Longyearbyen
    expect(geoIssue(at([59.91, 10.75]))).toBe('swapped');
    expect(geoIssue(at([73.13, 29.6]))).toBe('outside_norway'); // Pakistan: not a swapped Svalbard point
    expect(geoIssue(at([0, 0]))).toBe('zero');
    expect(geoIssue(at(undefined))).toBe('missing');
    expect(geoIssue(at([10.75]))).toBe('missing');
  });
  it('lists location, region and category problems per listing', () => {
    const f = listingFindings(
      [
        { _id: 'a', title: 'A', location: { coordinates: [10.75, 59.91] }, countyCode: '03', categories: ['Hage'] },
        { _id: 'b', title: 'B', location: { coordinates: [0, 0] }, countyCode: null, categories: ['Gone'] },
      ],
      ['Hage']
    );
    expect(f.map((x) => [x.id, x.issue])).toEqual([
      ['b', 'zero'],
      ['b', 'no_county'],
      ['b', 'unknown_category'],
    ]);
  });
});

describe('session diagnostics', () => {
  const { maskLabel, normalizeTrail, normalize } = require('../services/monitoring/rum');
  const { buildTimeline } = require('../services/monitoring/sessionDiagnostics');
  it('masks emails, phone numbers and ids in labels', () => {
    expect(maskLabel('Send to kari@example.no, ring +47 912 34 567 om 6a982fc4c9f28a8d07c772c4')).toBe('Send to [email], ring # om :id');
  });
  it('whitelists crumb types and caps the trail', () => {
    const now = Date.parse('2026-10-01T12:00:00Z');
    const trail = [...Array.from({ length: 40 }, (_, i) => ({ type: 'click', label: `b${i}`, page: '/x', at: new Date(now - 1000).toISOString() })), { type: 'keystroke', label: 'secret' }];
    const t = normalizeTrail(trail, now);
    expect(t).toHaveLength(29); // last 30 kept, the unknown type dropped
    expect(t.some((c) => c.label === 'secret')).toBe(false);
  });
  it('accepts problem events only with a known kind', () => {
    const r = normalize({ sessionId: 'abcdefgh12', events: [{ type: 'problem', kind: 'api', status: 503, message: 'GET /api/x → 503', page: '/' }, { type: 'problem', kind: 'video', message: 'x', page: '/' }] });
    expect(r.docs).toHaveLength(1);
    expect(r.docs[0]).toMatchObject({ type: 'problem', kind: 'api', status: 503 });
  });
  it('merges views, crumbs and problems into one de-duplicated timeline', () => {
    const t = (s) => new Date(Date.UTC(2026, 9, 1, 12, 0, s));
    const crumb = { at: t(2), type: 'click', page: '/jobs/:id', label: 'button "Søk"' };
    const tl = buildTimeline([
      { type: 'view', at: t(0), page: '/' },
      { type: 'view', at: t(1), page: '/jobs/:id', loadMs: 120 },
      { type: 'problem', kind: 'api', at: t(3), page: '/jobs/:id', message: 'POST /api/orders → 500', status: 500, trail: [crumb] },
      { type: 'error', at: t(4), page: '/jobs/:id', message: 'x is undefined', trail: [crumb] },
    ]);
    expect(tl.map((x) => [x.type, x.kind || null])).toEqual([
      ['view', null],
      ['view', null],
      ['click', null],
      ['problem', 'api'],
      ['problem', 'js_error'],
    ]);
  });
});

describe('mobile release management', () => {
  const { cmpVersion, releaseTable } = require('../services/monitoring/mobileReleases');
  it('compares versions numerically', () => {
    expect(cmpVersion('1.10.0', '1.9.9')).toBe(1);
    expect(cmpVersion('1.2', '1.2.0')).toBe(0);
    expect(cmpVersion('2.0.0', '10.0.0')).toBe(-1);
  });
  it('ranks versions per platform and flags outdated / unsupported ones', () => {
    const r = (platform, version, installs, sessions = 10, crashedSessions = 0, apiFailures = 0) => ({ platform, version, installs, sessions, crashedSessions, apiFailures });
    const t = releaseTable([r('ios', '1.2.0', 60, 100, 1, 5), r('ios', '1.10.0', 30), r('ios', '1.1.0', 10), r('android', '1.10.0', 5)], { ios: '1.2.0' });
    expect(t.filter((x) => x.platform === 'ios').map((x) => [x.version, x.status, x.share])).toEqual([
      ['1.10.0', 'latest', 30],
      ['1.2.0', 'previous', 60],
      ['1.1.0', 'unsupported', 10],
    ]);
    expect(t.find((x) => x.version === '1.2.0')).toMatchObject({ crashFree: 99, apiFailuresPer100: 5, behind: 1 });
    expect(t.find((x) => x.platform === 'android')).toMatchObject({ status: 'latest', share: 100 });
  });
});

describe('change risk analyzer', () => {
  const r = require('../services/monitoring/changeRisk');
  const keys = (factors) => factors.map((x) => x.key);
  it('combines points into a capped score and a level', () => {
    expect(r.combine([{ key: 'a', points: 10, why: '' }, { key: 'b', points: 20, why: '', mitigate: 'm' }])).toMatchObject({ score: 30, level: 'medium', mitigations: ['m'] });
    expect(r.combine([{ key: 'a', points: 90, why: '' }, { key: 'b', points: 40, why: '' }])).toMatchObject({ score: 100, level: 'critical' });
    expect(r.combine([]).level).toBe('low');
  });
  it('scores IP blocks by width, self-lockout and real users', () => {
    expect(keys(r.actionFactors({ type: 'ip_block', payload: { target: '10.0.0.0/16', hours: 24 }, requesterInRange: true, activeSessionsInRange: 3 }))).toEqual(['wide_range', 'self_block', 'real_users']);
    expect(r.actionFactors({ type: 'ip_block', payload: { target: '203.0.113.7', hours: 24 } })).toEqual([]);
    expect(keys(r.actionFactors({ type: 'flag_set', payload: { key: 'feature_checkout', enabled: false } }))).toEqual(['critical_flag', 'disabling']);
    expect(keys(r.actionFactors({ type: 'thresholds_set', payload: { thresholds: { apiErrorRate: 50, apiP95Ms: 2000 } }, currentThresholds: { apiErrorRate: 5, apiP95Ms: 1500 } }))).toEqual(['quieter_alerts']);
  });
  it('scores role changes, the Stripe mode switch and deployments', () => {
    expect(keys(r.roleFactors({ from: 'superAdmin', to: 'user', lastSuperAdmin: true, accountAgeDays: 400 }))).toEqual(['last_superadmin']);
    expect(keys(r.roleFactors({ from: 'user', to: 'superAdmin', accountAgeDays: 2, openFraudCase: true }))).toEqual(['to_superadmin', 'new_account', 'fraud_case']);
    expect(keys(r.stripeModeFactors({ production: true, toTest: true, targetKeysOk: false, targetWebhookOk: true, openOrdersOtherMode: 2 }))).toEqual(['prod_to_test', 'missing_keys', 'open_orders']);
    const d = r.deploymentFactors({ files: [{ path: 'backend/controllers/SafePayCheckoutController.js', added: 10, deleted: 2 }, { path: 'backend/models/User.js', added: 1, deleted: 0 }, { path: 'frontend/package.json', added: 1, deleted: 1 }], ciConclusion: 'failure' });
    expect(keys(d)).toEqual(['touches_money', 'touches_models', 'touches_deps', 'ci_failed']);
    expect(r.deploymentFactors({ files: [{ path: 'frontend/src/pages/Home.tsx', added: 3, deleted: 1 }], ciConclusion: 'success' })).toEqual([]);
    expect(r.deploymentFactors({ files: [{ path: 'STRIPE-WEBHOOK-SETUP.md', added: 3, deleted: 1 }, { path: 'backend/__tests__/payout.test.js', added: 9, deleted: 0 }] })).toEqual([]);
  });
  it('adds environment risk (incidents, SLO burn, gates, Friday afternoon in production)', () => {
    expect(keys(r.environmentFactors({ production: true, criticalIncidents: 1, burning: ['API availability'], qualityVerdict: 'blocked', osloDay: 5, osloHour: 15 }))).toEqual(['production', 'incident_critical', 'slo_burn', 'quality_blocked', 'off_hours']);
    expect(r.environmentFactors({ production: false, osloDay: 2, osloHour: 11 })).toEqual([]);
  });
});
