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
    redirect(url) {
      this.redirectedTo = url;
      return this;
    },
    cookie(name, value) {
      this.cookies[name] = value;
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

function makeReq({ query = {}, session = {}, userId } = {}) {
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
  };
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe('starting the flow', () => {
  it('binds a fresh random state to the session', () => {
    const req = makeReq();
    const res = makeRes();

    vippsController.redirectToVipps(req, res);

    expect(req.session.vippsAuth.state).toMatch(/^[0-9a-f]{64}$/);
    expect(res.redirectedTo).toContain(`state=${req.session.vippsAuth.state}`);
  });

  it('generates a different state every time', () => {
    const a = makeReq();
    const b = makeReq();
    vippsController.redirectToVipps(a, makeRes());
    vippsController.redirectToVipps(b, makeRes());

    expect(a.session.vippsAuth.state).not.toBe(b.session.vippsAuth.state);
  });

  it('refuses to start when there is no session to bind the state to', () => {
    const req = { query: {}, session: null };
    const res = makeRes();

    vippsController.redirectToVipps(req, res);

    expect(res.redirectedTo).toBe('https://jobblo.example/login?error=vipps_failed');
    expect(res.redirectedTo).not.toContain('vipps.no');
  });

  it('records the link intent only for an authenticated caller', () => {
    const signedIn = makeReq({ query: { link: '1' }, userId: 'user_1' });
    vippsController.redirectToVipps(signedIn, makeRes());
    expect(signedIn.session.vippsAuth.linkUserId).toBe('user_1');

    const anonymous = makeReq({ query: { link: '1' } });
    vippsController.redirectToVipps(anonymous, makeRes());
    expect(anonymous.session.vippsAuth.linkUserId).toBeNull();
  });

  it('does not treat a plain sign-in as a link request', () => {
    const req = makeReq({ userId: 'user_1' });
    vippsController.redirectToVipps(req, makeRes());
    expect(req.session.vippsAuth.linkUserId).toBeNull();
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
