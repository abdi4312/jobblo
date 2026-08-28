const fs = require('fs');
const path = require('path');
const { stripComments } = require('../test-utils/stripComments');

/**
 * OAuth mechanics for the Vipps callback: state, replay, and the link intent.
 *
 * The state check used to be wrapped in `if (process.env.NODE_ENV === 'production')`,
 * so CSRF protection was absent from every environment where it could realistically
 * have been noticed, and the production path was the one nobody exercised until it
 * mattered. The state was also deleted only on the success path, leaving a usable
 * value behind after every failure.
 */

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('../models/User', () => ({ findOne: jest.fn(), findById: jest.fn(), create: jest.fn() }));
jest.mock('../utils/tokenUtils', () => ({
  createSession: jest.fn(async () => ({ accessToken: 'at', refreshToken: 'rt' })),
}));
jest.mock('../utils/subscription', () => ({ ensureDefaultSubscription: jest.fn(async () => ({})) }));

const axios = require('axios');
const User = require('../models/User');
const vippsController = require('../controllers/vippsController');

function makeRes() {
  return {
    redirectedTo: null,
    cookies: {},
    headers: {},
    redirect(url) {
      this.redirectedTo = url;
      return this;
    },
    cookie(name, value) {
      this.cookies[name] = value;
      return this;
    },
    set(headers) {
      Object.assign(this.headers, headers);
      return this;
    },
    status() {
      return this;
    },
    json() {
      return this;
    },
  };
}

/**
 * `save` calls back on a later tick, like a real async session store does — the start
 * endpoint awaits it before sending the browser to Vipps, so a stub that resolved
 * synchronously would hide the ordering the production race fix depends on.
 */
function makeReq({ query = {}, session = {}, userId } = {}) {
  if (session && typeof session.save !== 'function') {
    session.save = (cb) => setImmediate(() => cb(null));
  }
  return { query, session, userId };
}

const OLD_ENV = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...OLD_ENV,
    NODE_ENV: 'test',
    FRONTEND_URL: 'https://jobblo.example/',
    VIPPS_CLIENT_ID: 'cid',
    VIPPS_CLIENT_SECRET: 'secret',
    VIPPS_REDIRECT_URI: 'https://api.example/api/auth/vipps/callback',
    VIPPS_BASE_URL: 'https://apitest.vipps.no',
    // Signs the platform token that rides in `state` for a mobile flow. A fixed fake so
    // the assertions below are deterministic whatever the shell environment holds.
    SESSION_SECRET: 'test-platform-state-secret',
    MOBILE_RETURN_URL: 'https://api.example',
    MOBILE_APP_LINK_PREFIX: 'jobblo://',
  };
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe('starting the flow', () => {
  it('binds a fresh random state to the session', async () => {
    const req = makeReq();
    const res = makeRes();

    await vippsController.redirectToVipps(req, res);

    expect(req.session.vippsAuth.state).toMatch(/^[0-9a-f]{64}$/);
    expect(res.redirectedTo).toContain(`state=${req.session.vippsAuth.state}`);
  });

  it('generates a different state every time', async () => {
    const a = makeReq();
    const b = makeReq();
    await vippsController.redirectToVipps(a, makeRes());
    await vippsController.redirectToVipps(b, makeRes());

    expect(a.session.vippsAuth.state).not.toBe(b.session.vippsAuth.state);
  });

  it('refuses to start when there is no session to bind the state to', async () => {
    const req = { query: {}, session: null };
    const res = makeRes();

    await vippsController.redirectToVipps(req, res);

    expect(res.redirectedTo).toBe('https://jobblo.example/login?error=vipps_failed');
    expect(res.redirectedTo).not.toContain('vipps.no');
  });

  it('records the link intent only for an authenticated caller', async () => {
    const signedIn = makeReq({ query: { link: '1' }, userId: 'user_1' });
    await vippsController.redirectToVipps(signedIn, makeRes());
    expect(signedIn.session.vippsAuth.linkUserId).toBe('user_1');

    const anonymous = makeReq({ query: { link: '1' } });
    await vippsController.redirectToVipps(anonymous, makeRes());
    expect(anonymous.session.vippsAuth.linkUserId).toBeNull();
  });

  it('does not treat a plain sign-in as a link request', async () => {
    const req = makeReq({ userId: 'user_1' });
    await vippsController.redirectToVipps(req, makeRes());
    expect(req.session.vippsAuth.linkUserId).toBeNull();
  });

  /**
   * The start endpoint mints the state and records where this flow ends up, so a browser
   * answering the request from its own cache means neither happens — which is one of the two
   * ways a second sign-in from the same browser ended up back on the website.
   */
  it('forbids caching the authorization redirect', async () => {
    const res = makeRes();
    await vippsController.redirectToVipps(makeReq(), res);
    expect(res.headers['Cache-Control']).toContain('no-store');
  });
});

describe('state validation on the callback', () => {
  it('rejects a mismatched state in a non-production environment', async () => {
    const req = makeReq({
      query: { code: 'c', state: 'attacker-supplied' },
      session: { vippsAuth: { state: 'the-real-one', createdAt: Date.now() } },
    });
    const res = makeRes();

    await vippsController.vippsCallback(req, res);

    expect(res.redirectedTo).toBe('https://jobblo.example/login?error=vipps_invalid_state');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('rejects a callback with no state in the session at all', async () => {
    const req = makeReq({ query: { code: 'c', state: 'anything' }, session: {} });
    const res = makeRes();

    await vippsController.vippsCallback(req, res);

    expect(res.redirectedTo).toContain('error=vipps_invalid_state');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('rejects an expired state', async () => {
    const req = makeReq({
      query: { code: 'c', state: 'abc' },
      session: { vippsAuth: { state: 'abc', createdAt: Date.now() - 11 * 60 * 1000 } },
    });
    const res = makeRes();

    await vippsController.vippsCallback(req, res);

    expect(res.redirectedTo).toContain('error=vipps_invalid_state');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('clears the state even when the callback fails, so it cannot be replayed', async () => {
    const session = { vippsAuth: { state: 'abc', createdAt: Date.now() } };
    const req = makeReq({ query: { code: 'c', state: 'wrong' }, session });

    await vippsController.vippsCallback(req, makeRes());

    expect(session.vippsAuth).toBeUndefined();
  });

  it('clears the state when the user cancels at Vipps', async () => {
    const session = { vippsAuth: { state: 'abc', createdAt: Date.now() } };
    const req = makeReq({ query: { error: 'access_denied' }, session });

    await vippsController.vippsCallback(req, makeRes());

    expect(session.vippsAuth).toBeUndefined();
  });
});

describe('the identity decision reaches the user as a distinguishable outcome', () => {
  function primeVipps(profile) {
    axios.post.mockResolvedValue({ data: { access_token: 'vipps-at' } });
    axios.get.mockResolvedValue({ data: profile });
  }

  function validReq(session = {}) {
    return makeReq({
      query: { code: 'c', state: 'abc' },
      session: { vippsAuth: { state: 'abc', createdAt: Date.now(), ...session } },
    });
  }

  it('a userinfo response with no sub is refused, not resolved to some user', async () => {
    primeVipps({ email: 'someone@example.com' }); // no `sub`
    User.findOne.mockImplementation(() =>
      Object.assign(Promise.resolve(null), { select: () => Promise.resolve(null) })
    );
    const res = makeRes();

    await vippsController.vippsCallback(validReq(), res);

    expect(res.redirectedTo).toBe('https://jobblo.example/login?error=vipps_identity');
    expect(User.create).not.toHaveBeenCalled();
  });

  it('an e-mail that already belongs to an account stops the flow', async () => {
    primeVipps({ sub: 'new-sub', email: 'victim@example.com', email_verified: true });

    User.findOne.mockImplementation((query) => {
      // No provider match; the e-mail lookup finds the victim.
      const result = query.email ? { _id: 'victim' } : null;
      return Object.assign(Promise.resolve(result), { select: () => Promise.resolve(result) });
    });

    const res = makeRes();
    await vippsController.vippsCallback(validReq(), res);

    expect(res.redirectedTo).toBe('https://jobblo.example/login?error=vipps_account_exists');
    expect(User.create).not.toHaveBeenCalled();
    expect(res.cookies.accessToken).toBeUndefined();
  });

  it('a missing token response does not fall through to a login', async () => {
    axios.post.mockResolvedValue({ data: {} });
    const res = makeRes();

    await vippsController.vippsCallback(validReq(), res);

    expect(res.redirectedTo).toContain('error=vipps_failed');
    expect(res.cookies.accessToken).toBeUndefined();
  });
});

describe('where a mobile flow comes back to', () => {
  /** `<CSRF state>-m.<issued>.<nonce>.<hmac>`, hex throughout so nothing needs escaping. */
  const COMPOSITE = /^[0-9a-f]{64}-m\.\d{10,15}\.[a-f0-9]{18}\.[a-f0-9]{64}$/;

  /** A returning user whose Vipps identity is already linked — the ordinary sign-in path. */
  function primeReturningUser() {
    axios.post.mockResolvedValue({ data: { access_token: 'vipps-at' } });
    axios.get.mockResolvedValue({ data: { sub: 'vipps-sub', email: 'a@example.com' } });
    User.findOne.mockImplementation((query) => {
      const result = query.oauthProviders ? { _id: 'u1' } : null;
      return Object.assign(Promise.resolve(result), { select: () => Promise.resolve(result) });
    });
  }

  async function callbackWith({ state, session }) {
    const res = makeRes();
    await vippsController.vippsCallback(makeReq({ query: { code: 'c', state }, session }), res);
    return res;
  }

  it('appends a signed platform token to the state', async () => {
    const req = makeReq({ query: { platform: 'mobile' } });
    const res = makeRes();

    await vippsController.redirectToVipps(req, res);

    expect(req.session.vippsAuth.state).toMatch(COMPOSITE);
    // Stored and sent byte-for-byte the same, so what Vipps echoes back is what the
    // constant-time comparison is given. A separator either half could contain, or one
    // `URLSearchParams` percent-encodes, would break that.
    expect(res.redirectedTo).toContain(`state=${req.session.vippsAuth.state}`);
  });

  it('mints nothing at all for a web flow', async () => {
    const req = makeReq();
    await vippsController.redirectToVipps(req, makeRes());
    expect(req.session.vippsAuth.state).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reaches the app when the session recorded the intent', async () => {
    primeReturningUser();
    const res = await callbackWith({
      state: 'abc',
      session: { vippsAuth: { state: 'abc', createdAt: Date.now() }, oauthPlatform: 'mobile' },
    });
    expect(res.redirectedTo).toBe(
      'https://api.example/api/auth/mobile-return?state=success&token=at'
    );
  });

  /**
   * The reported symptom: the first sign-in worked, and after a sign-out the second one
   * came back on the website. Nothing in the session said `mobile` any more, so the
   * callback took the web branch and the Custom Tab was left on a `localhost:5173` that
   * only exists on the developer's machine. The state is the second carrier.
   */
  it('reaches the app on the signed state alone, with no platform in the session', async () => {
    const start = makeReq({ query: { platform: 'mobile' } });
    await vippsController.redirectToVipps(start, makeRes());
    const state = start.session.vippsAuth.state;

    primeReturningUser();
    const res = await callbackWith({
      state,
      session: { vippsAuth: { state, createdAt: Date.now() } },
    });

    expect(res.redirectedTo).toBe(
      'https://api.example/api/auth/mobile-return?state=success&token=at'
    );
  });

  it('an error also reaches the app on the signed state alone', async () => {
    const start = makeReq({ query: { platform: 'mobile' } });
    await vippsController.redirectToVipps(start, makeRes());
    const state = start.session.vippsAuth.state;

    axios.post.mockResolvedValue({ data: {} }); // no access_token
    const res = await callbackWith({
      state,
      session: { vippsAuth: { state, createdAt: Date.now() } },
    });

    expect(res.redirectedTo).toBe(
      'https://api.example/api/auth/mobile-return?state=error&code=vipps_failed'
    );
  });

  it('a token this server did not sign is not mobile', async () => {
    const base = 'a'.repeat(64);
    const forged = `${base}-m.${Date.now()}.${'b'.repeat(18)}.${'c'.repeat(64)}`;

    primeReturningUser();
    const res = await callbackWith({
      state: forged,
      session: { vippsAuth: { state: forged, createdAt: Date.now() } },
    });

    // Web, exactly as before the bridge existed — a forged token cannot redirect a flow,
    // and the worst it could ever point at is this server's own hand-off page anyway.
    expect(res.redirectedTo).toBe('https://jobblo.example/oauth-success?token=at');
  });

  it('a stale token is not mobile', async () => {
    /**
     * Correctly signed, but issued sixteen minutes ago — past the 15-minute window. The
     * clock is only moved for the start call, so the CSRF state's own `createdAt` below is
     * fresh and this exercises the token's age rather than Vipps' separate state expiry.
     */
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() - 16 * 60 * 1000);
    const start = makeReq({ query: { platform: 'mobile' } });
    await vippsController.redirectToVipps(start, makeRes());
    clock.mockRestore();

    const state = start.session.vippsAuth.state;
    expect(state).toMatch(COMPOSITE);

    primeReturningUser();
    const res = await callbackWith({
      state,
      session: { vippsAuth: { state, createdAt: Date.now() } },
    });

    expect(res.redirectedTo).toBe('https://jobblo.example/oauth-success?token=at');
  });
});

describe('the source no longer carries the old shortcuts', () => {
  const source = stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'controllers', 'vippsController.js'), 'utf8')
  );

  it('state is not gated on NODE_ENV', () => {
    expect(source).not.toMatch(/NODE_ENV\s*===\s*'production'[\s\S]{0,120}vippsState/);
    expect(source).not.toMatch(/vippsState/);
  });

  it('compares the state in constant time', () => {
    expect(source).toMatch(/timingSafeEqual/);
  });

  it('reads the link target from the session, never from the query string', () => {
    expect(source).toMatch(/linkToUserId:\s*pending\.linkUserId/);
    expect(source).not.toMatch(/linkToUserId:\s*req\.query/);
  });

  it('no longer links an account by bare e-mail match', () => {
    expect(source).not.toMatch(/existingEmailUser/);
    expect(source).not.toMatch(/oauthProviders\.push/);
  });
});
