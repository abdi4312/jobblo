const crypto = require('crypto');

/**
 * Authenticated encryption (AES-256-GCM) for small secrets kept at rest: authenticator-app
 * secrets (services/auth/mfa.js) and one-time codes inside queued jobs (services/queue).
 *
 * Key: MFA_ENCRYPTION_KEY (32 bytes, hex or base64). Without it the key is derived from
 * JWT_SECRET with HKDF, separately per `purpose`, so one purpose's key never decrypts
 * another's. ponytail: with the derived key, rotating JWT_SECRET makes stored secrets
 * unreadable (admins re-enrol their authenticator) — set MFA_ENCRYPTION_KEY in production.
 */
function keyFor(purpose) {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (raw) {
    const k = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (k.length !== 32) throw new Error('MFA_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64).');
    // A purpose-specific subkey from the configured key, too.
    return purpose === 'totp-secret' ? k : Buffer.from(crypto.hkdfSync('sha256', k, 'jobblo-secretbox', purpose, 32));
  }
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return Buffer.from(crypto.hkdfSync('sha256', process.env.JWT_SECRET, 'jobblo-mfa', purpose, 32));
}

function createBox(purpose) {
  return {
    seal(value) {
      const buf = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', keyFor(purpose), iv);
      const data = Buffer.concat([cipher.update(buf), cipher.final()]);
      return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
    },
    /** Buffer out; throws if the value was tampered with or sealed for another purpose. */
    open(sealed) {
      const [v, iv, tag, data] = String(sealed).split(':');
      if (v !== 'v1') throw new Error('Unknown sealed value format');
      const d = crypto.createDecipheriv('aes-256-gcm', keyFor(purpose), Buffer.from(iv, 'base64'));
      d.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]);
    },
  };
}

module.exports = { createBox };
