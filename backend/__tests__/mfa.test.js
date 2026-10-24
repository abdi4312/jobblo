jest.mock('../models/Session', () => ({ findOne: jest.fn() }));
jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../utils/tokenUtils', () => ({ verifyToken: jest.fn(() => ({ id: 'u1', sid: 's1' })), deviceNameFrom: () => null }));

const Session = require('../models/Session');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');
const mfa = require('../services/auth/mfa');

describe('TOTP (RFC 6238 test vectors, SHA-1)', () => {
  const secret = Buffer.from('12345678901234567890');
  it('produces the published codes (last 6 digits)', () => {
    expect(mfa.codeAt(secret, Math.floor(59 / 30))).toBe('287082');
    expect(mfa.codeAt(secret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(mfa.codeAt(secret, Math.floor(1234567890 / 30))).toBe('005924');
  });
  it('accepts ±1 step, refuses replays and junk', () => {
    const now = 1234567890 * 1000;
    const step = Math.floor(1234567890 / 30);
    expect(mfa.verifyCode(secret, '005924', { now })).toBe(step);
    expect(mfa.verifyCode(secret, mfa.codeAt(secret, step - 1), { now })).toBe(step - 1);
    expect(mfa.verifyCode(secret, mfa.codeAt(secret, step - 3), { now })).toBeNull();
    expect(mfa.verifyCode(secret, '005924', { now, lastStep: step })).toBeNull(); // replay
    expect(mfa.verifyCode(secret, '12345', { now })).toBeNull();
  });
  it('base32 round-trips (authenticator apps read base32)', () => {
    expect(mfa.base32Encode(secret)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(mfa.base32Decode('gezd gnbv gy3t qojq gezd gnbv gy3t qojq').equals(secret)).toBe(true);
  });
  it('encrypts secrets at rest and hashes one-time backup codes', () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    const enc = mfa.encrypt(secret);
    expect(enc).not.toContain(secret.toString('base64'));
    expect(mfa.decrypt(enc).equals(secret)).toBe(true);
    const { codes, hashes } = mfa.newBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(hashes[0]).toBe(mfa.hashBackup(codes[0].toLowerCase().replace('-', ' ')));
  });
});

describe('authenticate: superAdmin/developer need a verified session', () => {
  const run = async (role, { verified = false, enabled = true, path = '/api/developer/overview' } = {}) => {
    Session.findOne.mockResolvedValue({ save: jest.fn(), mfaVerifiedAt: verified ? new Date() : null });
    User.findById.mockReturnValue({ select: () => Promise.resolve({ _id: 'u1', role, mfaEnabledAt: enabled ? new Date() : null }) });
    const req = { cookies: { accessToken: 't' }, headers: {}, originalUrl: path };
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, clearCookie() {} };
    const next = jest.fn();
    await authenticate(req, res, next);
    return { status: next.mock.calls.length ? 'next' : res.statusCode, body: res.body };
  };
  it('blocks an unverified admin or developer session everywhere but the 2FA screens', async () => {
    expect(await run('superAdmin')).toMatchObject({ status: 403, body: { code: 'MFA_REQUIRED', setup: false } });
    expect(await run('developer', { enabled: false })).toMatchObject({ status: 403, body: { setup: true } });
    expect((await run('superAdmin', { path: '/api/auth/mfa/verify' })).status).toBe('next');
    expect((await run('superAdmin', { path: '/api/auth/profile?x=1' })).status).toBe('next');
    expect((await run('superAdmin', { path: '/api/auth/mfa-bypass' })).status).toBe(403);
  });
  it('lets verified sessions and normal users through', async () => {
    expect((await run('superAdmin', { verified: true })).status).toBe('next');
    expect((await run('user')).status).toBe('next');
  });
});
