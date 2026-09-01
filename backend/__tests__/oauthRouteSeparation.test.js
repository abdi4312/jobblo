jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('../models/User', () => ({ findOne: jest.fn(), findById: jest.fn(), create: jest.fn() }));
jest.mock('../utils/subscription', () => ({ ensureDefaultSubscription: jest.fn(async () => ({})) }));
jest.mock('../utils/tokenUtils', () => ({ createSession: jest.fn(async () => ({ accessToken: 'at', refreshToken: 'rt' })) }));

let passport;
let vippsController;
let oauthDestination;
let axios;
let User;

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

function makeReq({ query = {}, session = {}, userId } = {}) {
  if (session && typeof session.save !== 'function') {
    session.save = (cb) => setImmediate(() => cb(null));
  }
  return { query, session, userId };
}

describe('explicit web/mobile OAuth routes', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'test',
      FRONTEND_URL: 'https://jobblo.example/',
      MOBILE_RETURN_URL: 'https://api.example',
      MOBILE_APP_LINK_PREFIX: 'jobblo://',
      SESSION_SECRET: 'test-platform-state-secret',
      JWT_SECRET: 'test-jwt-secret',
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
      GOOGLE_WEB_CALLBACK_URL: 'https://jobblo.no/api/auth/web/google/callback',
      GOOGLE_MOBILE_CALLBACK_URL: 'https://jobblo.no/api/auth/mobile/google/callback',
      VIPPS_CLIENT_ID: 'cid',
      VIPPS_CLIENT_SECRET: 'secret',
      VIPPS_WEB_REDIRECT_URI: 'https://jobblo.no/api/auth/web/vipps/callback',
      VIPPS_MOBILE_REDIRECT_URI: 'https://jobblo.no/api/auth/mobile/vipps/callback',
      VIPPS_BASE_URL: 'https://apitest.vipps.no',
    };
    axios = require('axios');
    User = require('../models/User');
    vippsController = require('../controllers/vippsController');
    ({ oauthDestination } = require('../utils/oauthReturn'));
    passport = require('../config/passport');
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('creates separate Google strategies for web and mobile', () => {
    expect(passport._strategies['google-web']).toBeDefined();
    expect(passport._strategies['google-mobile']).toBeDefined();
    expect(passport._strategies['google-web']._callbackURL).toBe(
      'https://jobblo.no/api/auth/web/google/callback'
    );
    expect(passport._strategies['google-mobile']._callbackURL).toBe(
      'https://jobblo.no/api/auth/mobile/google/callback'
    );
  });

  it('web Google callback redirects to the web success destination', () => {
    const url = oauthDestination({ platform: 'web', accessToken: 'token123' });
    expect(url).toBe('https://jobblo.example/oauth-success?token=token123');
  });

  it('mobile Google callback redirects to the app hand-off', () => {
    const url = oauthDestination({ platform: 'mobile', accessToken: 'token123' });
    expect(url).toContain('https://api.example/api/auth/mobile-return?state=success&token=token123');
  });

  it('web Vipps authorize uses the web redirect URI', async () => {
    const req = makeReq({ session: { save: (cb) => setImmediate(() => cb(null)) } });
    const res = makeRes();

    await vippsController.redirectToVipps(req, res, { platform: 'web' });

    expect(res.redirectedTo).toContain('redirect_uri=https%3A%2F%2Fjobblo.no%2Fapi%2Fauth%2Fweb%2Fvipps%2Fcallback');
  });

  it('mobile Vipps authorize uses the mobile redirect URI', async () => {
    const req = makeReq({ session: { save: (cb) => setImmediate(() => cb(null)) } });
    const res = makeRes();

    await vippsController.redirectToVipps(req, res, { platform: 'mobile' });

    expect(res.redirectedTo).toContain('redirect_uri=https%3A%2F%2Fjobblo.no%2Fapi%2Fauth%2Fmobile%2Fvipps%2Fcallback');
  });

  it('Vipps token exchange uses the same route-specific redirect URI', async () => {
    const session = {
      vippsAuth: {
        state: 'abc',
        createdAt: Date.now(),
        redirectUri: 'https://jobblo.no/api/auth/mobile/vipps/callback',
      },
    };
    const req = makeReq({
      query: { code: 'c', state: 'abc' },
      session,
    });
    const res = makeRes();

    axios.post.mockResolvedValue({ data: { access_token: 'vipps-at' } });
    axios.get.mockResolvedValue({ data: { sub: 'vipps-123', email: 'user@example.com' } });
    User.findOne.mockResolvedValue({ _id: 'u1', email: 'user@example.com' });

    await vippsController.vippsCallback(req, res, { platform: 'mobile', redirectUri: 'https://jobblo.no/api/auth/mobile/vipps/callback' });

    const payload = axios.post.mock.calls[0][1];
    expect(payload).toContain('redirect_uri=https%3A%2F%2Fjobblo.no%2Fapi%2Fauth%2Fmobile%2Fvipps%2Fcallback');
  });

  it('rejects invalid Vipps state for web and mobile', async () => {
    for (const platform of ['web', 'mobile']) {
      const req = makeReq({
        query: { code: 'c', state: 'attacker' },
        session: {
          vippsAuth: {
            state: 'real',
            createdAt: Date.now(),
            redirectUri: platform === 'web'
              ? 'https://jobblo.no/api/auth/web/vipps/callback'
              : 'https://jobblo.no/api/auth/mobile/vipps/callback',
          },
        },
      });
      const res = makeRes();

      await vippsController.vippsCallback(req, res, { platform, redirectUri: platform === 'web' ? 'https://jobblo.no/api/auth/web/vipps/callback' : 'https://jobblo.no/api/auth/mobile/vipps/callback' });

      expect(res.redirectedTo).toContain('vipps_invalid_state');
    }
  });

  it('mobile errors return to the app', () => {
    const url = oauthDestination({ platform: 'mobile', error: 'vipps_failed' });
    expect(url).toContain('https://api.example/api/auth/mobile-return?state=error&code=vipps_failed');
  });

  it('web errors return to the web page', () => {
    const url = oauthDestination({ platform: 'web', error: 'google_failed', webPath: 'login' });
    expect(url).toBe('https://jobblo.example/login?error=google_failed');
  });
});
