const net = require('net');
const { execFile } = require('child_process');

/**
 * Change risk analyzer: a 0–100 risk score, with the reasons, BEFORE a change is applied —
 * sensitive console actions (IP blocks, flags, thresholds, SLOs, access), role changes,
 * switching Stripe between live and test, and deploying a git ref.
 *
 * Every type has a pure `…Factors(facts)` function (unit-tested) that turns gathered facts
 * into factors { key, points, why, mitigate? }; `environmentFactors` adds what makes ANY
 * change riskier right now (open incidents, SLO burn, blocked quality gates, Friday/night).
 * ponytail: points are hand-tuned weights, not a learned model; tune them in one place here.
 */

const DAY = 86_400_000;
const f = (key, points, why, mitigate) => ({ key, points, why, ...(mitigate ? { mitigate } : {}) });

/** Pure: total score and level. Unit-tested. */
function combine(factors) {
  const score = Math.min(100, Math.max(0, factors.reduce((a, x) => a + x.points, 0)));
  const level = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, level, factors: [...factors].sort((a, b) => b.points - a.points), mitigations: [...new Set(factors.map((x) => x.mitigate).filter(Boolean))] };
}

// ── Environment: what makes any change riskier right now ─────────────────────────────

/** Pure. `now` in Europe/Oslo terms: { weekday 0-6, hour }. Unit-tested. */
function environmentFactors({ production, criticalIncidents = 0, highIncidents = 0, burning = [], qualityVerdict = null, recentDeployMinutes = null, osloDay, osloHour }) {
  const out = [];
  if (production) out.push(f('production', 10, 'Applies to production.'));
  if (criticalIncidents) out.push(f('incident_critical', 25, `${criticalIncidents} critical incident(s) open — a change now muddies the investigation.`, 'Wait until the incident is resolved unless this change is the fix.'));
  else if (highIncidents) out.push(f('incident_high', 10, `${highIncidents} high-severity incident(s) open.`));
  if (burning.length) out.push(f('slo_burn', 15, `Error budget burning fast: ${burning.join(', ')}.`, 'Let the error budget recover first.'));
  if (qualityVerdict === 'blocked') out.push(f('quality_blocked', 25, 'Release quality gates are blocking (Test & Quality).', 'Fix the blocking gate first.'));
  if (recentDeployMinutes !== null && recentDeployMinutes < 120) out.push(f('recent_deploy', 5, `Another release went out ${recentDeployMinutes} min ago — two changes at once are hard to tell apart.`));
  const offHours = osloDay === 0 || osloDay === 6 || (osloDay === 5 && osloHour >= 14) || osloHour >= 22 || osloHour < 7;
  if (offHours && production) out.push(f('off_hours', 10, 'Outside working hours (Friday afternoon, weekend or night, Oslo time) — fewer people to react.', 'Apply during working hours if it can wait.'));
  return out;
}

// ── Sensitive console actions ─────────────────────────────────────────────────────────

const RISKY_FLAG = /payment|checkout|stripe|safe.?pay|payout|refund|auth|login|signup|register|maintenance|subscription/i;

/** Pure. facts: { type, payload, activeSessionsInRange, requesterInRange, currentThresholds, currentTargets }. Unit-tested. */
function actionFactors({ type, payload = {}, activeSessionsInRange = 0, requesterInRange = false, currentThresholds = {}, currentTargets = {} }) {
  const out = [];
  if (type === 'ip_block') {
    const prefix = Number(String(payload.target || '').split('/')[1]);
    if (prefix && prefix <= 16) out.push(f('wide_range', 40, `Blocks a whole /${prefix} range (${2 ** (32 - prefix)} addresses) — mobile carriers and offices share these.`, 'Block the single address first.'));
    else if (prefix && prefix <= 24) out.push(f('range', 15, `Blocks a /${prefix} range.`));
    if (requesterInRange) out.push(f('self_block', 60, 'Your own IP is inside this block — you would lock yourself out.', 'Exclude your address.'));
    if (activeSessionsInRange) out.push(f('real_users', Math.min(40, 10 + activeSessionsInRange * 5), `${activeSessionsInRange} signed-in session(s) come from this address/range.`, 'Check those users on Investigate before blocking.'));
    if (!payload.hours || payload.hours > 24 * 30) out.push(f('long', 5, payload.hours ? `Lasts ${Math.round(payload.hours / 24)} days.` : 'Never expires.', 'Give the block an expiry.'));
  }
  if (type === 'flag_set') {
    if (RISKY_FLAG.test(payload.key || '')) out.push(f('critical_flag', 35, `"${payload.key}" touches payments, sign-in or availability.`, 'Try it in staging first and watch Payments / Errors right after.'));
    if (payload.enabled === false) out.push(f('disabling', 10, 'Turns a feature off for everyone at once.'));
  }
  if (type === 'thresholds_set') {
    const raised = Object.entries(payload.thresholds || {}).filter(([k, v]) => currentThresholds[k] != null && v > currentThresholds[k] * 2);
    if (raised.length) out.push(f('quieter_alerts', Math.min(30, raised.length * 10), `Alert thresholds more than doubled for ${raised.map(([k]) => k).join(', ')} — real incidents may go unnoticed.`, 'Raise in smaller steps.'));
  }
  if (type === 'slo_targets_set') {
    const lowered = Object.entries(payload.targets || {}).filter(([k, v]) => currentTargets[k] != null && v < currentTargets[k]);
    if (lowered.length) out.push(f('lower_slo', Math.min(25, lowered.length * 8), `SLO targets lowered for ${lowered.map(([k]) => k).join(', ')}.`));
  }
  if (type === 'developer_access' && payload.access === 'operations') out.push(f('more_access', 20, `${payload.name || 'A developer'} gets operations access (can run operational actions).`));
  return out;
}

// ── Role changes ──────────────────────────────────────────────────────────────────────

/** Pure. facts: { from, to, accountAgeDays, openFraudCase, lastSuperAdmin, deleted }. Unit-tested. */
function roleFactors({ from, to, accountAgeDays, openFraudCase, lastSuperAdmin, deleted }) {
  const out = [];
  if (to === 'superAdmin') out.push(f('to_superadmin', 50, 'Grants full control: money, users, settings.', 'Have a second Super Admin confirm.'));
  if (to === 'developer') out.push(f('to_developer', 25, 'Grants the developer console (logs, users, payments read).'));
  if (from === 'superAdmin' && lastSuperAdmin) out.push(f('last_superadmin', 80, 'Removes the last Super Admin — nobody could approve changes afterwards.', 'Promote another Super Admin first.'));
  if (['superAdmin', 'developer'].includes(to) && accountAgeDays !== null && accountAgeDays < 7) out.push(f('new_account', 20, `The account is only ${accountAgeDays} day(s) old.`, 'Verify the person out of band.'));
  if (openFraudCase) out.push(f('fraud_case', 30, 'The account has an open fraud case.', 'Resolve the fraud case first.'));
  if (deleted) out.push(f('deleted', 40, 'The account is deleted.'));
  return out;
}

// ── Stripe live / test mode ──────────────────────────────────────────────────────────

/** Pure. facts: { production, toTest, targetKeysOk, targetWebhookOk, openOrdersOtherMode, activeSubscriptions, pendingPayouts }. Unit-tested. */
function stripeModeFactors({ production, toTest, targetKeysOk, targetWebhookOk, openOrdersOtherMode = 0, activeSubscriptions = 0, pendingPayouts = 0 }) {
  const out = [];
  if (production && toTest) out.push(f('prod_to_test', 50, 'Production would take TEST payments — real customers could not pay.', 'Only in a maintenance window, and switch back right after.'));
  if (!targetKeysOk) out.push(f('missing_keys', 60, `The ${toTest ? 'test' : 'live'} secret key is missing or the wrong kind — every Stripe call would fail.`, 'Set the key before switching.'));
  if (!targetWebhookOk) out.push(f('missing_webhook', 30, `No ${toTest ? 'test' : 'live'} webhook secret — payments would not be confirmed.`, 'Set the webhook secret first.'));
  if (openOrdersOtherMode) out.push(f('open_orders', Math.min(30, 10 + openOrdersOtherMode * 2), `${openOrdersOtherMode} paid order(s) in progress were made in the current mode — refunds and payouts for them need that mode.`, 'Finish or settle them first.'));
  if (activeSubscriptions) out.push(f('subscriptions', 20, `${activeSubscriptions} active subscription(s) renew through the current mode.`));
  if (pendingPayouts) out.push(f('payouts', 15, `${pendingPayouts} payout(s) pending.`));
  return out;
}

// ── Deployments ──────────────────────────────────────────────────────────────────────

const SENSITIVE_PATHS = [
  { key: 'money', points: 25, rx: /(stripe|safepay|payout|payment|refund|ledger|checkout|subscription)/i, why: 'payments / money' },
  { key: 'auth', points: 20, rx: /(auth|session|token|passport|password|oauth|vipps|idura|stepUp)/i, why: 'sign-in / sessions' },
  { key: 'models', points: 10, rx: /backend\/models\//, why: 'database models (schema)' },
  { key: 'migrations', points: 15, rx: /backend\/scripts\/(migrate|fix|dedupe|merge|archive|backfill)/i, why: 'migration scripts' },
  { key: 'infra', points: 15, rx: /(^|\/)(Dockerfile|docker-compose|nginx|\.github\/|deploy\/)/i, why: 'infrastructure / CI' },
  { key: 'deps', points: 10, rx: /package(-lock)?\.json$/, why: 'dependencies' },
];

/** Pure. facts: { files: [{ path, added, deleted }], ciConclusion, pendingDestructiveMigrations }. Unit-tested. */
function deploymentFactors({ files = [], ciConclusion = null, pendingDestructiveMigrations = 0 }) {
  const out = [];
  const lines = files.reduce((a, x) => a + (x.added || 0) + (x.deleted || 0), 0);
  if (files.length > 50 || lines > 2000) out.push(f('large', 15, `Large change: ${files.length} files, ${lines} lines.`, 'Ship in smaller releases.'));
  else if (files.length > 15 || lines > 500) out.push(f('medium_size', 5, `${files.length} files, ${lines} lines.`));
  // Docs and tests count toward size, not toward what the release touches at runtime.
  const runtime = files.filter((x) => !/\.md$|(^|\/)(__tests__|e2e|evals)\/|\.(test|spec)\.[jt]sx?$/.test(x.path));
  for (const s of SENSITIVE_PATHS) {
    const hit = runtime.filter((x) => s.rx.test(x.path));
    if (hit.length) out.push(f(`touches_${s.key}`, s.points, `Touches ${s.why}: ${hit.slice(0, 3).map((x) => x.path.split('/').pop()).join(', ')}${hit.length > 3 ? ` +${hit.length - 3}` : ''}.`, s.key === 'money' ? 'Watch Payments, Ledger and Event Consistency for an hour after.' : undefined));
  }
  if (ciConclusion && ciConclusion !== 'success') out.push(f('ci_failed', 30, `CI for this commit: ${ciConclusion}.`, 'Get CI green first.'));
  if (pendingDestructiveMigrations) out.push(f('destructive_migration', 15, `${pendingDestructiveMigrations} destructive migration(s) still pending (Migrations).`, 'Take and verify a backup before deploying.'));
  return out;
}

// ── Fact gathering (I/O) ─────────────────────────────────────────────────────────────

function oslo(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
  return { osloDay: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), osloHour: Number(parts.hour) };
}

async function environment() {
  const Incident = require('../../models/Incident');
  const [criticalIncidents, highIncidents, burning, quality, lastDeploy] = await Promise.all([
    Incident.countDocuments({ status: { $ne: 'resolved' }, severity: 'critical' }),
    Incident.countDocuments({ status: { $ne: 'resolved' }, severity: 'high' }),
    require('./slo').burningSlos().catch(() => []),
    require('./quality').overview({ days: 30 }).catch(() => null),
    require('../../models/Deployment').findOne().sort({ deployedAt: -1 }).select('deployedAt').lean(),
  ]);
  return environmentFactors({
    production: process.env.NODE_ENV === 'production',
    criticalIncidents,
    highIncidents,
    burning: burning.map((b) => b.name || b.key),
    qualityVerdict: quality?.verdict || null,
    recentDeployMinutes: lastDeploy ? Math.round((Date.now() - lastDeploy.deployedAt) / 60_000) : null,
    ...oslo(),
  });
}

async function assessAction(type, payload, { requesterIp } = {}) {
  const facts = { type, payload };
  if (type === 'ip_block' && payload.target) {
    const list = require('./ipBlocks').build([{ target: payload.target }]);
    const inRange = (ip) => {
      const clean = String(ip || '').replace(/^::ffff:/, '');
      return net.isIP(clean) ? list.check(clean, net.isIP(clean) === 6 ? 'ipv6' : 'ipv4') : false;
    };
    const ips = await require('../../models/Session').distinct('ip', { expiresAt: { $gt: new Date() } });
    const hits = ips.filter(inRange);
    facts.activeSessionsInRange = hits.length ? await require('../../models/Session').countDocuments({ ip: { $in: hits }, expiresAt: { $gt: new Date() } }) : 0;
    facts.requesterInRange = inRange(requesterIp);
  }
  if (type === 'thresholds_set') facts.currentThresholds = await require('./alerts').getThresholds();
  if (type === 'slo_targets_set') facts.currentTargets = await require('./slo').getTargets();
  return combine([...actionFactors(facts), ...(await environment())]);
}

async function assessRole({ userId, role }) {
  const User = require('../../models/User');
  const u = await User.findById(userId).select('role createdAt isDeleted name email').lean();
  if (!u) return null;
  const [superAdmins, fraud] = await Promise.all([User.countDocuments({ role: 'superAdmin', isDeleted: { $ne: true } }), require('../../models/FraudCase').exists({ userId, status: { $in: ['open', 'investigating', 'confirmed'] } })]);
  const r = combine([
    ...roleFactors({ from: u.role, to: role, accountAgeDays: u.createdAt ? Math.floor((Date.now() - u.createdAt) / DAY) : null, openFraudCase: Boolean(fraud), lastSuperAdmin: u.role === 'superAdmin' && superAdmins <= 1 && role !== 'superAdmin', deleted: u.isDeleted }),
    ...(await environment()),
  ]);
  return { ...r, subject: `${u.name || u.email}: ${u.role} → ${role}` };
}

async function assessStripeMode({ toTest }) {
  const { isTestMode } = require('../../config/stripe');
  const current = await isTestMode().catch(() => null);
  const env = process.env;
  const key = toTest ? env.STRIPE_TEST_SECRET_KEY : env.STRIPE_SECRET_KEY;
  const Order = require('../../models/Order');
  const [openOrdersOtherMode, activeSubscriptions, pendingPayouts] = await Promise.all([
    Order.countDocuments({ paymentStatus: 'paid', status: { $nin: ['completed', 'cancelled'] }, checkoutMode: current ? 'test' : 'live' }),
    require('../../models/SubscriptionV2').countDocuments({ status: { $in: ['active', 'past_due', 'canceling'] }, stripeMode: current ? 'test' : 'live' }).catch(() => 0),
    require('../../models/Payout').countDocuments({ status: { $in: ['pending', 'processing'] } }).catch(() => 0),
  ]);
  const r = combine([
    ...(current === toTest ? [] : stripeModeFactors({ production: env.NODE_ENV === 'production', toTest, targetKeysOk: Boolean(key && (toTest ? /^(sk|rk)_test_/ : /^(sk|rk)_live_/).test(key)), targetWebhookOk: Boolean(toTest ? env.STRIPE_TEST_WEBHOOK_SECRET : env.STRIPE_WEBHOOK_SECRET), openOrdersOtherMode, activeSubscriptions, pendingPayouts })),
    ...(await environment()),
  ]);
  return { ...r, subject: current === toTest ? `Stripe is already in ${toTest ? 'test' : 'live'} mode — nothing to change.` : `Switch Stripe from ${current ? 'test' : 'live'} to ${toTest ? 'test' : 'live'}` };
}

const git = (args) =>
  new Promise((resolve) => execFile('git', args, { cwd: __dirname, timeout: 10_000, maxBuffer: 10 * 1024 * 1024 }, (err, out) => resolve(err ? null : String(out))));

/** Files changed between the running commit and `ref`: local git first, GitHub compare API otherwise. */
async function diffFiles(base, ref) {
  // Two-dot: what actually differs between the running commit and the target — also right for a rollback.
  const local = base ? await git(['diff', '--numstat', base, ref]) : null;
  if (local !== null) {
    return { source: 'git', files: local.split('\n').filter(Boolean).map((l) => { const [a, d, p] = l.split('\t'); return { path: p, added: Number(a) || 0, deleted: Number(d) || 0 }; }) };
  }
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO || 'abdi4312/jobblo';
  if (!token || !base) return { source: null, files: [], error: base ? 'No local git and no GITHUB_TOKEN to compare commits.' : 'The running commit is unknown (set GIT_COMMIT_SHA).' };
  const res = await fetch(`https://api.github.com/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(ref)}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return { source: 'github', files: [], error: `GitHub compare: HTTP ${res.status}` };
  const data = await res.json();
  return { source: 'github', files: (data.files || []).map((x) => ({ path: x.filename, added: x.additions, deleted: x.deletions })), headSha: data.commits?.at(-1)?.sha };
}

async function assessDeployment({ ref }) {
  if (typeof ref !== 'string' || !/^[\w./-]{1,100}$/.test(ref) || ref.includes('..')) return { error: 'Give a branch, tag or commit (letters, digits, . _ / -).' };
  const base = require('./deployments').identity().commit;
  const diff = await diffFiles(base, ref);
  const headSha = diff.headSha || (await git(['rev-parse', ref]))?.trim() || null;
  const [github, migrations] = await Promise.all([require('./github').githubRuns().catch(() => null), require('./migrations').overview().catch(() => null)]);
  const ci = headSha && github?.runs?.find((r) => r.status === 'completed' && headSha.startsWith(r.sha));
  const r = combine([
    ...deploymentFactors({ files: diff.files, ciConclusion: ci?.conclusion || null, pendingDestructiveMigrations: migrations ? migrations.migrations.filter((m) => m.pending && m.destructive).length : 0 }),
    ...(await environment()),
  ]);
  return { ...r, subject: `Deploy ${ref}${headSha ? ` (${headSha.slice(0, 7)})` : ''} over ${base ? base.slice(0, 7) : 'unknown'}`, diff: { source: diff.source, error: diff.error || null, files: diff.files.length, lines: diff.files.reduce((a, x) => a + x.added + x.deleted, 0), sample: diff.files.slice(0, 40) }, ci: ci ? { conclusion: ci.conclusion, url: ci.url } : null };
}

module.exports = { combine, environmentFactors, actionFactors, roleFactors, stripeModeFactors, deploymentFactors, environment, assessAction, assessRole, assessStripeMode, assessDeployment, oslo };
