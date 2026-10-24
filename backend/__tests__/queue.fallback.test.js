/**
 * The queue must never lose work or fail a request because Redis is missing or down:
 * without REDIS_URL jobs run in-process; with REDIS_URL pointing at a dead server the
 * enqueue times out and the job runs in-process instead.
 */
jest.mock('../services/pushNotifications', () => ({ deliverPush: jest.fn().mockResolvedValue(undefined) }));

const until = async (fn, ms = 6000) => {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
};

afterEach(async () => {
  await require('../config/redis').closeRedis();
  delete process.env.REDIS_URL;
  delete process.env.REDIS_IN_TESTS;
  jest.resetModules();
});

it('without Redis: runs the handler in-process, after the caller returns', async () => {
  delete process.env.REDIS_URL;
  const { enqueue } = require('../services/queue');
  const { deliverPush } = require('../services/pushNotifications');
  const r = await enqueue('push', 'send', { userId: 'u1', message: { title: 'x' } });
  expect(r).toEqual({ id: null, inline: true });
  await until(() => deliverPush.mock.calls.length === 1);
});

it('Redis configured but down: falls back to in-process within the enqueue timeout', async () => {
  process.env.REDIS_URL = 'redis://127.0.0.1:1'; // nothing listens on port 1
  process.env.REDIS_IN_TESTS = 'true';
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const { enqueue } = require('../services/queue');
  const { deliverPush } = require('../services/pushNotifications');
  const started = Date.now();
  const r = await enqueue('push', 'send', { userId: 'u2', message: {} });
  expect(r.inline).toBe(true);
  expect(Date.now() - started).toBeLessThan(4500);
  await until(() => deliverPush.mock.calls.length === 1);
}, 10000);

it('an unknown job is a programming error and throws', async () => {
  const { enqueue } = require('../services/queue');
  await expect(enqueue('push', 'nope', {})).rejects.toThrow(/No handler/);
  await expect(enqueue('nope', 'send', {})).rejects.toThrow(/No handler/);
});

it('OTP codes never sit in a job payload in clear text', async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const { sealOtp } = require('../services/queue/handlers');
  const sealed = sealOtp('123456');
  expect(sealed).not.toContain('123456');
  expect(require('../utils/secretBox').createBox('queued-otp').open(sealed).toString()).toBe('123456');
  // Sealed for the queue ≠ readable as an authenticator secret.
  expect(() => require('../utils/secretBox').createBox('totp-secret').open(sealed)).toThrow();
});

it('the console sees job data redacted: no codes, masked emails, push text reduced to its title', () => {
  const { redactJobData } = require('../services/queue/admin');
  expect(redactJobData({ to: 'kari.nord@example.no', name: 'Kari', otpSealed: 'v1:abc' })).toEqual({ to: expect.not.stringContaining('kari.nord'), name: 'Kari', otpSealed: '[hidden]' });
  expect(redactJobData({ userId: 'u1', message: { title: 'Ny melding', body: 'Hei, ring meg på 91234567', data: {} } })).toEqual({ userId: 'u1', message: { title: 'Ny melding', fields: ['title', 'body', 'data'] } });
  expect(redactJobData({ job: 'reconcileMoneyState' })).toEqual({ job: 'reconcileMoneyState' });
});
