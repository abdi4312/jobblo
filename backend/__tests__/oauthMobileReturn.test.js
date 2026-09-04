const fs = require('fs');
const path = require('path');
const { stripComments } = require('../test-utils/stripComments');

/**
 * Where a finished Google or Vipps sign-in is sent, and what the app bridge will emit.
 *
 * Two properties are load-bearing here and neither is visible from reading a single
 * function:
 *
 *   1. WEB IS THE DEFAULT. Absent, unrecognised, forged or stale intent all mean the
 *      website, and the website's URLs are byte-identical to the ones these callbacks
 *      built before a mobile app existed.
 *   2. THE APP IS REACHED ONLY ON INTENT THIS SERVER RECORDED ITSELF — a session key, or
 *      an HMAC-signed token minted before the provider was ever contacted. A client may
 *      say `platform=mobile` at the START endpoint and nothing else; it never supplies a
 *      return URL, and an unsigned `platform` on the callback is ignored outright.
 *
 * The signed carrier exists because the session copy turned out not to survive a second
 * sign-in from the same browser: the first attempt worked, and after a sign-out the second
 * came back on `FRONTEND_URL` — a `localhost:5173` that exists only on a developer's
 * machine — because nothing in the session said `mobile` any more.
 */

const {
  mobileReturn,
  oauthDestination,
  rememberOAuthPlatform,
  takeOAuthPlatform,
  mintPlatformState,
  withPlatformState,
  noStore,
  resolveAppLinkPrefix,
  resolveMobileReturnBase,
} = require('../utils/oauthReturn');

/** JWT-shaped, and deliberately not a real token. */
const TOKEN = 'header123.payload456.signature789';

function makeRes() {
  return {
    headers: {},
    statusCode: 200,
    body: '',
    set(name, value) {
      if (typeof name === 'object') Object.assign(this.headers, name);
      else this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

/** `save` calls back on a later tick, as an async session store does. */
function makeReq({ query = {}, session = {}, ...rest } = {}) {
  if (session && typeof session.save !== 'function') {
    session.save = (cb) => setImmediate(() => cb(null));
  }
  return { query, session, get: () => 'api.example', protocol: 'https', ...rest };
}

const OLD_ENV = process.env;
let warn;
let error;

beforeEach(() => {
  process.env = {
    ...OLD_ENV,
    NODE_ENV: 'test',
    FRONTEND_URL: 'https://jobblo.example/',
    MOBILE_RETURN_URL: 'https://api.example',
    MOBILE_APP_LINK_PREFIX: 'jobblo://',
    SESSION_SECRET: 'test-platform-state-secret',
    JWT_SECRET: 'test-jwt-secret',
  };
  // This module logs misconfiguration and recovered intent on purpose; several tests below
  // assert on those lines, and none of them belong in the test output.
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  error = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = OLD_ENV;
});
describe('what a client is allowed to say at the start endpoint', () => {
  it('records `platform=mobile` and answers mobile', async () => {
    const req = makeReq({ query: { platform: 'mobile' } });
    await expect(rememberOAuthPlatform(req)).resolves.toBe('mobile');
    expect(req.session.oauthPlatform).toBe('mobile');
  });

  it('treats an absent platform as web and leaves nothing behind', async () => {
    const req = makeReq({ session: { oauthPlatform: 'mobile' } });
    await expect(rememberOAuthPlatform(req)).resolves.toBe('web');
    expect(req.session.oauthPlatform).toBeUndefined();
  });

  /**
   * A closed enum, so the value that would matter if this were a URL — one pointing at
   * somebody else's origin — is simply not a platform. It is logged and the flow continues
   * to the website, because a redirect endpoint a browser has already reached is the wrong
   * place to answer with a 400.
   */
  it('does not accept a URL as a platform', async () => {
    const req = makeReq({ query: { platform: 'https://evil.example/steal' } });
    await expect(rememberOAuthPlatform(req)).resolves.toBe('web');
    expect(req.session.oauthPlatform).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('is case- and whitespace-insensitive about the one value it does accept', async () => {
    await expect(rememberOAuthPlatform(makeReq({ query: { platform: ' Mobile ' } }))).resolves.toBe(
      'mobile'
    );
  });

  it('degrades to web when there is no session to record the intent in', async () => {
    await expect(
      rememberOAuthPlatform({ query: { platform: 'mobile' }, session: null })
    ).resolves.toBe('web');
    expect(error).toHaveBeenCalled();
  });

  /**
   * The write is awaited because the provider round trip can outrun an async session store.
   * A flow whose intent could not be stored is answered as web rather than as a mobile flow
   * that will not be recognised on the way back.
   */
  it('degrades to web when the store write fails', async () => {
    const session = { save: (cb) => setImmediate(() => cb(new Error('store down'))) };
    await expect(rememberOAuthPlatform({ query: { platform: 'mobile' }, session })).resolves.toBe(
      'web'
    );
    expect(error).toHaveBeenCalled();
  });
});
describe('reading the intent back at the callback', () => {
  it('takes the session copy', () => {
    expect(takeOAuthPlatform(makeReq({ session: { oauthPlatform: 'mobile' } }))).toBe('mobile');
  });

  it('consumes it, so an abandoned attempt cannot capture a later web sign-in', () => {
    const req = makeReq({ session: { oauthPlatform: 'mobile' } });
    expect(takeOAuthPlatform(req)).toBe('mobile');
    expect(req.session.oauthPlatform).toBeUndefined();
    expect(takeOAuthPlatform(req)).toBe('web');
  });

  /** The reported failure: the session lost it, and the signed state carried it anyway. */
  it('recovers it from the signed state when the session lost it', () => {
    const req = makeReq({ query: { state: mintPlatformState('mobile') }, session: {} });
    expect(takeOAuthPlatform(req)).toBe('mobile');
    expect(warn).toHaveBeenCalledWith(
      'OAuth: mobile intent recovered from the signed state, not the session'
    );
  });

  it('says nothing about a session that did survive', () => {
    const req = makeReq({
      query: { state: mintPlatformState('mobile') },
      session: { oauthPlatform: 'mobile' },
    });
    expect(takeOAuthPlatform(req)).toBe('mobile');
    expect(warn).not.toHaveBeenCalled();
  });

  it('is web when neither carrier says otherwise', () => {
    expect(takeOAuthPlatform(makeReq())).toBe('web');
    expect(takeOAuthPlatform(makeReq({ query: { state: 'a'.repeat(64) } }))).toBe('web');
  });

  /**
   * The callback's `platform` parameter is attacker-supplied — it arrives through the
   * provider's redirect, which anybody can construct. Intent recorded at the start endpoint
   * is the only thing that counts.
   */
  it('ignores an unsigned platform parameter on the callback itself', () => {
    expect(takeOAuthPlatform(makeReq({ query: { platform: 'mobile' } }))).toBe('web');
    expect(
      takeOAuthPlatform(makeReq({ query: { platform: 'mobile', state: 'a'.repeat(64) } }))
    ).toBe('web');
  });

  /** `?state=a&state=b` arrives as an array. Not a string, so not intent — and not a throw. */
  it('survives a repeated state parameter', () => {
    const req = makeReq({ query: { state: [mintPlatformState('mobile'), 'x'] } });
    expect(takeOAuthPlatform(req)).toBe('web');
  });

  it('does not need a session object at all', () => {
    expect(takeOAuthPlatform({ query: { state: mintPlatformState('mobile') } })).toBe('mobile');
    expect(takeOAuthPlatform({})).toBe('web');
  });
});
describe('the signed platform token', () => {
  const SHAPE = /^m\.\d{10,15}\.[a-f0-9]{18}\.[a-f0-9]{64}$/;

  it('is minted for mobile and not at all for web', () => {
    expect(mintPlatformState('mobile')).toMatch(SHAPE);
    expect(mintPlatformState('web')).toBe('');
    expect(mintPlatformState(undefined)).toBe('');
  });

  it('is different every time', () => {
    expect(mintPlatformState('mobile')).not.toBe(mintPlatformState('mobile'));
  });

  /**
   * Vipps brings its own session-bound CSRF state; the token rides behind a separator.
   * A web flow's state has to come out the other side untouched — that value is compared
   * byte-for-byte in constant time when Vipps hands it back.
   */
  it('rides behind a separator on an existing state, and leaves web states alone', () => {
    const base = 'f'.repeat(64);
    expect(withPlatformState(base, 'web')).toBe(base);
    expect(withPlatformState(base, 'mobile')).toMatch(
      /^f{64}-m\.\d{10,15}\.[a-f0-9]{18}\.[a-f0-9]{64}$/
    );
  });

  it('is hex and dashes throughout, so a URL round trip cannot alter it', () => {
    const composite = withPlatformState('a'.repeat(64), 'mobile');
    const roundTripped = new URLSearchParams({ state: composite }).toString();
    expect(roundTripped).toBe(`state=${composite}`);
    expect(takeOAuthPlatform(makeReq({ query: { state: composite } }))).toBe('mobile');
  });

  it('is rejected once tampered with', () => {
    const token = mintPlatformState('mobile');
    const flip = (s) => s.slice(0, -1) + (s.endsWith('a') ? 'b' : 'a');
    for (const forged of [
      flip(token),
      token.replace(/^m\.\d+/, `m.${Date.now() + 1}`),
      token.replace(/^m\./, 'w.'),
      `${token}extra`,
      token.toUpperCase(),
    ]) {
      expect(takeOAuthPlatform(makeReq({ query: { state: forged } }))).toBe('web');
    }
  });

  it('is rejected when it was signed with another secret', () => {
    const token = mintPlatformState('mobile');
    process.env.SESSION_SECRET = 'rotated';
    expect(takeOAuthPlatform(makeReq({ query: { state: token } }))).toBe('web');
  });

  it('falls back to JWT_SECRET when there is no SESSION_SECRET', () => {
    delete process.env.SESSION_SECRET;
    const token = mintPlatformState('mobile');
    expect(token).toMatch(SHAPE);
    expect(takeOAuthPlatform(makeReq({ query: { state: token } }))).toBe('mobile');
  });

  /** No secret means no second carrier — not an unsigned one that anybody could mint. */
  it('is not minted at all without a secret, and none is then trusted', () => {
    delete process.env.SESSION_SECRET;
    delete process.env.JWT_SECRET;
    expect(mintPlatformState('mobile')).toBe('');
    expect(withPlatformState('a'.repeat(64), 'mobile')).toBe('a'.repeat(64));
    expect(error).toHaveBeenCalled();
    expect(takeOAuthPlatform(makeReq({ query: { state: 'm.1.aa.bb' } }))).toBe('web');
  });

  it('expires, so a captured authorization request does not stay usable', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() - 16 * 60 * 1000);
    const stale = mintPlatformState('mobile');
    clock.mockRestore();
    expect(takeOAuthPlatform(makeReq({ query: { state: stale } }))).toBe('web');
  });

  it('is still good a minute before it expires', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() - 14 * 60 * 1000);
    const fresh = mintPlatformState('mobile');
    clock.mockRestore();
    expect(takeOAuthPlatform(makeReq({ query: { state: fresh } }))).toBe('mobile');
  });
});
describe('the destination for a finished flow', () => {
  const web = (options) => oauthDestination({ req: makeReq(), platform: 'web', ...options });
  const mobile = (options) => oauthDestination({ req: makeReq(), platform: 'mobile', ...options });

  /**
   * Byte-for-byte the URLs these callbacks built by hand before the bridge existed. The
   * whole website depends on this pair and nothing about it is allowed to drift.
   */
  it('sends the website exactly where it always went', () => {
    expect(web({ accessToken: TOKEN })).toBe(`https://jobblo.example/oauth-success?token=${TOKEN}`);
    expect(web({ error: 'google_failed' })).toBe(
      'https://jobblo.example/login?error=google_failed'
    );
  });

  it('puts a link conflict on the profile page, where the connect button is', () => {
    expect(web({ error: 'vipps_already_linked', webPath: 'profile' })).toBe(
      'https://jobblo.example/profile?error=vipps_already_linked'
    );
  });

  it('tolerates FRONTEND_URL with or without a trailing slash', () => {
    process.env.FRONTEND_URL = 'https://jobblo.example';
    expect(web({ error: 'google_failed' })).toBe(
      'https://jobblo.example/login?error=google_failed'
    );
  });

  it('sends a mobile flow to the bridge on this origin', () => {
    expect(mobile({ accessToken: TOKEN })).toBe(
      `https://api.example/api/auth/mobile-return?state=success&token=${TOKEN}`
    );
    expect(mobile({ error: 'vipps_cancelled' })).toBe(
      'https://api.example/api/auth/mobile-return?state=error&code=vipps_cancelled'
    );
  });

  /**
   * A provider's own message, an exception, a stack — none of it becomes a URL. Only the
   * short code vocabulary the frontend has copy for survives; anything else is generic.
   */
  it('never lets a raw provider error into the redirect', () => {
    const raw = 'invalid_grant: Bad Request <script>alert(1)</script>';
    expect(web({ error: raw })).toBe('https://jobblo.example/login?error=oauth_failed');
    expect(mobile({ error: raw })).toBe(
      'https://api.example/api/auth/mobile-return?state=error&code=oauth_failed'
    );
    for (const bad of ['Vipps_Failed', 'a'.repeat(65), '../../etc/passwd', 'x y']) {
      expect(web({ error: bad })).toContain('error=oauth_failed');
    }
  });

  it('reports failure when neither a token nor a code was passed', () => {
    expect(web({})).toBe('https://jobblo.example/login?error=oauth_failed');
    expect(mobile({})).toBe(
      'https://api.example/api/auth/mobile-return?state=error&code=oauth_failed'
    );
  });

  /** Mid-sign-in, the person has to land somewhere real; the misconfiguration is logged. */
  it('falls back to the website when the bridge origin is unusable', () => {
    process.env.MOBILE_RETURN_URL = 'ftp://api.example';
    expect(mobile({ accessToken: TOKEN })).toBe(
      `https://jobblo.example/oauth-success?token=${TOKEN}`
    );
    expect(error).toHaveBeenCalled();
  });

  it('derives the bridge origin from the request outside production, but never inside it', () => {
    delete process.env.MOBILE_RETURN_URL;
    expect(resolveMobileReturnBase(makeReq()).base).toBe('https://api.example');
    expect(mobile({ accessToken: TOKEN })).toContain('https://api.example/api/auth/mobile-return');

    process.env.NODE_ENV = 'production';
    expect(resolveMobileReturnBase(makeReq()).error).toMatch(/MOBILE_RETURN_URL/);
    expect(mobile({ accessToken: TOKEN })).toBe(
      `https://jobblo.example/oauth-success?token=${TOKEN}`
    );
  });
});
describe('the bridge page', () => {
  function render(query) {
    const res = makeRes();
    mobileReturn(makeReq({ query }), res);
    return res;
  }

  /** The deep link exists in the page only as an attribute value. */
  function deepLink(body) {
    return /href="([^"]+)"/.exec(body)?.[1] ?? '';
  }

  it('hands a valid token to the app and says nothing else about it', () => {
    const res = render({ state: 'success', token: TOKEN });

    expect(res.statusCode).toBe(200);
    expect(deepLink(res.body)).toBe(`jobblo://oauth-success?token=${TOKEN}`);
    // Once, inside the href — never as page text, and the page is never cached or indexed.
    expect(res.body.split(TOKEN).length - 1).toBe(1);
    expect(res.headers['Cache-Control']).toBe('no-store, max-age=0');
    expect(res.headers['Referrer-Policy']).toBe('no-referrer');
    expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['Content-Type']).toBe('text/html; charset=utf-8');
  });

  it('locks the page down with a per-response nonce', () => {
    const res = render({ state: 'success', token: TOKEN });
    const csp = res.headers['Content-Security-Policy'];
    const nonce = /style-src 'nonce-([^']+)'/.exec(csp)?.[1];

    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(nonce).toBeTruthy();
    expect(res.body).toContain(`<style nonce="${nonce}">`);

    const second = render({ state: 'success', token: TOKEN });
    expect(second.headers['Content-Security-Policy']).not.toBe(csp);
  });

  it('offers one explicit handoff and does not auto-launch the app', () => {
    const body = render({ state: 'success', token: TOKEN }).body;
    expect(body).toContain('Åpne Jobblo');
    expect(body).not.toContain('window.location');
    expect(body).not.toContain('<script');
  });
});
describe('the bridge page refuses to invent a success', () => {
  function render(query) {
    const res = makeRes();
    mobileReturn(makeReq({ query }), res);
    return res;
  }

  const deepLink = (body) => /href="([^"]+)"/.exec(body)?.[1] ?? '';

  /**
   * These are query parameters on a public endpoint. This server generated the URL, but by
   * the time it arrives here it is an attacker-controlled string that merely usually came
   * from us — so a token that is not JWT-shaped is dropped rather than forwarded.
   */
  it('drops a token that is not shaped like one, and reports failure', () => {
    const res = render({ state: 'success', token: 'not-a-jwt' });
    expect(res.statusCode).toBe(400);
    expect(deepLink(res.body)).toBe('jobblo://oauth-success?error=oauth_failed');
    expect(res.body).not.toContain('not-a-jwt');
  });

  it('drops an absurdly long token', () => {
    // Well-shaped, and past the 4096-character cap — the cap is what rejects this one.
    const huge = `${'a'.repeat(5000)}.${'b'.repeat(8)}.${'c'.repeat(8)}`;
    const res = render({ state: 'success', token: huge });
    expect(deepLink(res.body)).toBe('jobblo://oauth-success?error=oauth_failed');
    expect(res.body).not.toContain('aaaa');
  });

  it('drops a token that arrives alongside an error state', () => {
    const res = render({ state: 'error', code: 'vipps_cancelled', token: TOKEN });
    expect(res.statusCode).toBe(200);
    expect(deepLink(res.body)).toBe('jobblo://oauth-success?error=vipps_cancelled');
    expect(res.body).not.toContain(TOKEN);
  });

  it('passes a known error code through and generalises anything else', () => {
    expect(deepLink(render({ state: 'error', code: 'google_account_exists' }).body)).toBe(
      'jobblo://oauth-success?error=google_account_exists'
    );
    expect(deepLink(render({ state: 'error', code: 'boom: <b>x</b>' }).body)).toBe(
      'jobblo://oauth-success?error=oauth_failed'
    );
  });

  it('answers 400 for a request carrying nothing usable', () => {
    const res = render({});
    expect(res.statusCode).toBe(400);
    expect(deepLink(res.body)).toBe('jobblo://oauth-success?error=oauth_failed');
  });

  it('is a hand-off to the app, not a general web redirector', () => {
    process.env.MOBILE_APP_LINK_PREFIX = 'https://evil.example/';
    const res = render({ state: 'success', token: TOKEN });

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('evil.example');
    expect(res.body).not.toContain(TOKEN);
    // No link at all, so no script either: there is nothing safe to hand off to.
    expect(res.body).not.toContain('<script');
    expect(error).toHaveBeenCalled();
  });

  it('rejects a prefix that is not a scheme, and completes one that is', () => {
    expect(resolveAppLinkPrefix().prefix).toBe('jobblo://');
    process.env.MOBILE_APP_LINK_PREFIX = 'exp://192.168.1.5:8081/--';
    expect(resolveAppLinkPrefix().prefix).toBe('exp://192.168.1.5:8081/--/');
    expect(deepLink(render({ state: 'success', token: TOKEN }).body)).toBe(
      `exp://192.168.1.5:8081/--/oauth-success?token=${TOKEN}`
    );

    process.env.MOBILE_APP_LINK_PREFIX = 'jobblo:/ /"onmouseover="x';
    expect(resolveAppLinkPrefix().error).toMatch(/MOBILE_APP_LINK_PREFIX/);
  });
});
describe('the start endpoints are not allowed to be replayed from cache', () => {
  it('forbids storing the authorization redirect', () => {
    const res = makeRes();
    noStore(res);
    expect(res.headers['Cache-Control']).toBe('no-store, max-age=0');
    expect(res.headers.Pragma).toBe('no-cache');
  });

  /** Cache hygiene on a redirect is not worth a 500 in the middle of somebody's sign-in. */
  it('does nothing at all for a response that cannot set headers', () => {
    expect(() => noStore({})).not.toThrow();
    expect(() => noStore(null)).not.toThrow();
  });
});

describe('no return URL is ever taken from the caller', () => {
  const read = (...parts) =>
    stripComments(fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8'));

  const sources = {
    'utils/oauthReturn.js': read('utils', 'oauthReturn.js'),
    'routes/auth.js': read('routes', 'auth.js'),
    'controllers/vippsController.js': read('controllers', 'vippsController.js'),
  };

  /**
   * The open redirect this design exists to avoid: a client-supplied destination on a
   * provider start endpoint, arriving back with Google as the referrer and an access token
   * in the query string. The platform enum is the whole vocabulary.
   */
  it.each(Object.keys(sources))('%s reads no destination from the request', (name) => {
    // `redirect_uri` is untouched on purpose: that one is the provider's own HTTPS callback
    // on this server, registered in the Google and Vipps portals. What must never appear is
    // a *client-supplied* destination, whatever it is called.
    expect(sources[name]).not.toMatch(/return_?[uU]rl/);
    expect(sources[name]).not.toMatch(/redirect_?[uU]rl/);
    expect(sources[name]).not.toMatch(/callback_?[uU]rl\s*[:=]\s*req/);
    expect(sources[name]).not.toMatch(/req\.query\.(returnTo|next|dest|url)/);
  });

  it('both provider start endpoints refuse caching', () => {
    expect(sources['routes/auth.js']).toMatch(/router\.get\('\/google'[\s\S]{0,400}noStore\(res\)/);
    expect(sources['controllers/vippsController.js']).toMatch(
      /redirectToVipps[\s\S]{0,200}noStore\(res\)/
    );
  });

  it('the callbacks read the platform through takeOAuthPlatform and not from the query', () => {
    expect(sources['routes/auth.js']).toMatch(
      /google\/callback'[\s\S]{0,200}takeOAuthPlatform\(req\)/
    );
    expect(sources['controllers/vippsController.js']).toMatch(/takeOAuthPlatform\(req\)/);
    for (const name of ['routes/auth.js', 'controllers/vippsController.js']) {
      expect(sources[name]).not.toMatch(/query\.platform/);
    }
  });
});
