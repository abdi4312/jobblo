const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { createUnusablePassword } = require('../utils/passwordUtils');
const { resolveOAuthLogin, findUserByProviderIdentity } = require('../utils/oauthLinking');

/**
 * Google sign-in.
 *
 * This strategy carried the same account-takeover path the Vipps callback did: when
 * the Google id was unknown it looked the user up by e-mail address and, on a match,
 * pushed the Google identity onto that account and logged the caller in. Controlling
 * an e-mail address is not proof of owning the Jobblo account that uses it, so that
 * handed over order history, payout details and chat to whoever turned up with a
 * matching address.
 *
 * The policy is shared with Vipps and lives in utils/oauthLinking.js. Here the
 * strategy only translates its decision into a passport result.
 *
 * Two other things were wrong in the old version and are gone:
 *
 *   password: 'oauth-user'
 *       A constant, shared by every Google account on the platform, stored where a
 *       credential goes. `bcrypt.compare` refuses it today because it is not a hash,
 *       but the obvious "we should hash these" migration would have turned it into a
 *       working password for every one of those accounts. See utils/passwordUtils.js.
 *
 *   phone: `oauth-temp-${profile.id}`
 *       A fake phone number written to satisfy an index that no longer requires it,
 *       which then showed up in the UI as the user's contact number.
 *
 * There is also no longer a catch-block that swallowed a failed insert and fell back
 * to `User.findOne({ email })` -- that was the takeover path a second time, reached
 * through the error handler.
 */

/** Google's OIDC `email_verified` claim, wherever this profile shape keeps it. */
function emailVerifiedFrom(profile) {
  if (typeof profile?._json?.email_verified === 'boolean') return profile._json.email_verified;
  if (typeof profile?.emails?.[0]?.verified === 'boolean') return profile.emails[0].verified;
  return undefined; // unknown -- treated as "not explicitly unverified"
}

/** How long a Google authorization request may sit unanswered before its state expires. */
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

function statesMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * OAuth `state` store that also carries the account-linking intent.
 *
 * The strategy had no state at all, so a callback carrying an attacker's authorization
 * code was accepted in the victim's browser: plain login logged the victim into the
 * attacker's account (login CSRF), and after a forced `?link=1` start the attacker's
 * Google identity was linked to the victim's account (account takeover). The link
 * target also lived in the session on its own, unbound to any request and never expiring.
 *
 * Passport's built-in `state: true` would close the code-injection half, but not the
 * rest. Here state and link intent are one single-use, expiring session record, and a
 * link only proceeds if the callback arrives in the same authenticated Jobblo session
 * (user AND session id) that started it.
 *
 * The start route sets `req.googleLinkRequest = { userId, sessionId }` for a link;
 * verify hands the consumed intent to the verify callback as `req.googleOAuthIntent`.
 */
function buildGoogleStateStore(key) {
  return {
    store(req, _meta, callback) {
      if (!req.session) return callback(new Error('Google OAuth requires session support'));
      const state = crypto.randomBytes(32).toString('hex');
      const link = req.googleLinkRequest;
      req.session[key] = {
        state,
        expiresAt: Date.now() + GOOGLE_STATE_TTL_MS,
        linkUserId: link ? String(link.userId) : null,
        linkSessionId: link ? String(link.sessionId) : null,
      };
      return callback(null, state);
    },

    verify(req, providedState, _meta, callback) {
      const pending = req.session?.[key];
      // Single-use: consumed whatever happens next, so a replay finds nothing.
      if (req.session) delete req.session[key];

      // One coarse code for the browser (like vipps_invalid_state); the reason is for logs.
      const reject = (reason) => {
        console.warn('Google OAuth: rejected callback (%s)', reason);
        return callback(null, false, { code: 'google_invalid_state' });
      };
      if (!pending || !statesMatch(String(providedState || ''), pending.state)) {
        return reject('state missing or mismatched');
      }
      if (!(Date.now() <= pending.expiresAt)) return reject('state expired');
      if (
        pending.linkUserId &&
        (String(req.userId) !== pending.linkUserId ||
          String(req.sessionId) !== pending.linkSessionId)
      ) {
        return reject('link callback outside the session that started it');
      }

      req.googleOAuthIntent = { linkToUserId: pending.linkUserId };
      return callback(null, true);
    },
  };
}

/**
 * Google-only link guards that run before the shared policy in oauthLinking.js:
 * while linking, never fall through to logging in as the identity's other owner, and
 * never put a second Google identity on an account that already has one.
 */
async function googleLinkConflict(linkToUserId, providerId) {
  if (typeof providerId !== 'string' || !providerId.trim()) return false;
  const id = providerId.trim();
  const holder = await findUserByProviderIdentity('google', id);
  if (holder && String(holder._id) !== String(linkToUserId)) return true;
  const target = await User.findById(linkToUserId).select('oauthProviders');
  return Boolean(
    target?.oauthProviders?.some((p) => p.provider === 'google' && p.providerId !== id)
  );
}

function buildGoogleVerify() {
  return async (req, accessToken, refreshToken, profile, done) => {
    try {
      const linkToUserId = req?.googleOAuthIntent?.linkToUserId || null;

      if (linkToUserId && (await googleLinkConflict(linkToUserId, profile?.id))) {
        return done(null, false, { code: 'google_already_linked' });
      }

      const decision = await resolveOAuthLogin({
        provider: 'google',
        providerId: profile?.id,
        email: profile?.emails?.[0]?.value,
        emailVerified: emailVerifiedFrom(profile),
        linkToUserId,
      });

      switch (decision.outcome) {
        case 'login':
        case 'linked':
          return done(null, decision.user);

        case 'invalid_identity':
          return done(null, false, { code: 'google_identity' });

        case 'link_conflict':
          return done(null, false, { code: 'google_already_linked' });

        case 'link_target_gone':
          return done(null, false, { code: 'google_failed' });

        case 'account_exists':
          return done(null, false, { code: 'google_account_exists' });

        case 'create': {
          if (!decision.email) {
            return done(null, false, { code: 'google_no_email' });
          }

          const user = await User.create({
            name: profile.displayName || 'Google-bruker',
            email: decision.email,
            password: await createUnusablePassword(),
            avatarUrl: profile.photos?.[0]?.value,
            verified: false,
            role: 'user',
            oauthProviders: [{ provider: 'google', providerId: String(profile.id) }],
          });

          return done(null, user);
        }

        default:
          console.error('Google OAuth: unhandled linking outcome %s', decision.outcome);
          return done(null, false, { code: 'google_failed' });
      }
    } catch (error) {
      console.error('Google OAuth error:', error.message);
      return done(error, null);
    }
  };
}

function buildGoogleStrategy(callbackURL, stateKey) {
  return new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL,
      passReqToCallback: true,
      store: buildGoogleStateStore(stateKey),
    },
    buildGoogleVerify()
  );
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    'google-web',
    buildGoogleStrategy(
      process.env.GOOGLE_WEB_CALLBACK_URL || process.env.CALLBACK_URL || '/api/auth/web/google/callback',
      'googleOAuth:web'
    )
  );
  passport.use(
    'google-mobile',
    buildGoogleStrategy(
      process.env.GOOGLE_MOBILE_CALLBACK_URL || '/api/auth/mobile/google/callback',
      'googleOAuth:mobile'
    )
  );
} else {
  console.warn('Google OAuth disabled: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not set.');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
module.exports.buildGoogleStateStore = buildGoogleStateStore;
module.exports.buildGoogleVerify = buildGoogleVerify;
