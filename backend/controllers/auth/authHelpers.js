const User = require('../../models/User');
const crypto = require('crypto');
const { SENSITIVE_STRIP } = require('../../utils/userProjections');

/** Shared auth helpers: password rules, emailed codes, cookies, sanitizers, register validation. */

/**
 * Mirrors the client-side rule in frontend/src/utils/validationLogic.ts.
 *
 * The backend only ever checked length >= 8, so anything that wasn't the browser
 * form — curl, a script, a mobile client — could create "aaaaaaaa" accounts. The
 * strength requirement is only real if the server enforces it too.
 */
const validatePasswordStrength = (password) => {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Passordet må være minst 8 tegn.';
  }
  if (!/[a-zæøå]/.test(password)) return 'Passordet må inneholde minst én liten bokstav.';
  if (!/[A-ZÆØÅ]/.test(password)) return 'Passordet må inneholde minst én stor bokstav.';
  if (!/\d/.test(password)) return 'Passordet må inneholde minst ett tall.';
  return null;
};

// ── Emailed 6-digit codes (forgot password, change password) ──────────────────
const MAX_OTP_ATTEMPTS = 5;
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const newOtp = () => String(crypto.randomInt(100000, 1000000));
const CLEAR_RESET_STATE = {
  $unset: {
    passwordResetToken: 1,
    passwordResetExpires: 1,
    passwordResetAttempts: 1,
    passwordResetSessionToken: 1,
    passwordResetSessionExpires: 1,
  },
};

/** Store a fresh code for the user (replacing any older one) and return it to email. */
async function issueOtp(userId) {
  const otp = newOtp();
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        passwordResetToken: sha256(otp),
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
        passwordResetAttempts: 0,
      },
      $unset: { passwordResetSessionToken: 1, passwordResetSessionExpires: 1 },
    }
  );
  return otp;
}

/**
 * Check a guess against the user's pending code. Every guess atomically spends one of
 * MAX_OTP_ATTEMPTS on the ACCOUNT (an IP limit alone falls to rotating IPs), and the
 * last miss deletes the code, so a 6-digit code cannot be brute-forced.
 */
async function checkOtp(userFilter, otp) {
  const counted = await User.findOneAndUpdate(
    {
      ...userFilter,
      passwordResetToken: { $type: 'string' },
      passwordResetExpires: { $gt: new Date() },
      passwordResetAttempts: { $not: { $gte: MAX_OTP_ATTEMPTS } },
    },
    { $inc: { passwordResetAttempts: 1 } },
    { new: true }
  ).select('+passwordResetToken +passwordResetAttempts');
  if (!counted) return null;

  const given = Buffer.from(sha256(otp));
  const stored = Buffer.from(counted.passwordResetToken);
  if (given.length === stored.length && crypto.timingSafeEqual(given, stored)) return counted;

  if (counted.passwordResetAttempts >= MAX_OTP_ATTEMPTS) {
    await User.updateOne({ _id: counted._id, passwordResetToken: counted.passwordResetToken }, CLEAR_RESET_STATE);
  }
  return null;
}

const isProduction = process.env.NODE_ENV === 'production';

const accessCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 60 * 60 * 1000, // 1 hour
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const clearCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
};

const allowedRoles = ['user', 'company'];
const CURRENT_TERMS_VERSION = '2026-01-08';

const sanitizeUser = (user) => {
  if (!user) return null;
  const userObject = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  for (const key of SENSITIVE_STRIP) delete userObject[key];
  delete userObject.bankAccountNumber;
  delete userObject.iban;
  delete userObject.bicSwift;
  delete userObject.vippsHandle;
  return userObject;
};

const sanitizeSession = (session, currentSessionId) => {
  const sessionObject = typeof session.toObject === 'function' ? session.toObject() : session;

  delete sessionObject.refreshToken;
  delete sessionObject.oldRefreshToken;
  delete sessionObject.__v;

  return {
    ...sessionObject,
    isCurrent: sessionObject._id?.toString() === currentSessionId?.toString(),
  };
};

const sendServerError = (res, error, context = 'Server error') => {
  console.error(context, error);

  return res.status(500).json({
    error: isProduction ? 'Something went wrong' : error.message,
  });
};

const validateRegisterInput = ({
  name,
  email,
  password,
  role,
  companyName,
  orgNumber,
  acceptedTerms,
}) => {
  // If role is company, we use companyName as the primary name
  const effectiveName = role === 'company' ? companyName : name;

  if (!effectiveName || !email || !password) {
    return 'Name, email and password are required';
  }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Valid email is required';
  }

  const passwordError = validatePasswordStrength(password);
  if (passwordError) return passwordError;

  if (role && !allowedRoles.includes(role)) {
    return 'Invalid role';
  }

  if (role === 'company') {
    if (!companyName) {
      return 'Company name is required';
    }

    if (!orgNumber || !/^\d{9}$/.test(String(orgNumber))) {
      return 'Organization number must be exactly 9 digits';
    }
  }

  if (acceptedTerms !== true) {
    return 'Du må godta Brukervilkårene for å opprette konto.';
  }

  return null;
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, accessCookieOptions);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions);
};

exports.validateRegisterInput = validateRegisterInput;
// Read by the developer console's privacy page (users on outdated terms).
exports.CURRENT_TERMS_VERSION = CURRENT_TERMS_VERSION;

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', clearCookieOptions);
  res.clearCookie('refreshToken', clearCookieOptions);
};

Object.assign(exports, { validatePasswordStrength, MAX_OTP_ATTEMPTS, sha256, newOtp, CLEAR_RESET_STATE, issueOtp, checkOtp, isProduction, accessCookieOptions, refreshCookieOptions, clearCookieOptions, allowedRoles, CURRENT_TERMS_VERSION, sanitizeUser, sanitizeSession, sendServerError, validateRegisterInput, setAuthCookies, clearAuthCookies });
