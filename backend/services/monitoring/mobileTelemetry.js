const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Intake for the mobile app's lightweight reporter. The endpoint is public (crashes happen
 * before and after login), so everything is whitelisted, length-capped and batch-limited
 * here; the route adds a per-IP rate limit.
 */

const MAX_BATCH = 50;
const TYPES = ['session', 'error', 'api'];
const KINDS = ['js', 'render', 'promise'];
const PLATFORMS = ['ios', 'android', 'web'];
const DAY = 24 * 60 * 60 * 1000;

const str = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const id = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v) ? v : null);

/** Drop line/column numbers and ids so the same bug in every build groups together. */
function fingerprint(name, message, stack) {
  const msg = String(message || '')
    .replace(/[0-9a-f]{24}/gi, ':id')
    .replace(/\d+/g, '#')
    .slice(0, 200);
  const frame = String(stack || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => /^at |@/.test(l));
  const fn = frame ? frame.replace(/^at /, '').split(/[ (@]/)[0] : '';
  return crypto.createHash('sha1').update(`${name || ''}|${msg}|${fn}`).digest('hex').slice(0, 16);
}

/** Pure: validate one batch into documents. Unit-tested. */
function normalize(body, userId = null, now = Date.now()) {
  const ctx = body && typeof body === 'object' ? body : {};
  const installId = id(ctx.installId);
  const sessionId = id(ctx.sessionId);
  if (!installId || !sessionId) return { error: 'installId and sessionId are required.' };
  const events = Array.isArray(ctx.events) ? ctx.events.slice(0, MAX_BATCH) : [];
  const base = {
    installId,
    sessionId,
    userId: userId && mongoose.isValidObjectId(userId) ? userId : null,
    platform: PLATFORMS.includes(ctx.platform) ? ctx.platform : null,
    osVersion: str(ctx.osVersion, 40),
    appVersion: str(ctx.appVersion, 40),
    build: str(ctx.build, 40),
    device: str(ctx.device, 80),
  };
  const docs = [];
  for (const e of events) {
    if (!e || !TYPES.includes(e.type)) continue;
    const t = Number(new Date(e.at));
    // Clock skew and replays: accept events from the last 7 days, never from the future.
    const at = new Date(Number.isFinite(t) && t <= now + 5 * 60 * 1000 && t >= now - 7 * DAY ? t : now);
    const doc = { ...base, type: e.type, at, screen: str(e.screen, 120) };
    if (e.type === 'error') {
      doc.name = str(e.name, 80) || 'Error';
      doc.message = str(e.message, 500) || '(no message)';
      doc.stack = str(e.stack, 4000);
      doc.fatal = e.fatal === true;
      doc.kind = KINDS.includes(e.kind) ? e.kind : 'js';
      doc.fingerprint = fingerprint(doc.name, doc.message, doc.stack);
    } else if (e.type === 'api') {
      doc.method = str(e.method, 10)?.toUpperCase() || null;
      doc.path = str(e.path, 200);
      doc.status = Number.isInteger(e.status) && e.status >= 0 && e.status < 600 ? e.status : null;
      doc.ms = Number.isFinite(e.ms) && e.ms >= 0 ? Math.min(Math.round(e.ms), 600_000) : null;
      if (!doc.path) continue;
    }
    docs.push(doc);
  }
  return { docs, dropped: events.length - docs.length + Math.max(0, (ctx.events?.length || 0) - MAX_BATCH) };
}

async function ingest(req, res) {
  const { docs, error } = normalize(req.body, req.userId || req.user?._id || null);
  if (error) return res.status(400).json({ success: false, message: error });
  if (docs.length) await require('../../models/MobileEvent').insertMany(docs, { ordered: false });
  return res.status(202).json({ success: true, accepted: docs.length });
}

module.exports = { normalize, fingerprint, ingest, MAX_BATCH };
