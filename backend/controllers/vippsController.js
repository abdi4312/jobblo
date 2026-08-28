const { createSession } = require('../utils/tokenUtils');
const { ensureDefaultSubscription } = require('../utils/subscription');
const { createUnusablePassword } = require('../utils/passwordUtils');
const { resolveOAuthLogin } = require('../utils/oauthLinking');
const {
  oauthDestination,
  rememberOAuthPlatform,
  takeOAuthPlatform,
  withPlatformState,
  noStore,
} = require('../utils/oauthReturn');
const axios = require('axios');
const User = require('../models/User');
const crypto = require('crypto');

/**
 * Vipps sign-in.
 *
 * The account-linking policy this callback enforces lives in utils/oauthLinking.js;
 * read that file for why matching e-mail addresses is not proof of account ownership.
 * What is here is the OAuth mechanics: state, the code exchange, and turning the
 * policy's decision into a redirect.
 *
 * Where that redirect points is decided by utils/oauthReturn.js — the website as before,
 * or the mobile hand-off page when the flow was started with `?platform=mobile`. The Vipps
 * redirect_uri itself is untouched and stays the HTTPS callback registered in the Vipps
 * portal; a custom scheme never goes near the provider.
 */

/** How long an authorization request may sit unanswered before the state expires. */
const STATE_TTL_MS = 10 * 60 * 1000;

/** Error codes handed to the frontend. Kept short and stable; copy lives in the UI. */
const ERRORS = {
  INVALID_STATE: 'vipps_invalid_state',
  IDENTITY: 'vipps_identity',
  ACCOUNT_EXISTS: 'vipps_account_exists',
  ALREADY_LINKED: 'vipps_already_linked',
  NO_EMAIL: 'vipps_no_email',
  /** Vipps itself refused or the person backed out. Mobile-only; web returns silently. */
  CANCELLED: 'vipps_cancelled',
  FAILED: 'vipps_failed',
};

/** `FRONTEND_URL` is configured with and without a trailing slash across environments. */
function frontendUrl(pathAndQuery) {
  const base = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/${pathAndQuery.replace(/^\//, '')}`;
}

/** Constant-time state comparison; length mismatch is itself a mismatch. */
function statesMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

exports.redirectToVipps = async (req, res) => {
  // This endpoint mints a one-time state and records where the flow ends up, so it has to
  // run on every attempt rather than being replayed from a browser's cache.
  noStore(res);

  /**
   * Recorded before anything below can fail, so a mobile flow that dies at the starting
   * line still gets its answer delivered into the app instead of onto the website. Returns
   * 'web' if there is no session to record it in — which is the case the very next check
   * refuses outright anyway.
   */
  const platform = await rememberOAuthPlatform(req);
  const fail = (code) => res.redirect(oauthDestination({ req, platform, error: code }));

  try {
    /**
     * 1. Strong random state (CSRF protection), bound to this session — plus, for a mobile
     * flow, the signed platform token appended to it. Vipps hands `state` back untouched,
     * so that token is a second, session-independent answer to "where does this land"; the
     * value stored below and the value compared at the callback are both this composite,
     * so the state check itself is unchanged. See utils/oauthReturn.js.
     */
    const state = withPlatformState(crypto.randomBytes(32).toString('hex'), platform);

    if (!req.session) {
      // Without a session there is nowhere to bind the state, and an unbound state is
      // not CSRF protection -- it is a parameter the attacker also controls. Fail here
      // rather than starting a flow the callback is going to have to reject anyway.
      console.error('Vipps: session middleware unavailable; refusing to start OAuth');
      return fail(ERRORS.FAILED);
    }

    /**
     * `intent` separates the two things this button can mean.
     *
     * The route runs `optionalAuthenticate`, so `req.userId` is set when a signed-in
     * person asked to connect Vipps to the account they are already using. That
     * session cookie is the proof of ownership that an e-mail match is not, and it is
     * the only thing that authorises attaching this identity to an existing account.
     *
     * It is recorded HERE, at the start of the flow, and read from the session on the
     * way back -- never from a callback query parameter, which the attacker supplies.
     */
    const wantsLink = req.query.link === '1' || req.query.intent === 'link';
    req.session.vippsAuth = {
      state,
      createdAt: Date.now(),
      linkUserId: wantsLink && req.userId ? String(req.userId) : null,
    };

    /**
     * Wait for the store write before sending the browser to Vipps.
     *
     * connect-mongo writes asynchronously and the callback arrives on a different request.
     * Redirecting first meant the state could still be in flight when Vipps came back on a
     * fast connection, which surfaced as a random `vipps_invalid_state` — the same race
     * `startIduraAuth` already guards against.
     */
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    // 2. Build the authorize URL.
    const clientId = (process.env.VIPPS_CLIENT_ID || '').trim();
    const redirectUri = (process.env.VIPPS_REDIRECT_URI || '').trim();

    if (!clientId || !redirectUri) {
      console.error('Vipps: VIPPS_CLIENT_ID or VIPPS_REDIRECT_URI is missing');
      return fail(ERRORS.FAILED);
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'openid name phoneNumber email',
      state,
      redirect_uri: redirectUri,
    });

    const vippsBaseUrl = (process.env.VIPPS_BASE_URL || 'https://apitest.vipps.no').replace(
      /\/$/,
      ''
    );

    return res.redirect(
      `${vippsBaseUrl}/access-management-1.0/access/oauth2/auth?${params.toString()}`
    );
  } catch (err) {
    console.error('Error in redirectToVipps:', err.message);
    return fail(ERRORS.FAILED);
  }
};

exports.vippsCallback = async (req, res) => {
  const { code, state, error } = req.query;

  /**
   * Where this flow ends up, decided from intent recorded at the start endpoint — read
   * once, here, before any early return. A refused sign-in has to reach the app just as
   * much as a successful one does.
   *
   * `failed()` and `succeeded()` produce byte-identical web URLs to the ones this
   * controller built by hand before the mobile bridge existed, so the website is
   * unaffected. `cancelled()` is the one place they differ: web keeps its silent return
   * to /login, while the app is given a code, because its arrival screen has no other way
   * to tell "you backed out" from "still working on it".
   */
  const platform = takeOAuthPlatform(req);
  const succeeded = (accessToken) => oauthDestination({ req, platform, accessToken });
  const failed = (errorCode, webPath) =>
    oauthDestination({ req, platform, error: errorCode, webPath });
  const cancelled = () =>
    platform === 'mobile' ? failed(ERRORS.CANCELLED) : frontendUrl('login');

  /**
   * The state is single-use. Reading it clears it, whatever happens next, so a
   * captured callback URL cannot be replayed against the same session -- previously
   * it was deleted only on the success path, leaving a usable state behind after
   * every failure.
   */
  const pending = req.session?.vippsAuth || null;
  if (req.session) delete req.session.vippsAuth;

  if (error) {
    return res.redirect(cancelled());
  }
  if (!code) {
    return res.redirect(cancelled());
  }

  /**
   * State is now checked in EVERY environment.
   *
   * It used to be wrapped in `if (process.env.NODE_ENV === 'production')`, which means
   * the CSRF protection was absent from every environment where it could realistically
   * be discovered, and the production path was the one nobody ever exercised until it
   * mattered. A staging deployment or a developer machine running with real Vipps test
   * credentials had no protection at all.
   */
  if (!pending || !statesMatch(String(state || ''), pending.state)) {
    console.warn('Vipps: state mismatch or missing');
    return res.redirect(failed(ERRORS.INVALID_STATE));
  }
  if (Date.now() - (pending.createdAt || 0) > STATE_TTL_MS) {
    console.warn('Vipps: state expired');
    return res.redirect(failed(ERRORS.INVALID_STATE));
  }

  try {
    const vippsBaseUrl = (process.env.VIPPS_BASE_URL || 'https://apitest.vipps.no').replace(
      /\/$/,
      ''
    );

    // Exchange the code. The redirect_uri must match the one sent to authorize.
    const tokenResponse = await axios.post(
      `${vippsBaseUrl}/access-management-1.0/access/oauth2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.VIPPS_REDIRECT_URI?.trim(),
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' +
            Buffer.from(
              `${process.env.VIPPS_CLIENT_ID?.trim()}:${process.env.VIPPS_CLIENT_SECRET?.trim()}`
            ).toString('base64'),
          'Ocp-Apim-Subscription-Key': process.env.VIPPS_SUB_KEY?.trim(),
        },
      }
    );

    const vippsAccessToken = tokenResponse.data.access_token;
    if (!vippsAccessToken) {
      console.error('Vipps: token response carried no access_token');
      return res.redirect(failed(ERRORS.FAILED));
    }

    // The userinfo endpoint is called server-to-server over TLS with a token we just
    // obtained ourselves, so its response is the identity assertion here.
    const { data: profile } = await axios.get(
      `${vippsBaseUrl}/vipps-userinfo-api/userinfo`,
      { headers: { Authorization: `Bearer ${vippsAccessToken}` } }
    );

    /**
     * Decide what this identity is allowed to do. `resolveOAuthLogin` refuses a
     * missing or non-string `sub` outright: Mongoose drops `undefined` from a query,
     * so the old lookup collapsed to "any user who has ever used Vipps" and logged the
     * caller in as whoever came back first.
     */
    const decision = await resolveOAuthLogin({
      provider: 'vipps',
      providerId: profile?.sub,
      email: profile?.email,
      emailVerified: profile?.email_verified,
      linkToUserId: pending.linkUserId,
    });

    let user;

    switch (decision.outcome) {
      case 'login':
      case 'linked':
        user = decision.user;
        break;

      case 'invalid_identity':
        console.error('Vipps: userinfo response had no usable `sub`');
        return res.redirect(failed(ERRORS.IDENTITY));

      case 'link_conflict':
        // This Vipps identity is already attached to a different Jobblo account.
        // Attaching it twice would make one identity resolve to two users.
        return res.redirect(failed(ERRORS.ALREADY_LINKED, 'profile'));

      case 'link_target_gone':
        return res.redirect(failed(ERRORS.FAILED));

      case 'account_exists':
        /**
         * An account already holds this e-mail address and this Vipps identity is not
         * linked to it. Linking here on e-mail equality alone is precisely the account
         * takeover this change exists to remove, and `User.email` is unique so a
         * parallel account cannot be created either.
         *
         * So: stop, and ask them to prove they own the account by signing in. Once
         * signed in they can connect Vipps from their profile, which routes through
         * the `linkUserId` branch above. Recoverable without support, including via
         * forgot-password.
         */
        return res.redirect(failed(ERRORS.ACCOUNT_EXISTS));

      case 'create': {
        if (!decision.email) {
          // `User.email` is required and unique, so an account genuinely cannot be
          // created without one. Say so plainly instead of failing as a generic
          // server error, which is what the old code did.
          console.error('Vipps: profile carried no usable e-mail; cannot create account');
          return res.redirect(failed(ERRORS.NO_EMAIL));
        }

        user = await User.create({
          name: profile.name || 'Vipps-bruker',
          email: decision.email,
          phone: profile.phone_number || undefined,
          // Not a credential: a bcrypt hash of 32 random bytes that were discarded.
          // The previous value was a plaintext random string sitting in the password
          // column -- see utils/passwordUtils.js.
          password: await createUnusablePassword(),
          oauthProviders: [{ provider: 'vipps', providerId: String(profile.sub).trim() }],
        });
        console.log('Vipps signup created user %s', user._id);
        break;
      }

      default:
        console.error('Vipps: unhandled linking outcome %s', decision.outcome);
        return res.redirect(failed(ERRORS.FAILED));
    }

    if (user?.isDeleted || user?.accountStatus === 'deactivated') {
      return res.redirect(failed('account_deactivated'));
    }

    // Idempotent by construction -- everything writable is inside `$setOnInsert`, so
    // this cannot create a second row or reset an existing paid plan on a repeat login.
    await ensureDefaultSubscription(user);

    const { accessToken, refreshToken } = await createSession(req, user._id);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 60 * 60 * 1000,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(succeeded(accessToken));
  } catch (err) {
    console.error('Vipps API Error:', err.response?.data || err.message);
    return res.redirect(failed(ERRORS.FAILED));
  }
};

exports.ERRORS = ERRORS;
