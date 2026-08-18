const User = require('../models/User');
const IdentityClaim = require('../models/IdentityClaim');
const { createSession } = require('../utils/tokenUtils');
const { createUnusablePassword } = require('../utils/passwordUtils');
const {
  isIduraConfigured,
  createTransactionSecrets,
  buildAuthorizationUrl,
  exchangeCode,
} = require('../config/iduraClient');
const {
  startTransaction,
  consumeTransaction,
  clearTransaction,
  validateTransaction,
  INTENTS,
} = require('../utils/iduraTransaction');
const {
  buildIdentityVerification,
  findNationalIdClaims,
  verifiedEmailFrom,
} = require('../utils/iduraIdentity');

/**
 * Norwegian BankID via Idura Verify — OpenID Connect authorization code + PKCE.
 *
 * This replaces `iduraAuthcontroller.js`, which was disabled behind a 410. That
 * implementation validated no `state`, sent no `nonce` and no PKCE, never requested or
 * verified an `id_token` (so nothing proved the assertion came from Idura at all),
 * posted to a bespoke `/auth/token` shape rather than the OIDC token endpoint, linked
 * to any account whose e-mail happened to match and then set `verified: true` on it,
 * and wrote the literal string 'oauth-user' into the password column.
 *
 * Nothing from it is reused. The flow here is:
 *
 *   start   → mint state + nonce + PKCE verifier, store them in the SESSION,
 *             redirect the browser to Idura with only the public halves
 *   callback→ consume the transaction (single use), match the state, exchange the code
 *             with the verifier, let openid-client validate signature/iss/aud/exp/nonce,
 *             then and only then touch an account
 *
 * Two intents share the machinery and differ in exactly one respect: which account the
 * verified identity ends up on.
 *
 *   link  — the account is the one whose session started the flow. Read from
 *           `req.userId` at START, held server-side, read back at the end.
 *   login — the account is the one already holding this `sub`. If none holds it, a new
 *           account may be created; an existing account is never adopted on the
 *           strength of a matching e-mail.
 */

/** Error codes handed to the frontend. Stable, opaque, and mapped to Norwegian there. */
const ERRORS = {
  UNAVAILABLE: 'bankid_unavailable',
  AUTH_REQUIRED: 'bankid_auth_required',
  CANCELLED: 'bankid_cancelled',
  INVALID_STATE: 'bankid_invalid_state',
  VERIFICATION_FAILED: 'bankid_verification_failed',
  IDENTITY: 'bankid_identity',
  ALREADY_LINKED: 'bankid_already_linked',
  ACCOUNT_EXISTS: 'bankid_account_exists',
  NO_EMAIL: 'bankid_no_email',
};

function frontendUrl(pathAndQuery) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${base}/${String(pathAndQuery).replace(/^\/+/, '')}`;
}

/**
 * Security logging.
 *
 * Records the reason and a correlation id, and nothing else. Deliberately absent: the
 * authorization code, the access token, the id_token, any claim value, the client
 * secret, and the issuer configuration. A log line should let an engineer see that
 * BankID callbacks are failing and why, without becoming a second place the identity
 * data lives.
 */
function logFailure(req, reason, extra = {}) {
  console.warn(
    'Idura callback failed: reason=%s requestId=%s%s',
    reason,
    req.id || req.requestId || '-',
    Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''
  );
}

// ── Start ──────────────────────────────────────────────────────────────────────

/**
 * `GET /api/auth/idura`         — sign in with BankID
 * `GET /api/auth/idura?link=1`  — attach BankID to the account already signed in
 *
 * The route runs `optionalAuthenticate`, so `req.userId` is present when the caller
 * has a valid session. A link request without one is refused here rather than being
 * quietly downgraded to a login: the person asked to verify *their* account, and
 * silently doing something else with a BankID identity is not an acceptable fallback.
 */
exports.startIduraAuth = async (req, res) => {
  const wantsLink = req.query.link === '1' || req.query.intent === 'link';

  /**
   * Where a failure sends them.
   *
   * A signed-in person verifying from their profile must go BACK to the profile. This
   * used to send every failure to `/login`, which looks harmless and is not: the
   * frontend wraps `/login` in `PublicRoute`, which redirects an already-authenticated
   * user to `/home`. The error parameter went with it, so a failed verification
   * silently dumped the user on the home page with no explanation at all — which is
   * exactly how the express-session collection collision presented.
   *
   * `bankid_auth_required` is the deliberate exception below: that caller is NOT signed
   * in, so `/login` is both correct and reachable.
   */
  const failureTarget = wantsLink && req.userId ? 'profile' : 'login';

  if (!isIduraConfigured()) {
    // Not an error condition in development — BankID simply is not set up here.
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.UNAVAILABLE}`));
  }

  if (!req.session) {
    // The transaction has nowhere to live, and an unbound state is not CSRF protection.
    logFailure(req, 'no_session_on_start');
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.VERIFICATION_FAILED}`));
  }

  if (wantsLink && !req.userId) {
    return res.redirect(frontendUrl(`login?error=${ERRORS.AUTH_REQUIRED}`));
  }

  try {
    // Any half-finished previous attempt is dropped, so exactly one is ever live.
    clearTransaction(req);

    const { state, nonce, codeVerifier, codeChallenge } = await createTransactionSecrets();

    startTransaction(req, {
      intent: wantsLink ? INTENTS.LINK : INTENTS.LOGIN,
      jobbloUserId: wantsLink ? req.userId : null,
      state,
      nonce,
      codeVerifier,
    });

    /**
     * Persist the session BEFORE redirecting.
     *
     * `express-session` normally saves at the end of the response, but a 302 can reach
     * the browser — and Idura can hand the browser straight back to the callback —
     * before that write completes. Waiting here removes a race that would look like a
     * random "invalid state" on a fast network.
     */
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    // Only the public halves leave the server: state, nonce and the S256 challenge.
    // The code_verifier stays in the session.
    const authorizationUrl = await buildAuthorizationUrl({ state, nonce, codeChallenge });
    return res.redirect(authorizationUrl.href);
  } catch (err) {
    logFailure(req, 'start_failed', { message: err.message });
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.VERIFICATION_FAILED}`));
  }
};

// ── Callback ───────────────────────────────────────────────────────────────────

/**
 * Claim a verified identity for exactly one account.
 *
 * `IdentityClaim._id` is the claim key, and `_id` is uniquely indexed on every
 * MongoDB-compatible store — including Cosmos, where a unique index cannot be added to
 * the already-populated `users` collection. Two concurrent callbacks for the same
 * subject therefore cannot both succeed: one inserts, the other gets E11000.
 *
 * Re-claiming for the same user is a no-op, so a person re-verifying (a new device, a
 * refreshed assurance level) is not blocked by their own previous claim.
 *
 * @returns {{ok: true}|{ok: false, reason: 'already_linked_elsewhere'}}
 */
async function claimIdentity(subject, userId) {
  const _id = IdentityClaim.keyFor('idura', 'no_bankid', subject);

  try {
    await IdentityClaim.create({ _id, userId, provider: 'idura', scheme: 'no_bankid' });
    return { ok: true };
  } catch (err) {
    if (err && err.code === 11000) {
      const existing = await IdentityClaim.findById(_id).lean();
      if (existing && String(existing.userId) === String(userId)) {
        return { ok: true }; // same person re-verifying
      }
      return { ok: false, reason: 'already_linked_elsewhere' };
    }
    throw err;
  }
}

/** Write the verified identity onto the account and derive the legacy flags from it. */
async function applyVerification(userId, identity) {
  return User.findByIdAndUpdate(
    userId,
    {
      $set: {
        identityVerification: identity,
        /**
         * `verified` and `accountStatus` are kept in step with `identityVerification`
         * rather than being set independently. They predate this feature and are read
         * all over the product (the job card's "Verified" chip, provider profiles), so
         * they stay — but `identityVerification` is the source of truth and these two
         * are derived from it, written only here and only after a full OIDC validation.
         */
        verified: true,
        accountStatus: 'verified',
      },
    },
    { new: true }
  );
}

/** Issue Jobblo's own session cookies and hand back the redirect target. */
async function completeLogin(req, res, user, target) {
  const { accessToken, refreshToken } = await createSession(req, user._id);

  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  };

  res.cookie('accessToken', accessToken, { ...cookie, maxAge: 60 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookie, maxAge: 7 * 24 * 60 * 60 * 1000 });

  return res.redirect(frontendUrl(`${target}?token=${accessToken}`));
}

exports.iduraCallback = async (req, res) => {
  /**
   * Consume the transaction FIRST, before anything else can go wrong.
   *
   * Every exit below — cancellation, bad state, invalid token, conflict, success —
   * therefore leaves no transaction behind, which is what makes a captured callback URL
   * useless on a second presentation. The old flow had no transaction to consume at
   * all; the Vipps flow it is modelled on used to delete its state only on success,
   * leaving a replayable value after every failure.
   */
  const pending = consumeTransaction(req);
  const { code, state, error: providerError } = req.query;

  const intent = pending?.intent;
  const failureTarget = intent === INTENTS.LINK ? 'profile' : 'login';

  if (!isIduraConfigured()) {
    return res.redirect(frontendUrl(`login?error=${ERRORS.UNAVAILABLE}`));
  }

  // The person pressed cancel at BankID, or Idura refused. Not a failure to report
  // loudly — but the transaction is gone, so a retry starts a fresh one.
  if (providerError) {
    logFailure(req, 'provider_error', { error: String(providerError).slice(0, 64) });
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.CANCELLED}`));
  }

  const check = validateTransaction(pending, state);
  if (!check.ok) {
    logFailure(req, check.reason);
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.INVALID_STATE}`));
  }

  if (!code) {
    logFailure(req, 'missing_code');
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.VERIFICATION_FAILED}`));
  }

  let claims;
  try {
    /**
     * The full URL as received. openid-client re-parses the authorization response from
     * it and checks `state` against `expectedState` itself, so the match is enforced
     * twice — once above for our own reason codes, once inside the library.
     */
    const currentUrl = new URL(
      `${req.protocol}://${req.get('host')}${req.originalUrl}`
    );

    const tokens = await exchangeCode(currentUrl, {
      state: pending.state,
      nonce: pending.nonce,
      codeVerifier: pending.codeVerifier,
    });

    claims = tokens.claims();
  } catch (err) {
    /**
     * Everything the library refuses lands here: bad signature, wrong issuer, wrong
     * audience, expired token, mismatched nonce, PKCE failure, token endpoint error.
     * They are deliberately NOT distinguished for the user — the difference between
     * "wrong issuer" and "bad signature" is information for an attacker probing the
     * endpoint, and useless to a person holding a phone.
     */
    logFailure(req, 'token_validation_failed', { message: err.message });
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.VERIFICATION_FAILED}`));
  }

  /**
   * Jobblo does not request the `ssn` scope, so a national identity number should be
   * impossible. If one arrives anyway — a dashboard misconfiguration, a scope added
   * while debugging — the flow stops rather than persisting it. Refusing is the safe
   * direction: it is visible, and it cannot be undone by a later delete.
   */
  const nationalIdClaims = findNationalIdClaims(claims);
  if (nationalIdClaims.length > 0) {
    logFailure(req, 'unexpected_national_id_claim', { claims: nationalIdClaims });
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.VERIFICATION_FAILED}`));
  }

  const built = buildIdentityVerification(claims);
  if (!built.ok) {
    logFailure(req, built.reason);
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.IDENTITY}`));
  }
  const identity = built.identity;

  try {
    // ── Intent: link to the account that started the flow ──────────────────────
    if (pending.intent === INTENTS.LINK) {
      /**
       * The target comes from the session, recorded at START from an authenticated
       * request. Never from the callback query string, never from a returned e-mail,
       * never from the returned name.
       */
      const user = await User.findById(pending.jobbloUserId).select('_id');
      if (!user) {
        logFailure(req, 'link_target_gone');
        return res.redirect(frontendUrl(`login?error=${ERRORS.VERIFICATION_FAILED}`));
      }

      const claimed = await claimIdentity(identity.subject, user._id);
      if (!claimed.ok) {
        logFailure(req, 'identity_already_linked');
        return res.redirect(frontendUrl(`profile?error=${ERRORS.ALREADY_LINKED}`));
      }

      await applyVerification(user._id, identity);
      return res.redirect(frontendUrl('profile?verified=bankid'));
    }

    // ── Intent: sign in with BankID ────────────────────────────────────────────

    // A returning BankID user: the subject is already attached to an account.
    const existing = await User.findOne({
      'identityVerification.provider': 'idura',
      'identityVerification.subject': identity.subject,
    });

    if (existing) {
      // Refresh the assurance level and timestamp, then log them in.
      await applyVerification(existing._id, identity);
      return completeLogin(req, res, existing, 'oauth-success');
    }

    /**
     * The subject is unknown to the users collection but may still be claimed — a
     * crash between the claim write and the user write would leave exactly that.
     * Checking here keeps one identity on one account even in that window.
     */
    const claimKey = IdentityClaim.keyFor('idura', 'no_bankid', identity.subject);
    const orphanClaim = await IdentityClaim.findById(claimKey).lean();
    if (orphanClaim) {
      const owner = await User.findById(orphanClaim.userId).select('_id');
      if (owner) {
        logFailure(req, 'identity_claimed_by_other_account');
        return res.redirect(frontendUrl(`login?error=${ERRORS.ALREADY_LINKED}`));
      }
      // The owner no longer exists; release the claim so the identity is usable again.
      await IdentityClaim.deleteOne({ _id: claimKey });
    }

    /**
     * A brand new BankID identity.
     *
     * The e-mail is used ONLY to decide whether a new account can be created without
     * asking for one — never to find an existing account to adopt. This is the same
     * policy `utils/oauthLinking.js` enforces for Vipps and Google, and the reason the
     * old Idura controller was disabled: it linked on e-mail equality and then marked
     * the account verified, which handed over any account whose address was known.
     */
    const email = verifiedEmailFrom(claims);

    if (!email) {
      // Norwegian BankID over kodebrikke returns no e-mail at all, and `User.email` is
      // required and unique. Ask them to sign in normally and link from the profile —
      // recoverable without support, and the session then proves ownership.
      logFailure(req, 'no_email_for_signup');
      return res.redirect(frontendUrl(`login?error=${ERRORS.NO_EMAIL}`));
    }

    const emailOwner = await User.findOne({ email }).select('_id');
    if (emailOwner) {
      // Stop. Linking here on e-mail equality is exactly the takeover this replaces.
      logFailure(req, 'email_collision_not_linked');
      return res.redirect(frontendUrl(`login?error=${ERRORS.ACCOUNT_EXISTS}`));
    }

    const created = await User.create({
      name: identity.verifiedName || 'BankID-bruker',
      email,
      // Not a credential: a bcrypt hash of random bytes that were discarded.
      password: await createUnusablePassword(),
    });

    const claimed = await claimIdentity(identity.subject, created._id);
    if (!claimed.ok) {
      // Lost a race with a concurrent callback for the same identity. The account we
      // just made has no identity and no password anyone knows — remove it rather than
      // leaving an orphan.
      await User.deleteOne({ _id: created._id });
      logFailure(req, 'identity_race_lost');
      return res.redirect(frontendUrl(`login?error=${ERRORS.ALREADY_LINKED}`));
    }

    await applyVerification(created._id, identity);
    return completeLogin(req, res, created, 'oauth-success');
  } catch (err) {
    logFailure(req, 'account_stage_failed', { message: err.message });
    return res.redirect(frontendUrl(`${failureTarget}?error=${ERRORS.VERIFICATION_FAILED}`));
  }
};

exports.ERRORS = ERRORS;
exports._internals = { claimIdentity, applyVerification };
