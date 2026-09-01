const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { ensureDefaultSubscription } = require('../utils/subscription');
const { createUnusablePassword } = require('../utils/passwordUtils');
const { resolveOAuthLogin } = require('../utils/oauthLinking');

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

function buildGoogleVerify() {
  return async (req, accessToken, refreshToken, profile, done) => {
    try {
      const decision = await resolveOAuthLogin({
        provider: 'google',
        providerId: profile?.id,
        email: profile?.emails?.[0]?.value,
        emailVerified: emailVerifiedFrom(profile),
        linkToUserId: req?.session?.googleLinkUserId || null,
      });

      if (req?.session?.googleLinkUserId) delete req.session.googleLinkUserId;

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

          await ensureDefaultSubscription(user);
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

function buildGoogleStrategy(callbackURL) {
  return new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL,
      passReqToCallback: true,
    },
    buildGoogleVerify()
  );
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    'google-web',
    buildGoogleStrategy(
      process.env.GOOGLE_WEB_CALLBACK_URL || process.env.CALLBACK_URL || '/api/auth/web/google/callback'
    )
  );
  passport.use(
    'google-mobile',
    buildGoogleStrategy(process.env.GOOGLE_MOBILE_CALLBACK_URL || '/api/auth/mobile/google/callback')
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
