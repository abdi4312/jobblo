const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const User = require('../models/User');

/**
 * Access and refresh tokens used to be indistinguishable: same `{id, sid}` payload and,
 * with JWT_REFRESH_SECRET unset, the same secret. authenticate() only checked the
 * signature, so the 7-day refresh token worked as a Bearer/cookie access token — outside
 * rotation and its reuse detection. Every token now names its purpose (`typ`, `aud`) and
 * issuer, and verifyToken() refuses a token presented for the other purpose.
 */
const ACCESS_TTL_S = 60 * 60; // 1 hour
const REFRESH_TTL_S = 7 * 24 * 60 * 60; // 7 days
const ISSUER = 'jobblo-api';
const PURPOSES = {
  access: { audience: 'jobblo:access', ttl: ACCESS_TTL_S },
  refresh: { audience: 'jobblo:refresh', ttl: REFRESH_TTL_S },
};
const ALGORITHM = 'HS256';

function signingSecret(purpose) {
  const secret =
    purpose === 'access'
      ? process.env.JWT_SECRET
      : process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT signing secret is not configured');
  return secret;
}

/**
 * Secrets a token of this purpose may be signed with. Access tokens: JWT_SECRET only,
 * so once JWT_REFRESH_SECRET is set a refresh token fails the signature here outright.
 * Refresh tokens: JWT_REFRESH_SECRET, then JWT_SECRET — what every refresh token was
 * signed with until JWT_REFRESH_SECRET is configured. (The refresh endpoint also requires
 * the exact token string to be the session's current or grace-period token in the DB.)
 */
function verificationSecrets(purpose) {
  const list =
    purpose === 'access'
      ? [process.env.JWT_SECRET]
      : [process.env.JWT_REFRESH_SECRET, process.env.JWT_SECRET];
  return [...new Set(list.filter(Boolean))];
}

const generateTokens = (userId, sessionId) => {
  // jwtid: without it two tokens for one session minted in the same second were
  // byte-identical, so a "rotated" refresh token could equal the one it replaced.
  const sign = (purpose) =>
    jwt.sign({ id: userId, sid: sessionId, typ: purpose }, signingSecret(purpose), {
      algorithm: ALGORITHM,
      expiresIn: PURPOSES[purpose].ttl,
      issuer: ISSUER,
      audience: PURPOSES[purpose].audience,
      jwtid: crypto.randomUUID(),
    });
  return { accessToken: sign('access'), refreshToken: sign('refresh') };
};

/**
 * Verify a token for one purpose ('access' | 'refresh'). Throws jsonwebtoken's errors:
 * TokenExpiredError for an expired token, JsonWebTokenError for everything else.
 *
 * Tokens issued before purpose claims existed carry no `typ`/`aud`/`iss`. They are told
 * apart by lifetime, which jsonwebtoken set exactly (exp - iat = 3600 or 604800), so
 * live sessions survive the deploy while a legacy refresh token still cannot pass as an
 * access token. ponytail: the legacy branch is dead weight 7 days after deploy (the
 * longest legacy lifetime); remove it then.
 */
function verifyToken(token, purpose) {
  const expected = PURPOSES[purpose];
  if (!expected) throw new Error(`verifyToken: unknown purpose ${purpose}`);
  const secrets = verificationSecrets(purpose);
  if (!secrets.length) throw new jwt.JsonWebTokenError('JWT secret is not configured');

  let decoded;
  let lastError;
  for (const secret of secrets) {
    try {
      decoded = jwt.verify(token, secret, { algorithms: [ALGORITHM] });
      break;
    } catch (err) {
      if (err.name === 'TokenExpiredError') throw err; // signature was valid
      lastError = err;
    }
  }
  if (!decoded) throw lastError;

  const isLegacy = decoded.typ === undefined && decoded.aud === undefined && decoded.iss === undefined;
  const ok = isLegacy
    ? decoded.exp - decoded.iat === expected.ttl
    : decoded.typ === purpose && decoded.aud === expected.audience && decoded.iss === ISSUER;
  if (!ok) throw new jwt.JsonWebTokenError(`token is not a valid ${purpose} token`);
  return decoded;
}

const axios = require('axios');

const getGeoLocation = async (ip) => {
  try {
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.includes('127.0.0.1')) {
      return 'Localhost';
    }
    const response = await axios.get(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
    if (response.data && response.data.status === 'success') {
      return `${response.data.city}, ${response.data.country}`;
    }
    return 'Unknown';
  } catch (error) {
    return 'Unknown';
  }
};

/**
 * Device model sent by the mobile app in `X-Device-Name` (e.g. "iPhone 15 Pro").
 * Client-supplied and display-only: letters, digits and `space . _ ( ) + , / -`, at most
 * 60 characters, or null.
 */
const deviceNameFrom = (req) => {
  const raw = req.headers?.['x-device-name'];
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/[^A-Za-z0-9 ._()+,/-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return name || null;
};

const createSession = async (req, userId) => {
  try {
    // Express's req.ip honours `trust proxy` (app.js), the same address the rate limiters
    // use. request-ip also believed client-set headers such as X-Client-IP. The
    // IPv4-mapped "::ffff:" prefix is display noise.
    const clientIp = String(req.ip || '').replace(/^::ffff:/, '') || 'unknown';
    // Parsed here, the one place that needs it: parsing every request's user agent in a
    // global middleware cost ~7 % of the API's CPU under load.
    const agent = req.useragent || new (require('express-useragent').UserAgent)().parse(String(req.headers?.['user-agent'] || ''));
    const location = await getGeoLocation(clientIp);

    const device = agent.isMobile ? 'Mobile' : agent.isTablet ? 'Tablet' : 'Desktop';
    const browser = agent.browser || 'Unknown';
    const os = agent.os || 'Unknown';

    // Create a temporary session to get an ID, or use a placeholder
    // We'll update the refreshToken later
    const session = new Session({
      userId,
      refreshToken: 'pending_' + Date.now(), // Temporary
      ip: clientIp,
      location,
      userAgent: req.headers['user-agent'] || 'Unknown',
      device: `${os} ${device}`,
      deviceName: deviceNameFrom(req),
      browser: browser || 'Unknown',
      os: os || 'Unknown',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Generate tokens WITH the session ID
    const { accessToken, refreshToken } = generateTokens(userId, session._id);

    // Update session with real refresh token
    session.refreshToken = refreshToken;
    await session.save();

    // Update lastLogin for the user
    await User.findByIdAndUpdate(userId, { lastLogin: new Date() });

    return { session, accessToken, refreshToken };
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

module.exports = { generateTokens, verifyToken, createSession, deviceNameFrom, ACCESS_TTL_S, REFRESH_TTL_S };
