/**
 * CSRF guard (middleware/csrfOrigin.js).
 *
 * Auth cookies are SameSite=None in production, the API parses urlencoded and multipart
 * bodies, and authenticate() reads the cookie before the Bearer header — so a form on
 * any website could POST/PUT/DELETE as the signed-in victim. CORS only hid the response.
 *
 * The app below mirrors app.js's order: Stripe webhook (raw body) first, then CORS,
 * the guard, body parsers, and handlers that record whether they ran (a stand-in for a
 * database write / Stripe call).
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const request = require('supertest');
const { createCsrfOriginGuard } = require('../middleware/csrfOrigin');

const FRONTEND = 'https://jobblo.no';
const WWW = 'https://www.jobblo.no';
const EVIL = 'https://evil.example';
const VICTIM_COOKIES = 'accessToken=victim-at; refreshToken=victim-rt; connect.sid=s%3Avictim';

let writes;
function buildApp() {
  const allowed = [FRONTEND, WWW];
  const app = express();
  app.set('trust proxy', 1);
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    // Stand-in for webhookDispatcher: signature check is its job, not the guard's.
    if (req.headers['stripe-signature'] !== 't=1,v1=valid') return res.status(400).send('bad sig');
    writes.push('stripe-webhook');
    res.json({ received: true });
  });
  app.use(cors({ origin: (o, cb) => cb(null, !o || allowed.includes(o)), credentials: true }));
  app.use(createCsrfOriginGuard(allowed));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  const write = (name) => (req, res) => {
    writes.push(name);
    res.json({ ok: true, user: req.cookies.accessToken || req.headers.authorization || null });
  };
  const upload = multer({ storage: multer.memoryStorage() });
  app.post('/api/auth/login', write('login'));
  app.post('/api/auth/refresh-token', write('refresh'));
  app.post('/api/auth/logout', write('logout'));
  app.get('/api/auth/web/google/callback', write('google-callback'));
  app.get('/api/auth/web/vipps/callback', write('vipps-callback'));
  app.get('/api/auth/profile', write('profile-read'));
  app.post('/api/chats/:id/message', write('chat-message'));
  app.post('/api/services', upload.array('images', 6), write('create-service'));
  app.put('/api/services/:id', upload.array('images', 6), write('update-service'));
  app.patch('/api/admin/disputes/:id/status', write('dispute-status'));
  app.delete('/api/users/:id', write('delete-user'));
  app.post('/api/safepay-checkout/create-session', write('safepay-session'));
  app.post('/api/safepay-checkout/approve', write('safepay-approve'));
  app.post('/api/stripe/subscription/change', write('subscription-change'));
  app.post('/api/stripe/create-checkout-session', write('subscription-checkout'));
  return app;
}

const app = buildApp();
beforeEach(() => {
  writes = [];
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const rejected = (res) => {
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('CSRF_ORIGIN_REJECTED');
};

describe('legitimate traffic', () => {
  it('1. same-origin web request (jobblo.no -> jobblo.no/api)', async () => {
    const res = await request(app)
      .post('/api/chats/c1/message')
      .set('Origin', FRONTEND)
      .set('Sec-Fetch-Site', 'same-origin')
      .set('Cookie', VICTIM_COOKIES)
      .send({ text: 'hei' });
    expect(res.status).toBe(200);
    expect(writes).toEqual(['chat-message']);
  });

  it('2. approved cross-origin frontend (www) with credentials', async () => {
    const res = await request(app)
      .post('/api/safepay-checkout/create-session')
      .set('Origin', WWW)
      .set('Sec-Fetch-Site', 'same-site')
      .set('Cookie', VICTIM_COOKIES)
      .set('Authorization', 'Bearer web-at')
      .send({ orderId: 'o1' });
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(WWW);
  });

  it('8. Bearer-only mobile request (no Origin, no browser headers)', async () => {
    const res = await request(app)
      .post('/api/stripe/subscription/change')
      .set('Authorization', 'Bearer mobile-at')
      .send({ planId: 'p' });
    expect(res.status).toBe(200);
    expect(res.body.user).toBe('Bearer mobile-at');
  });

  it('9. mobile cookie-jar refresh and logout (native client, no Origin)', async () => {
    for (const p of ['/api/auth/refresh-token', '/api/auth/logout']) {
      const res = await request(app).post(p).set('Cookie', 'refreshToken=mobile-rt').send({});
      expect(res.status).toBe(200);
    }
    expect(writes).toEqual(['refresh', 'logout']);
  });

  it('9b. web session refresh and logout from the frontend', async () => {
    for (const p of ['/api/auth/refresh-token', '/api/auth/logout']) {
      const res = await request(app).post(p).set('Origin', FRONTEND).set('Cookie', VICTIM_COOKIES);
      expect(res.status).toBe(200);
    }
  });

  it('10/11. Google and Vipps OAuth callbacks (top-level GET from the provider) are untouched', async () => {
    for (const p of ['/api/auth/web/google/callback', '/api/auth/web/vipps/callback']) {
      const res = await request(app)
        .get(`${p}?code=c&state=s`)
        .set('Referer', 'https://accounts.google.com/')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Cookie', 'connect.sid=s%3Aflow');
      expect(res.status).toBe(200);
    }
  });

  it('12. a signed Stripe webhook is accepted (mounted before the guard)', async () => {
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Stripe-Signature', 't=1,v1=valid')
      .set('Content-Type', 'application/json')
      .send('{"id":"evt_1"}');
    expect(res.status).toBe(200);
    expect(writes).toEqual(['stripe-webhook']);
  });

  it('13. an invalid Stripe signature is still rejected by the webhook itself', async () => {
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Stripe-Signature', 't=1,v1=forged')
      .set('Origin', EVIL)
      .set('Content-Type', 'application/json')
      .send('{"id":"evt_1"}');
    expect(res.status).toBe(400);
    expect(writes).toEqual([]);
  });

  it('6b. no Origin but a trusted Referer, or same-origin fetch metadata, is accepted', async () => {
    expect((await request(app).post('/api/auth/logout').set('Referer', `${FRONTEND}/profile`)).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').set('Sec-Fetch-Site', 'same-origin')).status).toBe(200);
  });

  it('reads (GET) are not affected', async () => {
    const res = await request(app).get('/api/auth/profile').set('Origin', EVIL).set('Cookie', VICTIM_COOKIES);
    expect(res.status).toBe(200);
    // CORS still withholds the response from the attacker's page.
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('cross-site forgery is refused before any handler runs', () => {
  it('3. malicious-origin JSON POST with victim cookies', async () => {
    rejected(
      await request(app)
        .post('/api/chats/c1/message')
        .set('Origin', EVIL)
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Cookie', VICTIM_COOKIES)
        .send({ text: 'spam' })
    );
  });

  it('4. malicious-origin urlencoded form POST', async () => {
    rejected(
      await request(app)
        .post('/api/safepay-checkout/approve')
        .set('Origin', EVIL)
        .set('Cookie', VICTIM_COOKIES)
        .type('form')
        .send('orderId=o1&rating=5')
    );
  });

  it('5. malicious-origin multipart form POST', async () => {
    rejected(
      await request(app)
        .post('/api/services')
        .set('Origin', EVIL)
        .set('Cookie', VICTIM_COOKIES)
        .field('title', 'x')
        .attach('images', Buffer.from('img'), 'a.png')
    );
  });

  it('login CSRF: a cross-site form login is refused even without victim cookies', async () => {
    rejected(
      await request(app).post('/api/auth/login').set('Origin', EVIL).type('form').send('email=a@evil&password=x')
    );
  });

  it.each([
    ['null Origin (sandboxed iframe / data: URL)', { Origin: 'null' }],
    ['look-alike origin', { Origin: 'https://jobblo.no.evil.example' }],
    ['scheme downgrade', { Origin: 'http://jobblo.no' }],
    ['port variant', { Origin: 'https://jobblo.no:8443' }],
    ['no Origin, foreign Referer', { Referer: `${EVIL}/page` }],
    ['no Origin, look-alike Referer', { Referer: 'https://jobblo.no.evil.example/' }],
    ['no Origin, unparsable Referer', { Referer: 'not a url' }],
    ['no Origin, cross-site fetch metadata', { 'Sec-Fetch-Site': 'cross-site' }],
    ['no Origin, same-site (sibling subdomain) fetch metadata', { 'Sec-Fetch-Site': 'same-site' }],
  ])('6. %s', async (_label, headers) => {
    rejected(await request(app).post('/api/auth/logout').set(headers).set('Cookie', VICTIM_COOKIES));
  });

  it('7. forged Host / X-Forwarded-Host cannot make an evil Origin "same-origin"', async () => {
    rejected(
      await request(app)
        .post('/api/chats/c1/message')
        .set('Origin', EVIL)
        .set('Host', 'evil.example')
        .set('X-Forwarded-Host', 'evil.example')
        .set('X-Forwarded-Proto', 'https')
        .set('Cookie', VICTIM_COOKIES)
        .send({ text: 'x' })
    );
  });

  it('a Bearer header does not excuse a disallowed Origin', async () => {
    rejected(
      await request(app)
        .post('/api/stripe/subscription/change')
        .set('Origin', EVIL)
        .set('Authorization', 'Bearer stolen-or-not')
        .set('Cookie', VICTIM_COOKIES)
        .send({ planId: 'p' })
    );
  });

  it('14/15. SafePay and Subscription V2 mutations are refused cross-site', async () => {
    for (const p of [
      '/api/safepay-checkout/create-session',
      '/api/safepay-checkout/approve',
      '/api/stripe/subscription/change',
      '/api/stripe/create-checkout-session',
    ]) {
      rejected(await request(app).post(p).set('Origin', EVIL).set('Cookie', VICTIM_COOKIES).send({}));
    }
  });

  it('16. PUT, PATCH and DELETE get the same treatment', async () => {
    rejected(await request(app).put('/api/services/s1').set('Origin', EVIL).set('Cookie', VICTIM_COOKIES));
    rejected(await request(app).patch('/api/admin/disputes/d1/status').set('Origin', EVIL).set('Cookie', VICTIM_COOKIES));
    rejected(await request(app).delete('/api/users/u1').set('Origin', EVIL).set('Cookie', VICTIM_COOKIES));
  });

  afterEach(() => {
    // Nothing behind the guard ran: no DB write, no Stripe call.
    expect(writes).toEqual([]);
  });
});

describe('app.js wiring', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const at = (needle) => {
    const i = src.indexOf(needle);
    expect(i).toBeGreaterThan(-1);
    return i;
  };

  it('mounts the guard after the Stripe webhooks and before body parsers and every route', () => {
    const guard = at('createCsrfOriginGuard(allowedOrigins)');
    expect(at("app.post('/api/safepay-checkout/webhook'")).toBeLessThan(guard);
    expect(at("app.post('/api/stripe/webhook'")).toBeLessThan(guard);
    expect(guard).toBeLessThan(at('app.use(express.json('));
    expect(guard).toBeLessThan(at('app.use(express.urlencoded('));
    expect(guard).toBeLessThan(at("app.use('/api/auth', authRouter)"));
    expect(guard).toBeLessThan(at("app.use('/', previewRouter)"));
  });

  it('uses the same allowlist as CORS (no Host-derived origins)', () => {
    expect(src).toMatch(/createCsrfOriginGuard\(allowedOrigins\)/);
    expect(src).not.toMatch(/req\.(hostname|headers\.host)/);
  });
});
