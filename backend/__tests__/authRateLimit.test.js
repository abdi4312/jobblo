const express = require('express');
const request = require('supertest');
const { authLimiter } = require('../middleware/rateLimiter');

/**
 * Regression guard for F-19 (rate limiting half).
 *
 * `authLimiter` used to allow 10 requests per IP per hour on login *and*
 * register, counting successes. A household, an office or a café shares one
 * public IP; behind a CDN or load balancer the entire user base does. Ten
 * ordinary sign-ins therefore locked everyone out for an hour — which on launch
 * day reads as a total outage, not as a security control.
 *
 * The limiter now counts only failures, so the budget is spent by whoever is
 * guessing passwords rather than by whoever knows theirs.
 */
function appWith(handler) {
  const app = express();
  app.use(express.json());
  app.post('/login', authLimiter, handler);
  return app;
}

describe('authLimiter', () => {
  it('never blocks users who log in successfully', async () => {
    const app = appWith((req, res) => res.status(200).json({ ok: true }));

    for (let i = 0; i < 30; i += 1) {
      const res = await request(app).post('/login').send({});
      expect(res.status).toBe(200);
    }
  });

  it('still stops password guessing, and says so in Norwegian', async () => {
    const app = appWith((req, res) => res.status(401).json({ error: 'Invalid credentials' }));

    let lastBlocked = null;
    let allowed = 0;

    for (let i = 0; i < 25; i += 1) {
      const res = await request(app).post('/login').send({});
      if (res.status === 429) lastBlocked = res.body;
      else allowed += 1;
    }

    expect(allowed).toBe(20);
    expect(lastBlocked).not.toBeNull();
    expect(lastBlocked.message).toMatch(/For mange mislykkede forsøk/);
    // The old copy promised an hour-long lockout and was English.
    expect(lastBlocked.message).not.toMatch(/hour|time/i);
  });
});
