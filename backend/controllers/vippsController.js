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

function resolveVippsRoute(req, explicitPlatform) {
  const requestPlatform =
    typeof req?.query === 'object' && req.query && typeof req.query['platform'] === 'string'
      ? req.query['platform'].trim().toLowerCase()
      : '';
  const routePlatform =
    explicitPlatform ||
    (requestPlatform === 'mobile' ? 'mobile' : undefined) ||
    ((req?.baseUrl || '').includes('/mobile') ? 'mobile' : 'web');
  const redirectVar = routePlatform === 'mobile' ? 'VIPPS_MOBILE_REDIRECT_URI' : 'VIPPS_WEB_REDIRECT_URI';
  const redirectUri = (process.env[redirectVar] || process.env.VIPPS_REDIRECT_URI || '').trim();
  return { platform: routePlatform, redirectUri };
}

exports.redirectToVipps = async (req, res, options = {}) => {
  noStore(res);

  const { platform, redirectUri } = resolveVippsRoute(req, options.platform);
  const fail = (code) => res.redirect(oauthDestination({ req, platform, error: code }));

  try {
    const state = withPlatformState(crypto.randomBytes(32).toString('hex'), platform);

    if (!req.session) {
      console.error('Vipps: session middleware unavailable; refusing to start OAuth');
      return fail(ERRORS.FAILED);
    }

    const wantsLink = req.query.link === '1' || req.query.intent === 'link';
    req.session.vippsAuth = {
      state,
      createdAt: Date.now(),
      linkUserId: wantsLink && req.userId ? String(req.userId) : null,
      redirectUri,
    };

    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );

    const clientId = (process.env.VIPPS_CLIENT_ID || '').trim();
    if (!clientId || !redirectUri) {
      console.error('Vipps: VIPPS_CLIENT_ID or route redirect URI is missing');
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

exports.vippsCallback = async (req, res, options = {}) => {
  const { code, state, error } = req.query;
  const platformFromState = takeOAuthPlatform(req);
  const { platform: routePlatform, redirectUri: configuredRedirectUri } = resolveVippsRoute(req, options.platform || platformFromState);
  const platform = options.platform || platformFromState || routePlatform;
  const succeeded = (accessToken) => oauthDestination({ req, platform, accessToken });
  const failed = (errorCode, webPath) => oauthDestination({ req, platform, error: errorCode, webPath });
  const cancelled = () => (platform === 'mobile' ? failed(ERRORS.CANCELLED) : frontendUrl('login'));

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

  const requestRedirectUri =
    pending?.redirectUri || configuredRedirectUri || process.env.VIPPS_REDIRECT_URI?.trim();

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

    if (!requestRedirectUri) {
      console.error('Vipps: no redirect URI available for this route');
      return res.redirect(failed(ERRORS.FAILED));
    }

    const tokenResponse = await axios.post(
      `${vippsBaseUrl}/access-management-1.0/access/oauth2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: requestRedirectUri,
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
