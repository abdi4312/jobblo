const fs = require('fs');
const path = require('path');

/**
 * Norwegian BankID via Idura Verify — OpenID Connect authorization code + PKCE.
 *
 * The implementation this replaces validated no `state`, sent no `nonce` and no PKCE,
 * never requested or verified an `id_token`, and linked BankID to any account whose
 * e-mail happened to match before marking it `verified`. Every one of those is a test
 * below.
 *
 * `openid-client` is mocked. What is under test is Jobblo's half — transaction
 * handling, intent binding, claim minimisation and the account decision. The token
 * validation itself (signature, iss, aud, exp, nonce) is the library's job and is
 * exercised here only through "the library threw, so nothing was written".
 */

// ── Mocks ───────────────────────────────────────────────────────────────────────

const mockOidc = {
  discovery: jest.fn(async () => ({ __config: true })),
  ClientSecretPost: jest.fn(() => ({ __auth: true })),
  randomState: jest.fn(() => 'state-random-value'),
  randomNonce: jest.fn(() => 'nonce-random-value'),
  randomPKCECodeVerifier: jest.fn(() => 'verifier-random-value'),
  calculatePKCECodeChallenge: jest.fn(async () => 'challenge-value'),
  buildAuthorizationUrl: jest.fn(
    (_config, params) =>
      new URL(`https://tenant.test.idura.broker/oauth2/authorize?${new URLSearchParams(params)}`)
  ),
  authorizationCodeGrant: jest.fn(),
};

/**
 * Mocked at the CommonJS bridge, not at `openid-client` itself.
 *
 * Jest runs with `transform: {}`, so a native dynamic `import('openid-client')` is not
 * routed through the module registry and the real library would be loaded — discovery
 * would attempt a network call to the issuer. `config/oidcModule` is an ordinary CJS
 * module, so mocking it actually intercepts.
 */
jest.mock('../config/oidcModule', () => ({ load: async () => mockOidc }));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('../models/IdentityClaim', () => {
  const model = {
    create: jest.fn(),
    findById: jest.fn(),
    deleteOne: jest.fn(),
    keyFor: (provider, scheme, subject) => `${provider}:${scheme}:${subject}`,
  };
  return model;
});

jest.mock('../utils/tokenUtils', () => ({
  createSession: jest.fn(async () => ({ accessToken: 'jobblo-at', refreshToken: 'jobblo-rt' })),
}));

/**
 * Bound in beforeEach, AFTER `jest.resetModules()`.
 *
 * The controller is re-required per test so it re-reads process.env. resetModules also
 * re-evaluates the mock factories, so a module captured at file scope would be a
 * different object from the one the controller sees, and every assertion on it would
 * silently watch the wrong mock.
 */
let User;
let IdentityClaim;
let createSession;

const IDURA_ENV = {
  IDURA_ISSUER: 'tenant.test.idura.broker',
  IDURA_CLIENT_ID: 'urn:my:application:identifier:1',
  IDURA_CLIENT_SECRET: 'test-secret-not-real',
  IDURA_REDIRECT_URI: 'http://localhost:5000/api/auth/idura/callback',
  FRONTEND_URL: 'http://localhost:5173',
};

const OLD_ENV = process.env;

let controller;
let transaction;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  process.env = { ...OLD_ENV, ...IDURA_ENV, NODE_ENV: 'test' };

  User = require('../models/User');
  IdentityClaim = require('../models/IdentityClaim');
  ({ createSession } = require('../utils/tokenUtils'));
  controller = require('../controllers/iduraAuthController');
  transaction = require('../utils/iduraTransaction');

  User.findByIdAndUpdate.mockResolvedValue({ _id: 'u1' });
  User.deleteOne.mockResolvedValue({ deletedCount: 1 });
  IdentityClaim.create.mockResolvedValue({});
  IdentityClaim.findById.mockReturnValue({ lean: async () => null });
});

afterAll(() => {
  process.env = OLD_ENV;
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

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

function makeReq({ query = {}, session = {}, userId, url = '/api/auth/idura/callback' } = {}) {
  if (session && typeof session.save !== 'function') {
    session.save = (cb) => cb(null);
  }
  return {
    query,
    session,
    userId,
    protocol: 'http',
    originalUrl: url,
    get: () => 'localhost:5000',
  };
}

/** A session already holding a valid pending transaction. */
function sessionWithTransaction(overrides = {}) {
  return {
    save: (cb) => cb(null),
    iduraTransaction: {
      intent: 'login',
      jobbloUserId: null,
      state: 'state-random-value',
      nonce: 'nonce-random-value',
      codeVerifier: 'verifier-random-value',
      createdAt: Date.now(),
      ...overrides,
    },
  };
}

const VALID_CLAIMS = {
  sub: 'bankid-subject-1',
  name: 'Ola Nordmann',
  birthdate: '1990-05-17',
  country: 'NO',
  uniqueuserid: 'uid-1',
  identityscheme: 'nobankid-oidc',
  acr: 'urn:grn:authn:no:bankid',
};

function grantReturns(claims) {
  mockOidc.authorizationCodeGrant.mockResolvedValue({ claims: () => claims });
}

const cbQuery = (over = {}) => ({ code: 'auth-code', state: 'state-random-value', ...over });

// ════════════════════════════════════════════════════════════════════════════════
// INITIATION
// ════════════════════════════════════════════════════════════════════════════════

describe('1–4. initiation mints and stores the transaction server-side', () => {
  it('generates state, nonce and a PKCE verifier from the OIDC library', async () => {
    const req = makeReq({ session: {} });
    await controller.startIduraAuth(req, makeRes());

    expect(mockOidc.randomState).toHaveBeenCalled();
    expect(mockOidc.randomNonce).toHaveBeenCalled();
    expect(mockOidc.randomPKCECodeVerifier).toHaveBeenCalled();
    expect(mockOidc.calculatePKCECodeChallenge).toHaveBeenCalledWith('verifier-random-value');
  });

  it('stores state, nonce and verifier in the session, not the URL', async () => {
    const req = makeReq({ session: {} });
    const res = makeRes();
    await controller.startIduraAuth(req, res);

    const stored = req.session.iduraTransaction;
    expect(stored).toMatchObject({
      state: 'state-random-value',
      nonce: 'nonce-random-value',
      codeVerifier: 'verifier-random-value',
      intent: 'login',
    });

    // The verifier must never leave the server — only the S256 challenge does.
    expect(res.redirectedTo).not.toContain('verifier-random-value');
    expect(res.redirectedTo).toContain('code_challenge=challenge-value');
    expect(res.redirectedTo).toContain('code_challenge_method=S256');
  });

  it('sends state and nonce to the authorization endpoint', async () => {
    const res = makeRes();
    await controller.startIduraAuth(makeReq({ session: {} }), res);

    expect(res.redirectedTo).toContain('state=state-random-value');
    expect(res.redirectedTo).toContain('nonce=nonce-random-value');
  });

  it('requests Norwegian BankID and never the ssn scope', async () => {
    const res = makeRes();
    await controller.startIduraAuth(makeReq({ session: {} }), res);

    const url = new URL(res.redirectedTo);
    expect(url.searchParams.get('acr_values')).toBe('urn:grn:authn:no:bankid');
    expect(url.searchParams.get('scope')).toBe('openid');
    expect(url.searchParams.get('scope')).not.toMatch(/ssn/);
  });

  it('persists the session before redirecting, so the callback can find it', async () => {
    const save = jest.fn((cb) => cb(null));
    await controller.startIduraAuth(makeReq({ session: { save } }), makeRes());
    expect(save).toHaveBeenCalled();
  });

  it('replaces any previous transaction rather than accumulating them', async () => {
    const req = makeReq({ session: sessionWithTransaction({ state: 'stale-state' }) });
    await controller.startIduraAuth(req, makeRes());
    expect(req.session.iduraTransaction.state).toBe('state-random-value');
  });

  it('a FAILED link start returns to the profile, not /login', async () => {
    /**
     * The frontend wraps /login in PublicRoute, which redirects an authenticated user
     * to /home — taking the error parameter with it. Sending a signed-in person's
     * failed verification to /login therefore dumps them on the home page with no
     * explanation, which is how a session-store fault presented as "it just reloads me
     * back to /home".
     */
    const res = makeRes();
    await controller.startIduraAuth(
      makeReq({
        query: { link: '1' },
        userId: 'user-42',
        session: { save: (cb) => cb(new Error('session store unavailable')) },
      }),
      res
    );

    expect(res.redirectedTo).toBe('http://localhost:5173/profile?error=bankid_verification_failed');
  });

  it('a failed LOGIN start still goes to /login', async () => {
    const res = makeRes();
    await controller.startIduraAuth(
      makeReq({ session: { save: (cb) => cb(new Error('boom')) } }),
      res
    );

    expect(res.redirectedTo).toBe('http://localhost:5173/login?error=bankid_verification_failed');
  });

  it('answers unavailable rather than crashing when Idura is not configured', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173' };
    jest.resetModules();
    const unconfigured = require('../controllers/iduraAuthController');

    const res = makeRes();
    await unconfigured.startIduraAuth(makeReq({ session: {} }), res);

    expect(res.redirectedTo).toContain('error=bankid_unavailable');
  });
});

describe('5–6. intent binding at initiation', () => {
  it('a link request from an authenticated caller records that account', async () => {
    const req = makeReq({ query: { link: '1' }, userId: 'user-42', session: {} });
    await controller.startIduraAuth(req, makeRes());

    expect(req.session.iduraTransaction).toMatchObject({
      intent: 'link',
      jobbloUserId: 'user-42',
    });
  });

  it('a link request without a session is refused, not downgraded to a login', async () => {
    const req = makeReq({ query: { link: '1' }, session: {} });
    const res = makeRes();
    await controller.startIduraAuth(req, res);

    expect(res.redirectedTo).toContain('error=bankid_auth_required');
    expect(req.session.iduraTransaction).toBeUndefined();
  });

  it('a login request works unauthenticated and records no target account', async () => {
    const req = makeReq({ session: {} });
    await controller.startIduraAuth(req, makeRes());

    expect(req.session.iduraTransaction).toMatchObject({ intent: 'login', jobbloUserId: null });
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// CALLBACK — happy paths
// ════════════════════════════════════════════════════════════════════════════════

describe('7. a valid BankID login', () => {
  it('logs in the account already holding that subject', async () => {
    grantReturns(VALID_CLAIMS);
    User.findOne.mockResolvedValue({ _id: 'existing-user' });

    const res = makeRes();
    await controller.iduraCallback(
      makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
      res
    );

    expect(User.findOne).toHaveBeenCalledWith({
      'identityVerification.provider': 'idura',
      'identityVerification.subject': 'bankid-subject-1',
    });
    expect(createSession).toHaveBeenCalledWith(expect.anything(), 'existing-user');
    expect(res.redirectedTo).toContain('/oauth-success');
    expect(res.cookies.accessToken).toBe('jobblo-at');
  });

  it('passes the stored nonce, state and verifier to the token exchange', async () => {
    grantReturns(VALID_CLAIMS);
    User.findOne.mockResolvedValue({ _id: 'existing-user' });

    await controller.iduraCallback(
      makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
      makeRes()
    );

    const [, , checks] = mockOidc.authorizationCodeGrant.mock.calls[0];
    expect(checks).toMatchObject({
      expectedState: 'state-random-value',
      expectedNonce: 'nonce-random-value',
      pkceCodeVerifier: 'verifier-random-value',
      idTokenExpected: true,
    });
  });
});

describe('8. a valid account link', () => {
  it('attaches the identity to the account from the SESSION and marks it verified', async () => {
    grantReturns(VALID_CLAIMS);
    User.findById.mockReturnValue({ select: async () => ({ _id: 'session-user' }) });

    const res = makeRes();
    await controller.iduraCallback(
      makeReq({
        query: cbQuery(),
        session: sessionWithTransaction({ intent: 'link', jobbloUserId: 'session-user' }),
      }),
      res
    );

    expect(User.findById).toHaveBeenCalledWith('session-user');
    expect(IdentityClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'idura:no_bankid:bankid-subject-1', userId: 'session-user' })
    );

    const [id, update] = User.findByIdAndUpdate.mock.calls[0];
    expect(id).toBe('session-user');
    expect(update.$set.verified).toBe(true);
    expect(update.$set.accountStatus).toBe('verified');
    expect(update.$set.identityVerification.subject).toBe('bankid-subject-1');

    expect(res.redirectedTo).toContain('/profile?verified=bankid');
  });

  it('a linking flow issues no new session — they are already signed in', async () => {
    grantReturns(VALID_CLAIMS);
    User.findById.mockReturnValue({ select: async () => ({ _id: 'session-user' }) });

    await controller.iduraCallback(
      makeReq({
        query: cbQuery(),
        session: sessionWithTransaction({ intent: 'link', jobbloUserId: 'session-user' }),
      }),
      makeRes()
    );

    expect(createSession).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// CALLBACK — failures must all fail closed
// ════════════════════════════════════════════════════════════════════════════════

/** Nothing was written to any account. */
function expectNothingWritten() {
  expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  expect(User.create).not.toHaveBeenCalled();
  expect(IdentityClaim.create).not.toHaveBeenCalled();
  expect(createSession).not.toHaveBeenCalled();
}

describe('9–11. state handling', () => {
  it('rejects a state that does not match the transaction', async () => {
    grantReturns(VALID_CLAIMS);
    const res = makeRes();

    await controller.iduraCallback(
      makeReq({ query: cbQuery({ state: 'attacker-state' }), session: sessionWithTransaction() }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_invalid_state');
    expect(mockOidc.authorizationCodeGrant).not.toHaveBeenCalled();
    expectNothingWritten();
  });

  it('rejects a callback with no state', async () => {
    const res = makeRes();
    await controller.iduraCallback(
      makeReq({ query: { code: 'c' }, session: sessionWithTransaction() }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_invalid_state');
    expectNothingWritten();
  });

  it('rejects a callback when the session holds no transaction at all', async () => {
    const res = makeRes();
    await controller.iduraCallback(makeReq({ query: cbQuery(), session: {} }), res);

    expect(res.redirectedTo).toContain('error=bankid_invalid_state');
    expectNothingWritten();
  });

  it('rejects an expired transaction', async () => {
    const res = makeRes();
    await controller.iduraCallback(
      makeReq({
        query: cbQuery(),
        session: sessionWithTransaction({ createdAt: Date.now() - 16 * 60 * 1000 }),
      }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_invalid_state');
    expectNothingWritten();
  });

  it('REPLAY: the same callback presented twice fails the second time', async () => {
    grantReturns(VALID_CLAIMS);
    User.findOne.mockResolvedValue({ _id: 'existing-user' });

    const session = sessionWithTransaction();
    const req1 = makeReq({ query: cbQuery(), session });
    const res1 = makeRes();
    await controller.iduraCallback(req1, res1);
    expect(res1.redirectedTo).toContain('/oauth-success');

    // Same captured URL, same session — the transaction is gone.
    jest.clearAllMocks();
    const res2 = makeRes();
    await controller.iduraCallback(makeReq({ query: cbQuery(), session }), res2);

    expect(res2.redirectedTo).toContain('error=bankid_invalid_state');
    expectNothingWritten();
  });

  it('23. the transaction is consumed even when the callback FAILS', async () => {
    const session = sessionWithTransaction();
    await controller.iduraCallback(
      makeReq({ query: cbQuery({ state: 'wrong' }), session }),
      makeRes()
    );

    expect(session.iduraTransaction).toBeUndefined();
  });

  it('the transaction is consumed on cancellation too', async () => {
    const session = sessionWithTransaction();
    await controller.iduraCallback(
      makeReq({ query: { error: 'access_denied' }, session }),
      makeRes()
    );

    expect(session.iduraTransaction).toBeUndefined();
  });
});

describe('12–13. token validation failures', () => {
  it.each([
    ['wrong nonce', new Error('unexpected ID Token "nonce" claim value')],
    ['bad signature', new Error('JWT signature verification failed')],
    ['wrong issuer', new Error('unexpected JWT "iss" claim value')],
    ['wrong audience', new Error('unexpected JWT "aud" claim value')],
    ['expired token', new Error('"exp" claim timestamp check failed')],
    ['PKCE mismatch', new Error('invalid_grant')],
  ])('%s is rejected and nothing is written', async (_label, err) => {
    mockOidc.authorizationCodeGrant.mockRejectedValue(err);
    const res = makeRes();

    await controller.iduraCallback(
      makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_verification_failed');
    expectNothingWritten();
  });

  it('22. the failure response leaks no token, issuer or library detail', async () => {
    mockOidc.authorizationCodeGrant.mockRejectedValue(
      new Error('unexpected JWT "iss" claim value; expected https://tenant.test.idura.broker')
    );
    const res = makeRes();

    await controller.iduraCallback(
      makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
      res
    );

    expect(res.redirectedTo).toBe(
      'http://localhost:5173/login?error=bankid_verification_failed'
    );
    for (const leak of ['iss', 'idura.broker', 'auth-code', 'verifier-random-value', 'JWT']) {
      expect(res.redirectedTo).not.toContain(leak);
    }
  });

  it('a missing authorization code is rejected before any exchange', async () => {
    const res = makeRes();
    await controller.iduraCallback(
      makeReq({ query: { state: 'state-random-value' }, session: sessionWithTransaction() }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_verification_failed');
    expect(mockOidc.authorizationCodeGrant).not.toHaveBeenCalled();
  });
});

describe('14. a token with no subject is refused', () => {
  it.each([undefined, null, '', '   '])('sub = %p', async (sub) => {
    grantReturns({ ...VALID_CLAIMS, sub });
    const res = makeRes();

    await controller.iduraCallback(
      makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_identity');
    expectNothingWritten();
  });
});

describe('15 & 20. one identity belongs to at most one account', () => {
  it('refuses to link an identity another account already claimed', async () => {
    grantReturns(VALID_CLAIMS);
    User.findById.mockReturnValue({ select: async () => ({ _id: 'session-user' }) });

    const duplicate = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    IdentityClaim.create.mockRejectedValue(duplicate);
    IdentityClaim.findById.mockReturnValue({ lean: async () => ({ userId: 'someone-else' }) });

    const res = makeRes();
    await controller.iduraCallback(
      makeReq({
        query: cbQuery(),
        session: sessionWithTransaction({ intent: 'link', jobbloUserId: 'session-user' }),
      }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_already_linked');
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('re-verifying the SAME account is idempotent, not a conflict', async () => {
    grantReturns(VALID_CLAIMS);
    User.findById.mockReturnValue({ select: async () => ({ _id: 'session-user' }) });

    const duplicate = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    IdentityClaim.create.mockRejectedValue(duplicate);
    IdentityClaim.findById.mockReturnValue({ lean: async () => ({ userId: 'session-user' }) });

    const res = makeRes();
    await controller.iduraCallback(
      makeReq({
        query: cbQuery(),
        session: sessionWithTransaction({ intent: 'link', jobbloUserId: 'session-user' }),
      }),
      res
    );

    expect(res.redirectedTo).toContain('verified=bankid');
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('a login that loses the claim race deletes the account it just made', async () => {
    grantReturns({ ...VALID_CLAIMS, email: 'ny@example.no' });
    User.findOne
      .mockResolvedValueOnce(null) // no user holds the subject
      .mockReturnValueOnce({ select: async () => null }); // e-mail is free
    User.create.mockResolvedValue({ _id: 'brand-new' });

    const duplicate = Object.assign(new Error('E11000'), { code: 11000 });
    IdentityClaim.create.mockRejectedValue(duplicate);
    // The orphan-claim check runs BEFORE the account is created and must find nothing —
    // this test is about losing the race afterwards, inside claimIdentity.
    IdentityClaim.findById
      .mockReturnValueOnce({ lean: async () => null })
      .mockReturnValue({ lean: async () => ({ userId: 'other-user' }) });

    const res = makeRes();
    await controller.iduraCallback(
      makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
      res
    );

    expect(User.deleteOne).toHaveBeenCalledWith({ _id: 'brand-new' });
    expect(res.redirectedTo).toContain('error=bankid_already_linked');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('the claim key is namespaced by provider and scheme', () => {
    expect(IdentityClaim.keyFor('idura', 'no_bankid', 'abc')).toBe('idura:no_bankid:abc');
  });
});

describe('16 & 21. e-mail and callback parameters cannot choose the account', () => {
  it('a matching e-mail does NOT auto-link an existing account', async () => {
    grantReturns({ ...VALID_CLAIMS, email: 'offer@example.no' });
    User.findOne
      .mockResolvedValueOnce(null) // nobody holds this subject
      .mockReturnValueOnce({ select: async () => ({ _id: 'victim' }) }); // e-mail taken

    const res = makeRes();
    await controller.iduraCallback(
      makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_account_exists');
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(IdentityClaim.create).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  it('callback query parameters cannot redirect the link to another account', async () => {
    grantReturns(VALID_CLAIMS);
    User.findById.mockReturnValue({ select: async () => ({ _id: 'session-user' }) });

    await controller.iduraCallback(
      makeReq({
        // Every one of these is attacker-controlled and must be ignored.
        query: cbQuery({ userId: 'victim', jobbloUserId: 'victim', link: '1', intent: 'link' }),
        session: sessionWithTransaction({ intent: 'link', jobbloUserId: 'session-user' }),
      }),
      makeRes()
    );

    expect(User.findById).toHaveBeenCalledWith('session-user');
    expect(User.findById).not.toHaveBeenCalledWith('victim');
    expect(User.findByIdAndUpdate.mock.calls[0][0]).toBe('session-user');
  });

  it('a link transaction with no stored target refuses rather than guessing', async () => {
    grantReturns(VALID_CLAIMS);
    const res = makeRes();

    await controller.iduraCallback(
      makeReq({
        query: cbQuery(),
        session: sessionWithTransaction({ intent: 'link', jobbloUserId: null }),
      }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_invalid_state');
    expectNothingWritten();
  });

  it('BankID with no e-mail cannot create an account silently', async () => {
    grantReturns(VALID_CLAIMS); // kodebrikke returns no e-mail
    User.findOne.mockResolvedValueOnce(null);

    const res = makeRes();
    await controller.iduraCallback(
      makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_no_email');
    expect(User.create).not.toHaveBeenCalled();
  });
});

describe('17. no national identity number is ever persisted', () => {
  it.each(['socialno', 'ssn', 'nin', 'fodselsnummer', 'personalIdentityNumber'])(
    'a %s claim aborts the flow',
    async (claimName) => {
      grantReturns({ ...VALID_CLAIMS, [claimName]: '17059012345' });
      const res = makeRes();

      await controller.iduraCallback(
        makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
        res
      );

      expect(res.redirectedTo).toContain('error=bankid_verification_failed');
      expectNothingWritten();
      expect(JSON.stringify(User.findByIdAndUpdate.mock.calls)).not.toContain('17059012345');
    }
  );

  it('the ssn scope is never requested', async () => {
    const res = makeRes();
    await controller.startIduraAuth(makeReq({ session: {} }), res);
    expect(new URL(res.redirectedTo).searchParams.get('scope')).toBe('openid');
  });

  it('only the allow-listed fields are written, and birthdate is reduced to a year', async () => {
    grantReturns({
      ...VALID_CLAIMS,
      certissuer: 'CN=BankID',
      certsubject: 'CN=Ola',
      nameidentifier: 'legacy-id',
      phone_number: '+4799887766',
    });
    User.findOne.mockResolvedValue(null);
    User.findById.mockReturnValue({ select: async () => ({ _id: 'session-user' }) });

    await controller.iduraCallback(
      makeReq({
        query: cbQuery(),
        session: sessionWithTransaction({ intent: 'link', jobbloUserId: 'session-user' }),
      }),
      makeRes()
    );

    const written = User.findByIdAndUpdate.mock.calls[0][1].$set.identityVerification;

    expect(Object.keys(written).sort()).toEqual(
      [
        'acr',
        'assuranceLevel',
        'birthYear',
        'provider',
        'scheme',
        'subject',
        'uniqueUserId',
        'verifiedAt',
        'verifiedName',
      ].sort()
    );
    expect(written.birthYear).toBe(1990);

    const blob = JSON.stringify(written);
    for (const leak of ['1990-05-17', 'CN=BankID', 'CN=Ola', 'legacy-id', '+4799887766']) {
      expect(blob).not.toContain(leak);
    }
  });
});

describe('18–19. failure never marks anyone verified; cancellation is handled', () => {
  it('a failed callback leaves verified untouched', async () => {
    mockOidc.authorizationCodeGrant.mockRejectedValue(new Error('nope'));
    await controller.iduraCallback(
      makeReq({ query: cbQuery(), session: sessionWithTransaction() }),
      makeRes()
    );

    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('user cancellation returns to the right screen for the intent', async () => {
    const loginRes = makeRes();
    await controller.iduraCallback(
      makeReq({ query: { error: 'access_denied' }, session: sessionWithTransaction() }),
      loginRes
    );
    expect(loginRes.redirectedTo).toBe('http://localhost:5173/login?error=bankid_cancelled');

    const linkRes = makeRes();
    await controller.iduraCallback(
      makeReq({
        query: { error: 'access_denied' },
        session: sessionWithTransaction({ intent: 'link', jobbloUserId: 'u1' }),
      }),
      linkRes
    );
    expect(linkRes.redirectedTo).toBe('http://localhost:5173/profile?error=bankid_cancelled');
  });

  it('an Idura service error does not verify anyone', async () => {
    const res = makeRes();
    await controller.iduraCallback(
      makeReq({ query: { error: 'server_error' }, session: sessionWithTransaction() }),
      res
    );

    expect(res.redirectedTo).toContain('error=bankid_cancelled');
    expectNothingWritten();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// SOURCE-LEVEL GUARANTEES
// ════════════════════════════════════════════════════════════════════════════════

describe('the old insecure implementation is gone', () => {
  const { stripComments } = require('../test-utils/stripComments');
  const controllerSource = stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'controllers', 'iduraAuthController.js'), 'utf8')
  );
  const routerSource = stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'routes', 'auth.js'), 'utf8')
  );

  it('the bespoke token endpoint call is not present', () => {
    expect(controllerSource).not.toMatch(/\/auth\/token/);
    expect(controllerSource).not.toMatch(/IDURA_BASE_URL|IDURA_CALLBACK_URL/);
  });

  it('no plaintext placeholder password', () => {
    expect(controllerSource).not.toMatch(/password:\s*'oauth-user'/);
    expect(controllerSource).toMatch(/createUnusablePassword\(\)/);
  });

  it('the routes point at the new controller', () => {
    expect(routerSource).toMatch(/router\.get\('\/idura',\s*optionalAuthenticate/);
    expect(routerSource).toMatch(/router\.get\('\/idura\/callback'/);
    expect(routerSource).not.toMatch(/IDURA_DISABLED/);
  });

  it('logging records a reason but never a secret', () => {
    expect(controllerSource).toMatch(/reason=%s/);
    for (const forbidden of [
      /console\.\w+\([^)]*\bcode\b\s*\)/,
      /console\.\w+\([^)]*id_token/,
      /console\.\w+\([^)]*access_token/,
      /console\.\w+\([^)]*CLIENT_SECRET/,
      /console\.\w+\([^)]*claims\.sub/,
    ]) {
      expect(controllerSource).not.toMatch(forbidden);
    }
  });

  it('there is no development bypass that skips BankID', () => {
    expect(controllerSource).not.toMatch(/NODE_ENV\s*[!=]==?\s*'production'[\s\S]{0,200}verified:\s*true/);
    expect(controllerSource).not.toMatch(/skipVerification|bypassBankId|FAKE_BANKID/i);
  });
});
