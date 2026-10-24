const crypto = require('crypto');

/**
 * Authenticator-app two-factor login (TOTP, RFC 6238 — Google Authenticator, Microsoft
 * Authenticator, 1Password, …) for privileged roles. Built on node:crypto: TOTP is an
 * HMAC-SHA1 of a 30-second counter, no library needed.
 *
 * Enforcement lives in middleware/auth.js: a session of a superAdmin/developer is usable
 * only after `mfaVerifiedAt` is set on it by verify() below. Every login path (password,
 * Google, Vipps, BankID, mobile OAuth) ends in createSession(), so none can skip it.
 */

const MFA_ROLES = ['superAdmin', 'developer'];
const STEP_S = 30;
const DIGITS = 6;
const ISSUER = 'Jobblo';
const BACKUP_CODES = 10;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const requiresMfa = (user) => Boolean(user && MFA_ROLES.includes(user.role));

/** Pure: RFC 4648 base32 (no padding). Unit-tested. */
function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$|\s/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Pure: the 6-digit code for one 30 s step (RFC 4226 / 6238, HMAC-SHA1). Unit-tested. */
function codeAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', secret).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * Pure: the step a code matches (±1 step for clock drift), or null. A step at or before
 * `lastStep` is refused, so a code seen once cannot be replayed. Unit-tested.
 */
function verifyCode(secret, code, { now = Date.now(), lastStep = -1 } = {}) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const current = Math.floor(now / 1000 / STEP_S);
  for (const step of [current, current - 1, current + 1]) {
    if (step <= lastStep) continue;
    const expected = codeAt(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return step;
  }
  return null;
}

// Secret at rest: AES-256-GCM via utils/secretBox (key: MFA_ENCRYPTION_KEY, see there).
const box = require('../../utils/secretBox').createBox('totp-secret');
const encrypt = (buf) => box.seal(buf);
const decrypt = (str) => box.open(str);

const hashBackup = (code) => crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
function newBackupCodes() {
  const codes = Array.from({ length: BACKUP_CODES }, () => {
    const raw = base32Encode(crypto.randomBytes(5)).slice(0, 8);
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  return { codes, hashes: codes.map(hashBackup) };
}

const otpauthUrl = (secretB32, account) => `otpauth://totp/${encodeURIComponent(`${ISSUER}:${account}`)}?secret=${secretB32}&issuer=${ISSUER}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_S}`;

const SECRET_FIELDS = '+mfaSecret +mfaPendingSecret +mfaLastStep +mfaBackupCodes';

/** Start (or restart) enrolment: a new pending secret; the active one is untouched. */
async function startSetup(userId) {
  const User = require('../../models/User');
  const user = await User.findById(userId).select(`email role mfaEnabledAt ${SECRET_FIELDS}`);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (user.mfaEnabledAt) throw Object.assign(new Error('An authenticator is already set up. Ask a Super Admin to reset it if the phone is lost.'), { status: 409 });
  const secret = crypto.randomBytes(20);
  user.mfaPendingSecret = encrypt(secret);
  await user.save({ validateBeforeSave: false });
  const b32 = base32Encode(secret);
  return { secret: b32.replace(/(.{4})/g, '$1 ').trim(), otpauthUrl: otpauthUrl(b32, user.email) };
}

/**
 * Check a code (or a backup code) and mark the session as verified. During enrolment a
 * correct code activates the pending secret and returns the backup codes — shown once.
 */
async function verify(userId, sessionId, { code, backupCode }) {
  const User = require('../../models/User');
  const Session = require('../../models/Session');
  const user = await User.findById(userId).select(`email role mfaEnabledAt ${SECRET_FIELDS}`);
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  let backupCodes = null;
  if (!user.mfaEnabledAt) {
    if (!user.mfaPendingSecret) throw Object.assign(new Error('Start the authenticator setup first.'), { status: 400 });
    const step = verifyCode(decrypt(user.mfaPendingSecret), code);
    if (step === null) return { ok: false };
    const fresh = newBackupCodes();
    backupCodes = fresh.codes;
    Object.assign(user, { mfaSecret: user.mfaPendingSecret, mfaPendingSecret: null, mfaEnabledAt: new Date(), mfaLastStep: step, mfaBackupCodes: fresh.hashes });
  } else if (backupCode) {
    const h = hashBackup(backupCode);
    if (!(user.mfaBackupCodes || []).includes(h)) return { ok: false };
    user.mfaBackupCodes = user.mfaBackupCodes.filter((x) => x !== h); // one use each
  } else {
    const step = verifyCode(decrypt(user.mfaSecret), code, { lastStep: user.mfaLastStep ?? -1 });
    if (step === null) return { ok: false };
    user.mfaLastStep = step;
  }
  await user.save({ validateBeforeSave: false });
  await Session.updateOne({ _id: sessionId, userId }, { $set: { mfaVerifiedAt: new Date() } });
  return { ok: true, backupCodes, backupCodesLeft: (user.mfaBackupCodes || []).length };
}

/** Remove a user's authenticator (lost phone) and sign them out everywhere. */
async function reset(userId) {
  const User = require('../../models/User');
  await User.updateOne({ _id: userId }, { $set: { mfaSecret: null, mfaPendingSecret: null, mfaEnabledAt: null, mfaLastStep: null, mfaBackupCodes: [] } });
  await require('../../models/Session').deleteMany({ userId });
}

module.exports = { MFA_ROLES, requiresMfa, base32Encode, base32Decode, codeAt, verifyCode, encrypt, decrypt, hashBackup, newBackupCodes, otpauthUrl, startSetup, verify, reset };
