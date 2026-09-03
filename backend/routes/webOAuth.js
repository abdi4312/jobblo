const express = require('express');
const passport = require('passport');
const { optionalAuthenticate } = require('../middleware/auth');
const { createSession } = require('../utils/tokenUtils');
const { oauthDestination, noStore } = require('../utils/oauthReturn');
const vippsController = require('../controllers/vippsController');

const router = express.Router();

function setGoogleLinkIntent(req) {
  if (req.session && (req.query.link === '1' || req.query.intent === 'link') && req.userId) {
    req.session.googleLinkUserId = String(req.userId);
  } else if (req.session) {
    delete req.session.googleLinkUserId;
  }
}

async function googleStart(req, res, next) {
  noStore(res);
  setGoogleLinkIntent(req);
  return passport.authenticate('google-web', {
    scope: ['profile', 'email'],
  })(req, res, next);
}

function googleCallback(req, res, next) {
  passport.authenticate('google-web', { session: false }, async (err, user, info) => {
    if (err) {
      console.error('Google callback error:', err.message);
      return res.redirect(oauthDestination({ req, platform: 'web', error: 'google_failed' }));
    }
    if (!user) {
      return res.redirect(
        oauthDestination({ req, platform: 'web', error: info?.code || 'google_failed' })
      );
    }

    if (
      user.isDeleted ||
      user.accountStatus === 'inactive' ||
      user.accountStatus === 'deactivated'
    ) {
      return res.redirect(oauthDestination({ req, platform: 'web', error: 'account_inactive' }));
    }

    try {
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
      return res.redirect(oauthDestination({ req, platform: 'web', accessToken }));
    } catch (sessionError) {
      console.error('Google callback session error:', sessionError.message);
      return res.redirect(oauthDestination({ req, platform: 'web', error: 'google_failed' }));
    }
  })(req, res, next);
}

router.get('/google', optionalAuthenticate, googleStart);
router.get('/google/callback', googleCallback);
router.get('/vipps', optionalAuthenticate, (req, res) =>
  vippsController.redirectToVipps(req, res, { platform: 'web' })
);
router.get('/vipps/callback', (req, res) =>
  vippsController.vippsCallback(req, res, { platform: 'web' })
);

module.exports = router;
module.exports.googleStart = googleStart;
module.exports.googleCallback = googleCallback;
