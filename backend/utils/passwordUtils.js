const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Password handling for accounts that have no password.
 *
 * `User.password` is `required: true`, so an OAuth-created account has to put
 * *something* in the field. What went in was a placeholder that looked like a
 * credential:
 *
 *   config/passport.js          password: 'oauth-user'      // a literal constant
 *   controllers/vippsController password: crypto.randomBytes(16).toString('hex')
 *   controllers/iduraAuth…      password: 'oauth-user'      // (route disabled)
 *
 * None of those is a bcrypt hash, and `bcrypt.compare(plaintext, notAHash)` returns
 * false rather than throwing (verified against bcryptjs 2.4.3), so none of them can
 * be used to log in *today*. The problem is that they are one careless change away
 * from being live credentials:
 *
 *   - 'oauth-user' is a constant shared by every Google account on the platform. The
 *     obvious "we should hash these" migration — bcrypt.hash(user.password) — would
 *     hand every one of those accounts the working password `oauth-user`.
 *   - the Vipps value is random, but it is still a plaintext secret sitting in the
 *     database, and a migration that hashed it would create a real password nobody
 *     asked for.
 *
 * The fix is to store something that is a valid bcrypt hash — so nothing downstream
 * has to special-case it — of a value nobody knows and nobody kept. 32 random bytes
 * are hashed and discarded. There is no plaintext that verifies against the result,
 * which is what "unusable" means here. Users who want a password use the existing
 * forgot-password flow, which sets a real one.
 */

/** Cost factor used everywhere else in the codebase (authController, adminController). */
const BCRYPT_ROUNDS = 12;

/**
 * A bcrypt hash of 32 random bytes that are immediately thrown away.
 *
 * Returns a normal 60-character bcrypt hash, so `bcrypt.compare` treats it like any
 * other stored password and simply never matches.
 */
async function createUnusablePassword() {
  // 64 hex characters — comfortably under bcrypt's 72-byte input truncation, so the
  // full random value contributes to the digest.
  const secret = crypto.randomBytes(32).toString('hex');
  return bcrypt.hash(secret, BCRYPT_ROUNDS);
}

/**
 * Is this stored value actually a bcrypt hash?
 *
 * Used by the login path as a defence in depth: a stored value that is not a hash
 * cannot have come from `bcrypt.hash`, so it is a placeholder or corrupted data and
 * must never be treated as a credential — whatever a future bcrypt version decides
 * to do when asked to compare against it.
 */
function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

module.exports = { createUnusablePassword, isBcryptHash, BCRYPT_ROUNDS };
