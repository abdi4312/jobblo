/**
 * Access vs refresh tokens must not be interchangeable.
 *
 * Both used to be `{ id, sid }` signed with JWT_SECRET (JWT_REFRESH_SECRET is unset), and
 * authenticate() only checked the signature — so the 7-day refresh token worked as an
 * access token (Bearer or accessToken cookie), outside rotation and reuse detection.
 *
 * Real jsonwebtoken, real authenticate / refreshToken / logout; sessions and users are
 * an in-memory stand-in. Test secrets only.
 */
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../models/Session', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  deleteOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../models/User', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));

const Session = require('../models/Session');
const User = require('../models/User');

const SECRET = 'test-access-secret';
const REFRESH_SECRET = 'test-refresh-secret';
const OLD_ENV = { ...process.env };

let sessions;
let users;
function addSession(id, userId) {
  const s = { _id: id, userId, refreshToken: null, oldRefreshToken: null, updatedAt: new Date() };
  s.save = jest.fn(async () => s);
  sessions.set(id, s);
  return s;
}
const query = (v) => ({ select: () => Promise.resolve(v), then: (r, j) => Promise.resolve(v).then(r, j) });

function installMocks() {
  Session.findOne.mockImplementation(async (f) => {
    const all = [...sessions.values()];
    if (f.refreshToken !== undefined) return all.find((s) => s.refreshToken === f.refreshToken) || null;
    if (f.oldRefreshToken !== undefined) return all.find((s) => s.oldRefreshToken === f.oldRefreshToken) || null;
    const s = sessions.get(String(f._id));
    return s && String(s.userId) === String(f.userId) ? s : null;
  });
  const matchesOr = (s, or) => or.some((c) => (c.refreshToken ?? c.oldRefreshToken) === (c.refreshToken !== undefined ? s.refreshToken : s.oldRefreshToken));
  Session.deleteOne.mockImplementation(async ({ $or }) => {
    for (const [id, s] of sessions) if (matchesOr(s, $or)) sessions.delete(id);
  });
  Session.findOneAndUpdate.mockImplementation(async ({ _id, $or }, update) => {
    const s = sessions.get(String(_id));
    if (!s || !matchesOr(s, $or)) return null;
    Object.assign(s, update, { updatedAt: new Date() });
    return s;
  });
  User.findById.mockImplementation((id) => query(users.get(String(id)) || null));
}

let tokenUtils;
let app;
function buildApp() {
  jest.isolateModules(() => {
    tokenUtils = require('../utils/tokenUtils');
    const { authenticate } = require('../middleware/auth');
    const authController = require('../controllers/authController');
    app = express();
    app.use(cookieParser());
    app.get('/api/protected', authenticate, (req, res) => res.json({ userId: req.userId, sid: req.sessionId }));
    app.post('/api/auth/refresh-token', authController.refreshToken);
    app.post('/api/auth/logout', authController.logout);
  });
}

/** A session with freshly issued tokens, as createSession would leave it. */
function login(userId = 'u1', sid = `s-${userId}`) {
  const s = addSession(sid, userId);
  const tokens = tokenUtils.generateTokens(userId, sid);
  s.refreshToken = tokens.refreshToken;
  return tokens;
}

/** Hand-made token: claims + lifetime + secret, for legacy / tampered / expired cases. */
function mint({ claims = {}, secret = SECRET, iat = Math.floor(Date.now() / 1000), ttl = 3600, alg = 'HS256' } = {}) {
  return jwt.sign({ id: 'u1', sid: 's-u1', iat, exp: iat + ttl, ...claims }, secret, { algorithm: alg });
}
const ACCESS_CLAIMS = { typ: 'access', aud: 'jobblo:access', iss: 'jobblo-api' };
const REFRESH_CLAIMS = { typ: 'refresh', aud: 'jobblo:refresh', iss: 'jobblo-api' };

const bearer = (t) => request(app).get('/api/protected').set('Authorization', `Bearer ${t}`);
const cookieAuth = (t) => request(app).get('/api/protected').set('Cookie', `accessToken=${t}`);
const refresh = (t) => request(app).post('/api/auth/refresh-token').set('Cookie', `refreshToken=${t}`);

function setup(env) {
  process.env = { ...OLD_ENV, JWT_SECRET: SECRET, ...env };
  if (!('JWT_REFRESH_SECRET' in env)) delete process.env.JWT_REFRESH_SECRET;
  sessions = new Map();
  users = new Map([
    ['u1', { _id: 'u1', accountStatus: 'active', email: 'a@x.test' }],
    ['u2', { _id: 'u2', accountStatus: 'active', email: 'b@x.test' }],
  ]);
  installMocks();
  buildApp();
}

afterAll(() => {
  process.env = OLD_ENV;
});

// Today's production shape (no JWT_REFRESH_SECRET) and the target shape (separate secret).
describe.each([
  ['shared secret (JWT_REFRESH_SECRET unset, current production)', {}],
  ['separate JWT_REFRESH_SECRET', { JWT_REFRESH_SECRET: REFRESH_SECRET }],
])('%s', (_label, env) => {
  beforeEach(() => setup(env));

  it('issues tokens with explicit purpose, audience and issuer (password/Google/Vipps login all use this)', () => {
    const { accessToken, refreshToken } = login();
    expect(jwt.decode(accessToken)).toMatchObject({ ...ACCESS_CLAIMS, id: 'u1', sid: 's-u1' });
    expect(jwt.decode(refreshToken)).toMatchObject({ ...REFRESH_CLAIMS, id: 'u1', sid: 's-u1' });
    expect(jwt.decode(accessToken, { complete: true }).header.alg).toBe('HS256');
  });

  it('1/16. a valid access token reaches protected routes (cookie and Bearer, web and mobile)', async () => {
    const { accessToken } = login();
    for (const res of [await bearer(accessToken), await cookieAuth(accessToken)]) {
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ userId: 'u1', sid: 's-u1' });
    }
  });

  it('2. a refresh token as Bearer is rejected', async () => {
    const { refreshToken } = login();
    expect((await bearer(refreshToken)).status).toBe(401);
  });

  it('3. a refresh token in the accessToken cookie is rejected', async () => {
    const { refreshToken } = login();
    expect((await cookieAuth(refreshToken)).status).toBe(401);
  });

  it('4. an access token cannot refresh a session — not even if it were stored as the session token', async () => {
    const { accessToken } = login();
    expect((await refresh(accessToken)).status).toBe(401);
    sessions.get('s-u1').refreshToken = accessToken; // worst case: a DB match
    expect((await refresh(accessToken)).status).toBe(401);
    expect(() => tokenUtils.verifyToken(accessToken, 'refresh')).toThrow(/not a valid refresh token/);
  });

  it('5/6. a valid refresh cookie rotates the session and returns a working access token', async () => {
    const { refreshToken } = login();
    const res = await refresh(refreshToken);
    expect(res.status).toBe(200);
    expect(jwt.decode(res.body.accessToken)).toMatchObject(ACCESS_CLAIMS);
    expect((await bearer(res.body.accessToken)).status).toBe(200);
    const s = sessions.get('s-u1');
    expect(s.oldRefreshToken).toBe(refreshToken);
    expect(s.refreshToken).not.toBe(refreshToken);
  });

  it('6b. an expired access token answers TOKEN_EXPIRED so the client refreshes', async () => {
    login();
    const expired = mint({ claims: ACCESS_CLAIMS, iat: Math.floor(Date.now() / 1000) - 7200 });
    const res = await bearer(expired);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('7. an expired refresh token is rejected and its session dropped', async () => {
    const s = addSession('s-u1', 'u1');
    const secret = env.JWT_REFRESH_SECRET || SECRET;
    s.refreshToken = mint({ claims: REFRESH_CLAIMS, secret, iat: Math.floor(Date.now() / 1000) - 8 * 86400, ttl: 7 * 86400 });
    expect((await refresh(s.refreshToken)).status).toBe(401);
    expect(sessions.has('s-u1')).toBe(false);
  });

  it('8/12. logout revokes the session for both tokens', async () => {
    const { accessToken, refreshToken } = login();
    const out = await request(app).post('/api/auth/logout').set('Cookie', `refreshToken=${refreshToken}`);
    expect(out.status).toBe(200);
    expect((await bearer(accessToken)).status).toBe(401);
    expect((await refresh(refreshToken)).status).toBe(401);
  });

  it('9. a token signed with any other secret is rejected', async () => {
    login();
    expect((await bearer(mint({ claims: ACCESS_CLAIMS, secret: 'attacker-secret' }))).status).toBe(401);
  });

  it.each([
    ['typ refresh with access audience', { ...ACCESS_CLAIMS, typ: 'refresh' }],
    ['access typ with refresh audience', { ...ACCESS_CLAIMS, aud: 'jobblo:refresh' }],
    ['foreign issuer', { ...ACCESS_CLAIMS, iss: 'someone-else' }],
    ['unknown typ', { ...ACCESS_CLAIMS, typ: 'admin' }],
    ['typ without aud/iss', { typ: 'access' }],
  ])('10. wrong purpose claims are rejected: %s', async (_l, claims) => {
    login();
    expect((await bearer(mint({ claims }))).status).toBe(401);
  });

  it('10b. algorithm confusion: alg none and other HMAC algorithms are rejected', async () => {
    login();
    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ id: 'u1', sid: 's-u1', ...ACCESS_CLAIMS, exp: Math.floor(Date.now() / 1000) + 600 })
    ).toString('base64url')}.`;
    expect((await bearer(unsigned)).status).toBe(401);
    expect((await bearer(mint({ claims: ACCESS_CLAIMS, alg: 'HS512' }))).status).toBe(401);
  });

  it('refresh token of one session cannot be replayed into another session (substitution)', async () => {
    login('u1', 's-u1');
    const other = addSession('s-u2', 'u2');
    other.refreshToken = tokenUtils.generateTokens('u1', 's-u1').refreshToken; // planted row
    expect((await refresh(other.refreshToken)).status).toBe(401);
  });

  it('18. concurrent refreshes of one session both succeed for the same user (grace period)', async () => {
    const { refreshToken } = login();
    const [a, b] = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    for (const r of [a, b]) {
      expect((await bearer(r.body.accessToken)).body).toEqual({ userId: 'u1', sid: 's-u1' });
    }
  });

  it('deactivated accounts cannot refresh', async () => {
    const { refreshToken } = login();
    users.get('u1').accountStatus = 'deactivated';
    expect((await refresh(refreshToken)).status).toBe(403);
  });
});

describe('11. tokens issued before purpose claims existed (migration policy)', () => {
  beforeEach(() => setup({}));
  const now = () => Math.floor(Date.now() / 1000);

  it('a legacy access token (1h, no claims) keeps working — no forced re-login on deploy', async () => {
    addSession('s-u1', 'u1');
    expect((await bearer(mint({ ttl: 3600 }))).status).toBe(200);
  });

  it('a legacy refresh token (7d, no claims) is NOT accepted as an access token', async () => {
    addSession('s-u1', 'u1');
    expect((await bearer(mint({ ttl: 7 * 86400 }))).status).toBe(401);
    expect((await cookieAuth(mint({ ttl: 7 * 86400 }))).status).toBe(401);
  });

  it('a legacy refresh token still refreshes its session and is upgraded to purpose-bound tokens', async () => {
    const s = addSession('s-u1', 'u1');
    s.refreshToken = mint({ ttl: 7 * 86400, iat: now() - 86400 });
    const res = await refresh(s.refreshToken);
    expect(res.status).toBe(200);
    expect(jwt.decode(res.body.accessToken)).toMatchObject(ACCESS_CLAIMS);
    expect(jwt.decode(s.refreshToken)).toMatchObject(REFRESH_CLAIMS);
  });

  it('a legacy access token cannot refresh', async () => {
    const s = addSession('s-u1', 'u1');
    s.refreshToken = mint({ ttl: 3600 });
    expect((await refresh(s.refreshToken)).status).toBe(401);
  });

  it('a claim-less token with any other lifetime is rejected', async () => {
    addSession('s-u1', 'u1');
    for (const ttl of [3599, 3601, 86400, 30 * 86400]) expect((await bearer(mint({ ttl }))).status).toBe(401);
  });

  it('a legacy refresh token signed with JWT_SECRET still refreshes after JWT_REFRESH_SECRET is introduced', async () => {
    setup({ JWT_REFRESH_SECRET: REFRESH_SECRET });
    const s = addSession('s-u1', 'u1');
    s.refreshToken = mint({ ttl: 7 * 86400, secret: SECRET });
    expect((await refresh(s.refreshToken)).status).toBe(200);
  });
});

describe('Socket.IO handshake', () => {
  it('opens for an access token and refuses a refresh token', async () => {
    setup({});
    const { accessToken, refreshToken } = login();
    Session.findById.mockImplementation(async (id) => sessions.get(String(id)) || null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
    let handshake;
    require('../sockets/chat.socket')({ use: (fn) => (handshake = fn), on: () => {}, emit: () => {} });
    const connect = (cookieHeader) =>
      new Promise((resolve) => {
        const socket = { handshake: { headers: { cookie: cookieHeader }, auth: {} } };
        handshake(socket, (err) => resolve({ err, userId: socket.userId }));
      });

    expect(await connect(`accessToken=${accessToken}`)).toEqual({ err: undefined, userId: 'u1' });
    expect((await connect(`accessToken=${refreshToken}`)).err).toBeInstanceOf(Error);
  });
});

describe('missing secrets fail closed', () => {
  it('no JWT_SECRET: nothing verifies and nothing is issued', async () => {
    setup({});
    const { accessToken } = login();
    delete process.env.JWT_SECRET;
    expect((await bearer(accessToken)).status).toBe(401);
    expect(() => tokenUtils.generateTokens('u1', 's1')).toThrow(/not configured/);
  });
});
