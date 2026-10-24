const dns = require('dns').promises;
const tls = require('tls');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { redactSensitive } = require('../../utils/sanitizer');
const { logActivity } = require('../../services/admin/activityService');
const { getStripeWebhookReadiness } = require('../../services/stripe/webhookReadiness');
const scheduler = require('../../services/scheduler');
const User = require('../../models/User');
const ErrorLog = require('../../models/ErrorLog');
const AdminActivity = require('../../models/AdminActivity');
const StripeEvent = require('../../models/StripeEvent');
const { DAY } = require('../../utils/devQuery');
const { mongoPing } = require('../../services/monitoring/system');
const { schedulerSummary } = require('../../services/monitoring/summaries');

/** Developer console — health checks, trace lookup and the developer list. Read-only unless noted; no exec, no arbitrary queries, no secrets. */

// ── 21. Developer tools ─────────────────────────────────────────────────────
const ENV_KEYS = [
  'NODE_ENV',
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'FRONTEND_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_TEST_SECRET_KEY',
  'STRIPE_TEST_WEBHOOK_SECRET',
  'AZURE_STORAGE_CONNECTION_STRING',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'OPENAI_API_KEY',
  'EMAIL_HOST',
  'EMAIL_USER',
  'FIREBASE_SERVICE_ACCOUNT',
  'ENABLE_SCHEDULER',
];

function sslExpiry(host) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 5000 }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
      resolve({ ok: socket.authorized, validTo, daysLeft: validTo ? Math.floor((validTo - Date.now()) / DAY) : null, issuer: cert?.issuer?.O || null });
    });
    socket.on('error', (e) => resolve({ ok: false, error: e.code || e.message }));
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
  });
}

async function timed(fn) {
  const start = Date.now();
  try {
    const result = await fn();
    return { ok: result?.ok !== false, ms: Date.now() - start, ...result };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: e.code || e.message };
  }
}

const runChecks = asyncHandler(async (req, res) => {
  const frontendHost = (() => {
    try {
      return new URL(process.env.FRONTEND_URL || '').hostname || null;
    } catch {
      return null;
    }
  })();

  const [mongo, stripe, webhook, dnsCheck, ssl] = await Promise.all([
    timed(async () => {
      const p = await mongoPing();
      return { ok: p.ok };
    }),
    timed(async () => {
      const { getStripe } = require('../../config/stripe');
      const s = await getStripe();
      await s.balance.retrieve();
      return { ok: true };
    }),
    timed(async () => {
      const r = await getStripeWebhookReadiness();
      return { ok: r.status === 'healthy', status: r.status, mode: r.mode };
    }),
    frontendHost && !['localhost', '127.0.0.1'].includes(frontendHost)
      ? timed(async () => ({ host: frontendHost, addresses: (await dns.lookup(frontendHost, { all: true })).map((a) => a.address) }))
      : { ok: null, skipped: 'FRONTEND_URL not set or local' },
    frontendHost && !['localhost', '127.0.0.1'].includes(frontendHost)
      ? sslExpiry(frontendHost).then((r) => ({ host: frontendHost, ...r }))
      : { ok: null, skipped: 'FRONTEND_URL not set or local' },
  ]);

  const env = ENV_KEYS.map((name) => ({ name, present: Boolean(process.env[name]) }));
  const schedulerJobs = await schedulerSummary(new Date(Date.now() - DAY));

  const checks = [
    { key: 'api', label: 'API process', ok: true, detail: `uptime ${Math.round(process.uptime())}s` },
    { key: 'mongo', label: 'MongoDB ping', ...mongo },
    { key: 'stripe', label: 'Stripe API connectivity', ...stripe },
    { key: 'webhook', label: 'Stripe webhook configuration', ...webhook },
    {
      key: 'scheduler',
      label: 'Scheduler',
      ok: scheduler.state.enabled ? !schedulerJobs.some((j) => j.status === 'failing' || j.status === 'missed') : null,
      detail: scheduler.state.enabled ? `${schedulerJobs.filter((j) => j.status === 'healthy').length}/${schedulerJobs.length} healthy` : 'disabled on this instance',
    },
    { key: 'dns', label: 'DNS resolution', ...dnsCheck },
    { key: 'ssl', label: 'SSL certificate', ...ssl, ok: ssl.ok === null ? null : ssl.ok && (ssl.daysLeft ?? 0) > 14 },
    (() => {
      // How this request's client IP was derived — verifies the proxy trust setup.
      const socketIp = req.socket?.remoteAddress || null;
      const xff = req.get('x-forwarded-for');
      const proxyTrusted = Boolean(socketIp && req.app.get('trust proxy fn')(socketIp, 0));
      return {
        key: 'proxy',
        label: 'Client IP detection',
        ok: xff ? proxyTrusted : true,
        detail: `client ${req.ip} · connection from ${socketIp} · X-Forwarded-For ${xff ? `${xff.split(',').length} hop(s), ${proxyTrusted ? 'trusted' : 'IGNORED (sender is not a trusted proxy)'}` : 'absent'} · trust "${process.env.TRUST_PROXY || 'loopback'}"`,
      };
    })(),
    (() => {
      // In production the API must only listen on loopback, behind nginx.
      const host = process.env.HOST || '0.0.0.0 (all interfaces)';
      const loopbackOnly = ['127.0.0.1', '::1', 'localhost'].includes(process.env.HOST);
      return { key: 'listen', label: 'Backend listening address', ok: process.env.NODE_ENV === 'production' ? loopbackOnly : null, detail: loopbackOnly ? `${host} — not reachable from outside this host` : `${host} — set HOST=127.0.0.1 in production so only nginx can reach port ${process.env.PORT || 5001}` };
    })(),
    { key: 'queue', label: 'Queue workers', ok: null, detail: 'No queue system configured' },
    { key: 'cache', label: 'Cache', ok: null, detail: 'No cache configured' },
    {
      key: 'config',
      label: 'Configuration',
      ok: env.filter((e) => ['MONGO_URI', 'JWT_SECRET', 'FRONTEND_URL'].includes(e.name)).every((e) => e.present),
      detail: `${env.filter((e) => e.present).length}/${env.length} known env vars present`,
    },
  ];

  await logActivity({
    adminId: req.user._id,
    action: 'other',
    description: 'Developer ran system readiness checks',
    metadata: { area: 'developer.tools', failed: checks.filter((c) => c.ok === false).map((c) => c.key) },
    ip: req.ip,
    userAgent: req.get('user-agent') || 'unknown',
  });

  return sendSuccess(res, { ranAt: new Date(), checks: redactSensitive(checks), env });
});

/** Look up everything recorded for one request / correlation / reference ID. */
const traceLookup = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '').trim().slice(0, 100);
  if (!id) return sendError(res, 'id is required.', 400);
  const [errors, activity, webhooks] = await Promise.all([
    ErrorLog.find({ $or: [{ requestId: id }, { referenceId: id }] })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-notes')
      .lean(),
    AdminActivity.find({ 'metadata.correlationId': id }).sort({ createdAt: -1 }).limit(20).select('-stack').lean(),
    StripeEvent.find({ $or: [{ eventId: id }, { objectId: id }] }).limit(20).lean(),
  ]);
  return sendSuccess(res, {
    id,
    errors: errors.map((e) => ({ ...e, metadata: redactSensitive(e.metadata || {}) })),
    activity: activity.map((a) => ({ ...a, metadata: redactSensitive(a.metadata || {}) })),
    webhooks,
  });
});

/** Assignable developers for error triage. */
const getDevelopers = asyncHandler(async (req, res) => {
  const developers = await User.find({ role: { $in: ['developer', 'superAdmin'] }, isDeleted: { $ne: true } })
    .select('name email role avatarUrl')
    .lean();
  return sendSuccess(res, { developers });
});

module.exports = { runChecks, traceLookup, getDevelopers };
