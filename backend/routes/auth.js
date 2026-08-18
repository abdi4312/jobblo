// Deliberately not imported: the Idura callback is disabled below and the controller
// must not be reachable. Left as a pointer to the file rather than deleted.
// const { iduraCallback } = require('../controllers/iduraAuthcontroller');
const vippsController = require('../controllers/vippsController');
const User = require('../models/User');
const { setCookie } = require('../utils/setCookie.js');

const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { authLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');
const { generateTokens, createSession } = require('../utils/tokenUtils');

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');
const jwt = require('jsonwebtoken');

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           description: Brukerens navn
 *         email:
 *           type: string
 *           description: Brukerens e-postadresse
 *         password:
 *           type: string
 *           description: Brukerens passord
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           description: Brukerens e-postadresse
 *         password:
 *           type: string
 *           description: Brukerens passord
 *     AuthResponse:
 *       type: object
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/User'
 *         token:
 *           type: string
 *           description: JWT token for autentisering
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrer en ny bruker
 *     tags: [Autentisering]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Bruker registrert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Ugyldig input
 */
router.post('/register', authLimiter, authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Logg inn en bruker
 *     tags: [Autentisering]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Innlogging vellykket
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Ugyldige påloggingsdetaljer
 */
router.post('/login', authLimiter, authController.login);

router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.get('/profile', authenticate, authController.getProfile);
router.get('/sessions', authenticate, authController.getSessions);
// ⚠️ revoke-others MUST be before /:sessionId — otherwise Express matches it as a sessionId param
router.delete('/sessions/revoke-others', authenticate, authController.revokeAllOtherSessions);
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);

// Password Reset Routes (OTP-based)
router.post('/forgot-password', otpSendLimiter, authController.forgotPassword);
router.post('/verify-otp', otpVerifyLimiter, authController.verifyOtp);
router.post('/reset-password', otpVerifyLimiter, authController.resetPassword);

// Change Password (authenticated — requires current password + OTP)
router.post('/change-password/send-otp', authenticate, otpSendLimiter, authController.changePasswordSendOtp);
router.post('/change-password/send-otp-no-password', authenticate, otpSendLimiter, authController.changePasswordSendOtpNoPassword);
router.post('/change-password/verify-otp', authenticate, otpVerifyLimiter, authController.changePasswordVerifyOtp);

// Google OAuth Routes
//
// `optionalAuthenticate` for the same reason as Vipps: signing in must work when
// signed out, but a signed-in caller asking to CONNECT Google to the account they are
// already using (`/api/auth/google?link=1`) records that intent in the session. That
// cookie is the proof of ownership that an e-mail match is not -- see
// utils/oauthLinking.js.
router.get('/google', optionalAuthenticate, (req, res, next) => {
  if (req.session && (req.query.link === '1' || req.query.intent === 'link') && req.userId) {
    req.session.googleLinkUserId = String(req.userId);
  } else if (req.session) {
    delete req.session.googleLinkUserId;
  }
  return passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

/**
 * A custom callback rather than `failureRedirect: '/login'`.
 *
 * Two problems with the old arrangement. It was a BACKEND-relative path, so a refused
 * login landed on the API host's /login, which does not exist -- the user got a 404
 * instead of the sign-in form. And it was a single static destination, so every
 * refusal looked identical: the strategy now distinguishes "this address already
 * belongs to an account" from "Google sent no usable identity", and that distinction
 * only helps if it reaches the person.
 */
router.get('/google/callback', (req, res, next) => {
  const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

  passport.authenticate('google', { session: false }, async (err, user, info) => {
    if (err) {
      console.error('Google callback error:', err.message);
      return res.redirect(`${frontendBase}/login?error=google_failed`);
    }
    if (!user) {
      return res.redirect(`${frontendBase}/login?error=${info?.code || 'google_failed'}`);
    }

    try {
      const { accessToken, refreshToken } = await createSession(req, user._id);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 60 * 60 * 1000, // 1 hour (matches token expiry)
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return res.redirect(`${frontendBase}/oauth-success?token=${accessToken}`);
    } catch (sessionError) {
      console.error('Google callback session error:', sessionError.message);
      return res.redirect(`${frontendBase}/login?error=google_failed`);
    }
  })(req, res, next);
});

/**
 * Idura / BankID — INTENTIONALLY DISABLED.
 *
 * The implementation in controllers/iduraAuthcontroller.js is not a safe OIDC client
 * and must not be reachable until it is rebuilt. Concretely, it:
 *
 *   - never validates `state` (the frontend sent the constant 'idura_login', so there
 *     was no CSRF protection at all),
 *   - sends no `nonce` and performs no PKCE,
 *   - never requests or verifies an `id_token`, so nothing proves the identity
 *     assertion came from Idura,
 *   - exchanges the code through a bespoke `POST /auth/token` shape that is not
 *     Idura's OIDC token endpoint,
 *   - links to any pre-existing account whose e-mail merely matches the profile
 *     e-mail, and then sets `verified: true` / `accountStatus: 'verified'` on it —
 *     an account-takeover path,
 *   - writes the literal string 'oauth-user' into `password` instead of a hash.
 *
 * Returning 410 rather than deleting the route: a bare 404 is indistinguishable from
 * a deploy or routing mistake, and an explicit, asserted response is what the
 * regression test in __tests__/iduraDisabled.test.js pins down. The controller file
 * is deliberately left in the tree — this is a temporary stop, not a removal. The
 * replacement is a real OIDC authorization-code + PKCE flow driven server-side; see
 * the Stage A audit for the plan.
 *
 * Do not re-enable by restoring this line. Re-enable by replacing the controller.
 */
const IDURA_DISABLED_MESSAGE =
  'BankID-innlogging er midlertidig utilgjengelig. Bruk e-post, passord eller Vipps.';

router.all('/idura/callback', (req, res) =>
  res.status(410).json({ error: IDURA_DISABLED_MESSAGE, code: 'IDURA_DISABLED' })
);

// Also stop the initiation path, in case a client or bookmark points at it. There is
// no server-side initiator today (the old frontend built the authorize URL itself),
// so this exists to make the whole surface answer consistently.
router.all('/idura', (req, res) =>
  res.status(410).json({ error: IDURA_DISABLED_MESSAGE, code: 'IDURA_DISABLED' })
);
/**
 * Vipps.
 *
 * `optionalAuthenticate` rather than `authenticate`: signing in with Vipps must work
 * for someone who is not logged in, which is the whole point of it. But when the
 * caller IS logged in and asked to connect Vipps to that account
 * (`/api/auth/vipps?link=1`), the middleware sets `req.userId`, and the controller
 * records it in the session as the link target.
 *
 * That session cookie is the only thing that authorises attaching a Vipps identity to
 * an existing account. Matching e-mail addresses no longer does -- see
 * utils/oauthLinking.js.
 */
router.get('/vipps', optionalAuthenticate, vippsController.redirectToVipps);
router.get('/vipps/callback', vippsController.vippsCallback);

module.exports = router;
