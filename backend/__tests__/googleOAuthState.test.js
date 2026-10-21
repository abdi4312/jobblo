/**
 * Regression guard for Google OAuth login / account-linking CSRF.
 *
 * The Google strategy had no `state`, and the link target sat in the session on its own.
 * An attacker could make a victim's browser hit `/google?link=1` and then
 * `/google/callback?code=<attacker's code>`: the attacker's Google identity was linked to
 * the victim's account. Without `?link=1` the same trick logged the victim into the
 * attacker's account.
 *
 * These tests drive the real strategy, routes and express-session through supertest
 * agents (one agent = one browser). Only Google's token exchange / profile, the User
 * model and Jobblo's authentication are mocked.
 */

Object.assign(process.env, {
  NODE_ENV: 'test',
  FRONTEND_URL: 'https://jobblo.example',
  SESSION_SECRET: 'test-session-secret',
  JWT_SECRET: 'test-jwt-secret',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_WEB_CALLBACK_URL: 'https://jobblo.no/api/auth/web/google/callback',
});

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('../models/User', () => ({ findOne: jest.fn(), findById: jest.fn(), create: jest.fn() }));
jest.mock('../utils/tokenUtils', () => ({
  createSession: jest.fn(async (_req, userId) => ({
    accessToken: `at-${userId}`,
    refreshToken: 'rt',
  })),
}));
// Stand-in for the real cookie/JWT check: the test says who the browser is signed in as.
jest.mock('../middleware/auth', () => ({
  optionalAuthenticate: (req, _res, next) => {
    if (req.headers['x-test-user']) {
      req.userId = req.headers['x-test-user'];
      req.sessionId = req.headers['x-test-sid'];
    }
    next();
  },
  authenticate: (_req, _res, next) => next(),
  requireAdmin: (_req, _res, next) => next(),
}));

const express = require('express');
const session = require('express-session');
const request = require('supertest');
const User = require('../models/User');
const passport = require('../config/passport');
const webOAuth = require('../routes/webOAuth');

// ── Fake Google: the authorization code is the key into this table ──────────────
const googleProfiles = {
  'code-victim-google': { id: 'g-victim', emails: [{ value: 'victim@gmail.test', verified: true }] },
  'code-attacker': { id: 'g-attacker', emails: [{ value: 'attacker@gmail.test', verified: true }] },
  'code-returning': { id: 'g-returning', emails: [{ value: 'ret@gmail.test', verified: true }] },
  'code-brand-new': { id: 'g-new', emails: [{ value: 'new@gmail.test', verified: true }], displayName: 'New' },
};
const strategy = passport._strategies['google-web'];
strategy._oauth2.getOAuthAccessToken = (code, _params, cb) => {
  if (!googleProfiles[code]) return cb({ statusCode: 400, data: 'invalid_grant' });
  return cb(null, code, 'google-refresh', {});
};
strategy.userProfile = (accessToken, done) => done(null, googleProfiles[accessToken]);

// ── In-memory users ─────────────────────────────────────────────────────────────
let users;
function addUser(id, oauthProviders = []) {
  const user = { _id: id, email: `${id}@jobblo.test`, oauthProviders: [...oauthProviders] };
  user.save = jest.fn(async () => user);
  users.set(id, user);
  return user;
}
/** A mongoose-ish query: awaitable, and `.select()` returns itself. */
function query(value) {
  const q = {
    select: () => q,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  users = new Map();
  User.findById.mockImplementation((id) => query(users.get(String(id)) || null));
  User.findOne.mockImplementation((filter) => {
    const match = filter.oauthProviders?.$elemMatch;
    const found = [...users.values()].find((u) =>
      match
        ? u.oauthProviders.some((p) => p.provider === match.provider && p.providerId === match.providerId)
        : u.email === filter.email
    );
    return query(found || null);
  });
  User.create.mockImplementation(async (doc) => ({ _id: 'created', ...doc }));
});

const app = express();
app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use('/api/auth/web', webOAuth);

function as(agent, user) {
  return (req) => (user ? req.set('x-test-user', user.id).set('x-test-sid', user.sid) : req);
}

/** Start a Google flow in this browser; returns the state Google would echo back. */
async function start(agent, { link = false, user } = {}) {
  const res = await as(agent, user)(agent.get(`/api/auth/web/google${link ? '?link=1' : ''}`));
  expect(res.status).toBe(302);
  const location = new URL(res.headers.location);
  expect(location.hostname).toBe('accounts.google.com');
  return location.searchParams.get('state');
}

async function callback(agent, { code, state, user } = {}) {
  const qs = new URLSearchParams({ code });
  if (state !== undefined) qs.set('state', state);
  const res = await as(agent, user)(agent.get(`/api/auth/web/google/callback?${qs}`));
  expect(res.status).toBe(302);
  const location = res.headers.location;
  // The URL never carries the token; who got signed in is read from the httpOnly cookie.
  expect(location).not.toMatch(/token=/);
  const access = (res.headers['set-cookie'] || []).find((c) => c.startsWith('accessToken='));
  if (location === 'https://jobblo.example/oauth-success') {
    expect(access).toMatch(/HttpOnly/i);
    return `logged-in:${access.match(/^accessToken=at-([^;]+)/)[1]}`;
  }
  expect(access).toBeUndefined();
  return location;
}

const VICTIM = { id: 'victim', sid: 'victim-sid' };
const OTHER = { id: 'other', sid: 'other-sid' };
const LOGGED_IN = (who) => `logged-in:${who}`;
const INVALID_STATE = 'https://jobblo.example/login?error=google_invalid_state';

describe('Google OAuth state', () => {
  it('issues an unpredictable 256-bit state per authorization request', async () => {
    const browser = request.agent(app);
    const a = await start(browser);
    const b = await start(browser);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).not.toBe(a);
  });

  it('1. logs a returning Google user in', async () => {
    addUser('returning', [{ provider: 'google', providerId: 'g-returning' }]);
    const browser = request.agent(app);
    const state = await start(browser);
    expect(await callback(browser, { code: 'code-returning', state })).toBe(LOGGED_IN('returning'));
  });

  it('1b. still registers a brand-new Google user', async () => {
    const browser = request.agent(app);
    const state = await start(browser);
    expect(await callback(browser, { code: 'code-brand-new', state })).toBe(LOGGED_IN('created'));
    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@gmail.test', oauthProviders: [{ provider: 'google', providerId: 'g-new' }] })
    );
  });

  it('2. links Google to the signed-in account that asked for it', async () => {
    const victim = addUser('victim');
    const browser = request.agent(app);
    const state = await start(browser, { link: true, user: VICTIM });
    expect(await callback(browser, { code: 'code-victim-google', state, user: VICTIM })).toBe(
      LOGGED_IN('victim')
    );
    expect(victim.oauthProviders).toEqual([{ provider: 'google', providerId: 'g-victim' }]);
  });

  it('3. rejects a callback with no state', async () => {
    const browser = request.agent(app);
    await start(browser);
    expect(await callback(browser, { code: 'code-returning' })).toBe(INVALID_STATE);
  });

  it('3b. rejects a callback when no flow was ever started in this browser', async () => {
    expect(await callback(request.agent(app), { code: 'code-returning', state: 'x' })).toBe(INVALID_STATE);
  });

  it('4. rejects a wrong state', async () => {
    const browser = request.agent(app);
    const state = await start(browser);
    const wrong = state.slice(0, -1) + (state.endsWith('0') ? '1' : '0');
    expect(await callback(browser, { code: 'code-returning', state: wrong })).toBe(INVALID_STATE);
  });

  it('5. rejects a replayed state', async () => {
    addUser('returning', [{ provider: 'google', providerId: 'g-returning' }]);
    const browser = request.agent(app);
    const state = await start(browser);
    expect(await callback(browser, { code: 'code-returning', state })).toBe(LOGGED_IN('returning'));
    expect(await callback(browser, { code: 'code-returning', state })).toBe(INVALID_STATE);
  });

  it("6/7. the attacker's code + state cannot be completed in the victim's browser", async () => {
    const victim = addUser('victim');
    // Attacker starts a flow in their own browser and keeps the code + state Google returns.
    const attackerBrowser = request.agent(app);
    const attackerState = await start(attackerBrowser);
    // The victim is forced through ?link=1 and then onto the attacker's callback URL.
    const victimBrowser = request.agent(app);
    await start(victimBrowser, { link: true, user: VICTIM });
    expect(
      await callback(victimBrowser, { code: 'code-attacker', state: attackerState, user: VICTIM })
    ).toBe(INVALID_STATE);
    expect(victim.oauthProviders).toEqual([]);
    expect(victim.save).not.toHaveBeenCalled();
  });

  it('6b. login CSRF: an attacker code without the victim browser’s state does not log the victim in', async () => {
    addUser('attacker', [{ provider: 'google', providerId: 'g-attacker' }]);
    const attackerState = await start(request.agent(app));
    const victimBrowser = request.agent(app);
    expect(await callback(victimBrowser, { code: 'code-attacker', state: attackerState })).toBe(
      INVALID_STATE
    );
  });

  it('7b. an identity already on another account is refused while linking, not logged in as', async () => {
    const victim = addUser('victim');
    addUser('attacker', [{ provider: 'google', providerId: 'g-attacker' }]);
    const browser = request.agent(app);
    const state = await start(browser, { link: true, user: VICTIM });
    expect(await callback(browser, { code: 'code-attacker', state, user: VICTIM })).toBe(
      'https://jobblo.example/login?error=google_already_linked'
    );
    expect(victim.save).not.toHaveBeenCalled();
  });

  it('8. linking completes only for the user and session that started it', async () => {
    const victim = addUser('victim');
    addUser('other');
    for (const who of [OTHER, { id: 'victim', sid: 'a-different-session' }, undefined]) {
      const browser = request.agent(app);
      const state = await start(browser, { link: true, user: VICTIM });
      expect(await callback(browser, { code: 'code-victim-google', state, user: who })).toBe(INVALID_STATE);
    }
    expect(victim.oauthProviders).toEqual([]);
  });

  it('9. an existing Google link is not replaced or joined by a second one', async () => {
    const victim = addUser('victim', [{ provider: 'google', providerId: 'g-original' }]);
    const browser = request.agent(app);
    const state = await start(browser, { link: true, user: VICTIM });
    expect(await callback(browser, { code: 'code-victim-google', state, user: VICTIM })).toBe(
      'https://jobblo.example/login?error=google_already_linked'
    );
    expect(victim.oauthProviders).toEqual([{ provider: 'google', providerId: 'g-original' }]);
  });

  it('10. an expired attempt fails safely', async () => {
    const victim = addUser('victim');
    const browser = request.agent(app);
    const state = await start(browser, { link: true, user: VICTIM });
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now + 11 * 60 * 1000);
    try {
      expect(await callback(browser, { code: 'code-victim-google', state, user: VICTIM })).toBe(INVALID_STATE);
    } finally {
      spy.mockRestore();
    }
    expect(victim.oauthProviders).toEqual([]);
  });

  it('10b. an interrupted link attempt does not survive into a later plain login', async () => {
    const victim = addUser('victim');
    const browser = request.agent(app);
    await start(browser, { link: true, user: VICTIM }); // abandoned at Google
    const state = await start(browser, { user: VICTIM }); // plain "Sign in with Google"
    expect(await callback(browser, { code: 'code-brand-new', state, user: VICTIM })).toBe(LOGGED_IN('created'));
    expect(victim.oauthProviders).toEqual([]);
  });

  it('11. a failed Google exchange leaves the account untouched', async () => {
    const victim = addUser('victim', [{ provider: 'vipps', providerId: 'v-1' }]);
    const browser = request.agent(app);
    const state = await start(browser, { link: true, user: VICTIM });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(await callback(browser, { code: 'code-unknown', state, user: VICTIM })).toBe(
      'https://jobblo.example/login?error=google_failed'
    );
    expect(victim.oauthProviders).toEqual([{ provider: 'vipps', providerId: 'v-1' }]);
    expect(victim.save).not.toHaveBeenCalled();
  });

  it('12. plain login by a signed-in user never links, and ?link=1 without a session never links', async () => {
    const victim = addUser('victim');
    let browser = request.agent(app);
    let state = await start(browser, { user: VICTIM });
    await callback(browser, { code: 'code-brand-new', state, user: VICTIM });

    browser = request.agent(app);
    state = await start(browser, { link: true }); // not signed in
    expect(await callback(browser, { code: 'code-brand-new', state })).toBe(LOGGED_IN('created'));

    expect(victim.oauthProviders).toEqual([]);
    expect(victim.save).not.toHaveBeenCalled();
  });

  it('ignores a client-supplied link target', async () => {
    const victim = addUser('victim');
    const browser = request.agent(app);
    const res = await browser.get('/api/auth/web/google?link=1&userId=victim&linkToUserId=victim');
    const state = new URL(res.headers.location).searchParams.get('state');
    await callback(browser, { code: 'code-brand-new', state });
    expect(victim.oauthProviders).toEqual([]);
  });
});
