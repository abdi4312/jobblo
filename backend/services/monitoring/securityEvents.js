/**
 * Security signals derived from finished API responses (called by middleware/requestMetrics).
 * One place classifies every 401/403/429, so no auth code path needs its own logging.
 *
 * ponytail: buffered in memory and flushed every 10s, capped at 5000 per window so an
 * attack cannot turn monitoring into a write amplifier; overflow is counted, not stored.
 */

const BUFFER_CAP = 5000;
const FLUSH_MS = 10 * 1000;
let buffer = [];
let dropped = 0;

const maskEmail = (email) => {
  if (typeof email !== 'string' || !email.includes('@')) return null;
  const [local, domain] = email.trim().toLowerCase().split('@');
  return `${local.slice(0, 1)}***@${domain}`.slice(0, 120);
};

/** Keyed hash of an email, so distinct targeted accounts can be counted without storing them. */
const emailHash = (email) => {
  if (typeof email !== 'string' || !email.includes('@')) return null;
  const key = process.env.JWT_SECRET || 'jobblo-security-events';
  return require('crypto').createHmac('sha256', key).update(email.trim().toLowerCase()).digest('hex').slice(0, 24);
};

/** Client IP as shown everywhere in the dashboard (IPv4-mapped IPv6 unwrapped). */
const clientIp = (req) => (req.ip ? String(req.ip).replace(/^::ffff:/, '') : null);

/** Pure: response → security event type, or null when it is not a security signal. */
function classify({ status, path, code }) {
  const p = String(path || '');
  if (status === 429) return 'rate_limited';
  if (p === '/api/auth/login' && status === 401) return 'login_failed';
  if (/^\/api\/auth\/(verify-otp|reset-password)$/.test(p) && (status === 400 || status === 401)) return 'otp_failed';
  if (status === 401) {
    if (code === 'TOKEN_EXPIRED') return 'token_expired';
    if (code === 'SESSION_REVOKED') return 'session_revoked';
    if (code === 'TOKEN_MISSING') return 'unauthenticated';
    return 'token_invalid';
  }
  if (status === 403) return code === 'IP_BLOCKED' ? 'ip_blocked' : 'permission_denied';
  return null;
}

function record(req, res) {
  const status = res.statusCode;
  if (status < 400 || status > 429) return;
  const path = req.originalUrl.split('?')[0];
  const type = classify({ status, path, code: res.locals?.errorCode });
  if (!type) return;
  // Expected noise: the app probes the session on every page load while logged out.
  if (type === 'unauthenticated' && /^\/api\/(auth\/(profile|refresh-token)|notifications)/.test(path)) return;
  if (buffer.length >= BUFFER_CAP) {
    dropped += 1;
    return;
  }
  buffer.push({
    at: new Date(),
    type,
    ip: clientIp(req),
    method: req.method,
    route: path.slice(0, 200),
    status,
    code: res.locals?.errorCode ? String(res.locals.errorCode).slice(0, 60) : null,
    userId: req.user?._id || null,
    email: type === 'login_failed' ? maskEmail(req.body?.email) : null,
    emailHash: type === 'login_failed' ? emailHash(req.body?.email) : null,
    userAgent: String(req.get('user-agent') || '').slice(0, 200) || null,
  });
}

async function flush() {
  if (!buffer.length) return;
  const batch = buffer;
  buffer = [];
  try {
    await require('../../models/SecurityEvent').insertMany(batch, { ordered: false });
  } catch (err) {
    console.error('[securityEvents] flush failed:', err.message);
  }
}

let timer = null;
function startSecurityFlush() {
  if (timer || process.env.NODE_ENV === 'test') return;
  timer = setInterval(flush, FLUSH_MS);
  if (timer.unref) timer.unref();
}

const droppedCount = () => dropped;

module.exports = { classify, maskEmail, emailHash, clientIp, record, startSecurityFlush, droppedCount };
