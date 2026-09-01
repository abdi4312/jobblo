const crypto = require('crypto');

/**
 * The server-side half of a BankID authorization request.
 *
 * Everything the callback needs to verify itself lives here, in the session, and never
 * touches the browser: the `state`, the `nonce`, the PKCE `code_verifier`, what the
 * flow was for, and — for a linking flow — which Jobblo account the person was signed
 * in as when they started.
 *
 * That last field is the whole point. The account to link is decided at the START of
 * the flow, from an authenticated session, and is read back from the session at the
 * end. It is never taken from the callback query string and never derived from a
 * returned e-mail or name, because both of those are supplied by the far side of the
 * exchange. The old implementation linked on e-mail equality and marked the account
 * verified, which is an account-takeover path.
 *
 * ── Single use ─────────────────────────────────────────────────────────────────
 * `consume()` deletes the transaction before the caller does anything with it, on
 * every path — success, wrong state, expired, cancelled. A callback URL that is
 * captured (browser history, a referrer header, a shoulder-surfed address bar) is
 * therefore useless the second time it is presented: the transaction it names is
 * already gone, and the callback fails closed at the state check.
 */

/**
 * How long an authorization request may sit unanswered.
 *
 * BankID sessions involve reaching for a code device or a phone, so this is generous
 * compared with an ordinary OAuth hop — but it is bounded, because an indefinitely
 * valid transaction is an indefinitely valid replay window.
 */
const TRANSACTION_TTL_MS = 15 * 60 * 1000;

/** Where the transaction lives on the session object. One in flight at a time. */
const SESSION_KEY = 'iduraTransaction';

const INTENTS = Object.freeze({ LOGIN: 'login', LINK: 'link' });

/**
 * Store a new transaction, replacing any previous one.
 *
 * Replacing rather than accumulating: a person who starts BankID, abandons it and
 * starts again should have exactly one live transaction. Keeping a list would mean a
 * callback could be matched against a stale entry the user has moved on from.
 */
function startTransaction(req, { intent, jobbloUserId, state, nonce, codeVerifier }) {
  if (!req.session) {
    throw new Error('startTransaction requires a session');
  }
  if (!Object.values(INTENTS).includes(intent)) {
    throw new Error(`startTransaction: unknown intent ${intent}`);
  }
  if (intent === INTENTS.LINK && !jobbloUserId) {
    throw new Error('startTransaction: link intent requires an authenticated user id');
  }

  req.session[SESSION_KEY] = {
    intent,
    // Only set for a link flow. Recorded here, at the start, from `req.userId`.
    jobbloUserId: intent === INTENTS.LINK ? String(jobbloUserId) : null,
    state,
    nonce,
    codeVerifier,
    createdAt: Date.now(),
  };

  return req.session[SESSION_KEY];
}

/**
 * Read and destroy the pending transaction.
 *
 * Always returns after clearing, so there is no path on which a caller can read a
 * transaction and leave it usable. Callers must treat `null` as "fail closed".
 */
function consumeTransaction(req) {
  const pending = req.session?.[SESSION_KEY] || null;
  if (req.session) delete req.session[SESSION_KEY];
  return pending;
}

/** Drop any pending transaction without reading it — used when starting a fresh one. */
function clearTransaction(req) {
  if (req.session) delete req.session[SESSION_KEY];
}

/** Constant-time comparison; a length mismatch is itself a mismatch. */
function statesMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Is this consumed transaction a valid match for the callback's `state`?
 *
 * Returns a reason code rather than a boolean so the caller can log *why* without
 * inventing its own vocabulary, and so the tests can assert each failure separately.
 *
 * @returns {{ok: true}|{ok: false, reason: string}}
 */
function validateTransaction(pending, callbackState, now = Date.now()) {
  if (!pending) return { ok: false, reason: 'no_transaction' };
  if (!pending.state || !pending.nonce || !pending.codeVerifier) {
    return { ok: false, reason: 'incomplete_transaction' };
  }
  if (!callbackState) return { ok: false, reason: 'missing_state' };
  if (!statesMatch(String(callbackState), pending.state)) {
    return { ok: false, reason: 'invalid_state' };
  }
  if (now - (pending.createdAt || 0) > TRANSACTION_TTL_MS) {
    return { ok: false, reason: 'expired_state' };
  }
  if (pending.intent === INTENTS.LINK && !pending.jobbloUserId) {
    // A link transaction with no target cannot be completed safely — there is no
    // authenticated account to attach the identity to, and we will not guess one.
    return { ok: false, reason: 'missing_link_target' };
  }
  return { ok: true };
}

module.exports = {
  startTransaction,
  consumeTransaction,
  clearTransaction,
  validateTransaction,
  statesMatch,
  TRANSACTION_TTL_MS,
  SESSION_KEY,
  INTENTS,
};
