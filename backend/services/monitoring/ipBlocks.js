const net = require('net');
const { clientIp } = require('./securityEvents');

/**
 * IP block list enforced on every Express request (Stripe webhooks are mounted
 * before this guard and are never blocked).
 *
 * ponytail: each instance holds an in-memory net.BlockList rebuilt from the database
 * every 30s and immediately after a local change, so other instances pick up a new
 * block within 30s. Socket.io connections are not covered. Upgrade path: enforce at
 * the edge (nginx / Azure Front Door / WAF) for instant, fleet-wide blocking.
 */

const REFRESH_MS = 30 * 1000;
let list = new net.BlockList();
let entries = []; // [{ target, expiresAt }]
let timer = null;

/** Pure: validate a block target. Returns { type, address, prefix } or an { error }. */
function parseTarget(raw) {
  const value = String(raw || '').trim().replace(/^::ffff:/, '');
  const [address, prefixRaw] = value.split('/');
  const type = net.isIP(address);
  if (!type) return { error: 'Not a valid IPv4 or IPv6 address.' };
  if (prefixRaw === undefined) return { type, address, prefix: null, target: address };
  const prefix = Number(prefixRaw);
  // Refuse ranges wide enough to take out whole ISPs by accident.
  const min = type === 4 ? 16 : 48;
  const max = type === 4 ? 32 : 128;
  if (!Number.isInteger(prefix) || prefix < min || prefix > max) return { error: `CIDR prefix must be /${min}–/${max} for IPv${type}.` };
  return { type, address, prefix, target: `${address}/${prefix}` };
}

function build(docs) {
  const next = new net.BlockList();
  for (const d of docs) {
    const t = parseTarget(d.target);
    if (t.error) continue;
    const family = t.type === 4 ? 'ipv4' : 'ipv6';
    if (t.prefix === null) next.addAddress(t.address, family);
    else next.addSubnet(t.address, t.prefix, family);
  }
  return next;
}

async function refresh() {
  try {
    const IpBlock = require('../../models/IpBlock');
    const docs = await IpBlock.find({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).select('target expiresAt').lean();
    entries = docs;
    list = build(docs);
  } catch (err) {
    console.error('[ipBlocks] refresh failed:', err.message);
  }
}

function isBlocked(ip) {
  if (!ip || !entries.length) return false;
  const family = net.isIP(ip) === 6 ? 'ipv6' : 'ipv4';
  return list.check(ip, family);
}

/** Express guard. */
function ipBlockGuard(req, res, next) {
  if (!entries.length) return next();
  if (!isBlocked(clientIp(req))) return next();
  return res.status(403).json({ error: 'Access denied', message: 'Access from your network is blocked.', code: 'IP_BLOCKED' });
}

function startIpBlocks() {
  if (timer || process.env.NODE_ENV === 'test') return;
  refresh();
  timer = setInterval(refresh, REFRESH_MS);
  if (timer.unref) timer.unref();
}

module.exports = { parseTarget, build, refresh, isBlocked, ipBlockGuard, startIpBlocks };
