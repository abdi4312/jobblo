// Client IP must come from X-Forwarded-For only when a private/loopback proxy sent it.
const express = require('express');
const request = require('supertest');

function appWith(trust) {
  const app = express();
  app.set('trust proxy', trust);
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  return app;
}

test('a loopback proxy (nginx on the host) is trusted for the client IP', async () => {
  const res = await request(appWith('loopback')).get('/ip').set('X-Forwarded-For', '203.0.113.9');
  // supertest connects over loopback, i.e. like nginx on 127.0.0.1
  expect(res.body.ip).toBe('203.0.113.9');
});

test('only the hop added by the trusted proxy is used, not client-forged entries', async () => {
  const res = await request(appWith('loopback')).get('/ip').set('X-Forwarded-For', '6.6.6.6, 203.0.113.9');
  expect(res.body.ip).toBe('203.0.113.9');
});

test('the default trusts only the local nginx — not the internet, not other private hosts', () => {
  const compile = require('proxy-addr').compile(['loopback']);
  expect(compile('127.0.0.1', 0)).toBe(true);
  expect(compile('::1', 0)).toBe(true);
  expect(compile('8.8.8.8', 0)).toBe(false);
  expect(compile('10.1.2.3', 0)).toBe(false);
  expect(compile('172.18.0.5', 0)).toBe(false);
});
