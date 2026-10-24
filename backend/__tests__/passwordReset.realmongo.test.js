/**
 * Password reset / OTP hardening against a REAL MongoDB (the attempt counter and $unset
 * semantics are what is being proven, so mocks would not do).
 * Opt-in: SAFEPAY_REAL_MONGO_URI=mongodb://127.0.0.1:27017/jobblo-auth-test npx jest passwordReset
 * The database name must end in "-test"; it is dropped afterwards.
 */
jest.mock('../utils/emailService', () => ({ sendOtpEmail: jest.fn() }));

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { sendOtpEmail } = require('../utils/emailService');
const User = require('../models/User');
const Session = require('../models/Session');
const auth = require('../controllers/authController');
const { updateUser } = require('../controllers/userController');

const uri = process.env.SAFEPAY_REAL_MONGO_URI;
const run = uri && /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/[\w-]+-test(\?.*)?$/.test(uri) ? describe : describe.skip;

const call = async (handler, req) => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie() { return this; },
    clearCookie() { return this; },
  };
  await handler({ headers: {}, cookies: {}, ...req }, res);
  return res;
};
const lastOtp = () => sendOtpEmail.mock.calls.at(-1)[1];
const NEW_PASSWORD = 'NyttPassord1';

run('password reset and OTP hardening (real MongoDB)', () => {
  let user;

  beforeAll(async () => {
    await mongoose.connect(uri, { dbName: 'jobblo-test-password-reset' }); // own db: suites drop it in parallel
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  beforeEach(async () => {
    jest.clearAllMocks();
    await User.deleteMany({});
    await Session.deleteMany({});
    user = await User.create({
      name: 'Kari',
      email: 'kari@example.test',
      password: await bcrypt.hash('GammeltPassord1', 4),
    });
  });

  it('answers forgot-password identically for an unknown address and sends nothing', async () => {
    const known = await call(auth.forgotPassword, { body: { email: 'kari@example.test' } });
    const unknown = await call(auth.forgotPassword, { body: { email: 'nobody@example.test' } });
    expect(unknown.statusCode).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(sendOtpEmail).toHaveBeenCalledTimes(1);
    expect(lastOtp()).toMatch(/^\d{6}$/);
  });

  it('never accepts the emailed 6-digit code as a reset token', async () => {
    await call(auth.forgotPassword, { body: { email: 'kari@example.test' } });
    const res = await call(auth.resetPassword, { body: { resetToken: lastOtp(), password: NEW_PASSWORD } });
    expect(res.statusCode).toBe(400);
  });

  it('deletes the code after 5 wrong guesses, so the right code no longer works', async () => {
    await call(auth.forgotPassword, { body: { email: 'kari@example.test' } });
    const otp = lastOtp();
    const wrong = otp === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i += 1) {
      expect((await call(auth.verifyOtp, { body: { email: 'kari@example.test', otp: wrong } })).statusCode).toBe(400);
    }
    expect((await call(auth.verifyOtp, { body: { email: 'kari@example.test', otp } })).statusCode).toBe(400);
    const stored = await User.findById(user._id).select('+passwordResetToken').lean();
    expect(stored.passwordResetToken).toBeUndefined();
  });

  it('resets once with the verify-otp token, clears all reset state and signs out everywhere', async () => {
    await Session.create({
      userId: user._id, refreshToken: 'r1', ip: '1', userAgent: 'x', device: 'd', browser: 'b', os: 'o',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await call(auth.forgotPassword, { body: { email: 'kari@example.test' } });
    const otp = lastOtp();
    const verified = await call(auth.verifyOtp, { body: { email: 'kari@example.test', otp } });
    expect(verified.statusCode).toBe(200);
    // The code is spent once verified.
    expect((await call(auth.verifyOtp, { body: { email: 'kari@example.test', otp } })).statusCode).toBe(400);

    const body = { resetToken: verified.body.resetToken, password: NEW_PASSWORD };
    expect((await call(auth.resetPassword, { body })).statusCode).toBe(200);
    expect((await call(auth.resetPassword, { body })).statusCode).toBe(400);

    const stored = await User.findById(user._id)
      .select('+password +passwordResetToken +passwordResetSessionToken +passwordResetAttempts').lean();
    expect(await bcrypt.compare(NEW_PASSWORD, stored.password)).toBe(true);
    expect(stored.passwordResetToken).toBeUndefined();
    expect(stored.passwordResetSessionToken).toBeUndefined();
    expect(stored.passwordResetAttempts).toBeUndefined();
    expect(await Session.countDocuments({ userId: user._id })).toBe(0);
  });

  it('change-password via code keeps this device signed in and signs out the others', async () => {
    const base = { userId: user._id, ip: '1', userAgent: 'x', device: 'd', browser: 'b', os: 'o', expiresAt: new Date(Date.now() + 60_000) };
    const current = await Session.create({ ...base, refreshToken: 'mine' });
    await Session.create({ ...base, refreshToken: 'intruder' });
    const req = { userId: user._id, user: { _id: user._id }, sessionId: current._id };

    await call(auth.changePasswordSendOtpNoPassword, req);
    const res = await call(auth.changePasswordVerifyOtp, { ...req, body: { otp: lastOtp(), newPassword: NEW_PASSWORD } });
    expect(res.statusCode).toBe(200);
    expect((await Session.find({ userId: user._id }).lean()).map((s) => s.refreshToken)).toEqual(['mine']);
  });

  it('logout with only a Bearer session (mobile, no cookie) ends that session server-side', async () => {
    const base = { userId: user._id, ip: '1', userAgent: 'x', device: 'd', browser: 'b', os: 'o', expiresAt: new Date(Date.now() + 60_000) };
    const phone = await Session.create({ ...base, refreshToken: 'phone' });
    await Session.create({ ...base, refreshToken: 'laptop' });
    const res = await call(auth.logout, { userId: user._id, sessionId: phone._id });
    expect(res.statusCode).toBe(200);
    expect((await Session.find({ userId: user._id }).lean()).map((s) => s.refreshToken)).toEqual(['laptop']);
  });

  it('requires the current password to change the login e-mail', async () => {
    const req = (body) => ({ params: { id: String(user._id) }, userId: String(user._id), user: { role: 'user' }, body });
    expect((await call(updateUser, req({ email: 'ny@example.test' }))).statusCode).toBe(403);
    expect((await call(updateUser, req({ email: 'ny@example.test', currentPassword: 'feil' }))).statusCode).toBe(403);
    const ok = await call(updateUser, req({ email: 'ny@example.test', currentPassword: 'GammeltPassord1' }));
    expect(ok.statusCode).toBe(200);
    expect(ok.body.email).toBe('ny@example.test');
    // Other fields still save without a password.
    expect((await call(updateUser, req({ bio: 'hei', email: 'ny@example.test' }))).statusCode).toBe(200);
  });
});
