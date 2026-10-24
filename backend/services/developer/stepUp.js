const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Step-up authentication for sensitive developer actions: a 6-digit code emailed to the
 * account address yields a 10-minute token bound to this user AND login session, sent as
 * X-Step-Up-Token. A stolen session cookie alone is therefore not enough.
 */

const OTP_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_S = 10 * 60;
const MAX_ATTEMPTS = 5;
const PURPOSE = 'dev-step-up';

const hashCode = (code) => crypto.createHmac('sha256', process.env.JWT_SECRET || 'step-up').update(String(code)).digest('hex');
const fail = (message, status) => Object.assign(new Error(message), { status });

async function sendCode(user) {
  const StepUpOtp = require('../../models/StepUpOtp');
  const now = Date.now();
  const [recent, lastHour] = await Promise.all([
    StepUpOtp.findOne({ userId: user._id, createdAt: { $gte: new Date(now - 60 * 1000) } }).lean(),
    StepUpOtp.countDocuments({ userId: user._id, createdAt: { $gte: new Date(now - 60 * 60 * 1000) } }),
  ]);
  if (recent) throw fail('Wait a minute before requesting another code.', 429);
  if (lastHour >= 5) throw fail('Too many codes requested. Try again later.', 429);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await StepUpOtp.deleteMany({ userId: user._id });
  await StepUpOtp.create({ userId: user._id, codeHash: hashCode(code), expiresAt: new Date(now + OTP_TTL_MS) });
  try {
    // Delivered synchronously: a failed send must delete the code and tell the developer now.
    await require('../../utils/emailService').deliverOtpEmail(user.email, code, user.name);
  } catch {
    await StepUpOtp.deleteMany({ userId: user._id });
    throw fail('Could not send the code by email. Check the SMTP settings.', 502);
  }
}

async function verifyCode(user, sessionId, code) {
  const StepUpOtp = require('../../models/StepUpOtp');
  if (!/^\d{6}$/.test(String(code || ''))) throw fail('Enter the 6-digit code.', 400);
  const otp = await StepUpOtp.findOne({ userId: user._id, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!otp) throw fail('No valid code. Request a new one.', 400);
  if (otp.attempts >= MAX_ATTEMPTS) throw fail('Too many wrong attempts. Request a new code.', 429);
  const ok = crypto.timingSafeEqual(Buffer.from(otp.codeHash, 'hex'), Buffer.from(hashCode(code), 'hex'));
  if (!ok) {
    otp.attempts += 1;
    await otp.save();
    throw fail(`Wrong code. ${MAX_ATTEMPTS - otp.attempts} attempt(s) left.`, 400);
  }
  await StepUpOtp.deleteMany({ userId: user._id });
  return {
    token: jwt.sign({ sub: String(user._id), sid: String(sessionId), purpose: PURPOSE }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL_S }),
    expiresAt: new Date(Date.now() + TOKEN_TTL_S * 1000),
  };
}

/** Express guard: a valid step-up token for this user + session. */
function requireStepUp(req, res, next) {
  const token = req.get('x-step-up-token');
  const deny = (message) => res.status(401).json({ success: false, message, code: 'STEP_UP_REQUIRED' });
  if (!token) return deny('Confirm with a one-time code first.');
  try {
    const c = jwt.verify(token, process.env.JWT_SECRET);
    if (c.purpose !== PURPOSE || c.sub !== String(req.user._id) || c.sid !== String(req.sessionId)) throw new Error('mismatch');
    return next();
  } catch {
    return deny('Your confirmation expired. Request a new code.');
  }
}

module.exports = { sendCode, verifyCode, requireStepUp, hashCode };
