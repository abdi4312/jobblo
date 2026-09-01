const iduraAuthController = require('../controllers/iduraAuthController');
const vippsController = require('../controllers/vippsController');
const User = require('../models/User');
const { setCookie } = require('../utils/setCookie.js');

const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { authLimiter, otpSendLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');
const { generateTokens, createSession } = require('../utils/tokenUtils');
const { mobileReturn, noStore } = require('../utils/oauthReturn');
const webOAuth = require('./webOAuth');

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

/**
 * PUBLIC on purpose — no `authenticate`.
 *
 * The HTTPS hand-off page that gets a finished Google or Vipps flow out of the browser and
 * back into the mobile app. It is reached by a redirect from this server's own provider
 * callback, running inside a Custom Tab that holds no Jobblo credentials, so requiring auth
 * here would break the only flow that uses it. It reads nothing and asserts nothing; see
 * utils/oauthReturn.js. Same shape as `/api/safepay-checkout/mobile-return`.
 */
router.get('/mobile-return', mobileReturn);

// Google OAuth Routes
//
// `optionalAuthenticate` for the same reason as Vipps: signing in must work when
// signed out, but a signed-in caller asking to CONNECT Google to the account they are
// already using (`/api/auth/google?link=1`) records that intent in the session. That
// cookie is the proof of ownership that an e-mail match is not -- see
// utils/oauthLinking.js.
//
// `?platform=mobile` is recorded the same way and for the same reason: where this flow
// ends up must be decided by the server, from intent captured before the provider is ever
// contacted, and never from a parameter on the callback.
//
// It is recorded TWICE, in the session and in a signed `state`, because the session copy
// turned out not to survive a second sign-in from the same browser — see utils/oauthReturn.js.
// `no-store` belongs to the same fix: this endpoint must actually run on every attempt, and
// a cached redirect would replay the previous flow's authorization request instead.
router.get('/google', optionalAuthenticate, async (req, res, next) => {
  noStore(res);
  req.baseUrl = '/api/auth/web';
  return webOAuth.googleStart(req, res, next);
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
 *
 * Every destination now goes through `oauthDestination`, which sends a flow that started
 * with `?platform=mobile` to the app bridge and everything else to the website exactly as
 * before. The platform is read ONCE, up front, so the refusal paths below reach the app
 * too -- an error that only ever lands on the website is invisible to someone holding a
 * phone.
 */
router.get('/google/callback', (req, res, next) => {
  takeOAuthPlatform(req);
  req.baseUrl = '/api/auth/web';
  return webOAuth.googleCallback(req, res, next);
});

/**
 * Idura / BankID — Norwegian BankID identity verification and sign-in.
 *
 * The 410 that stood here through Stage B1 is gone: the bespoke implementation it was
 * protecting against has been replaced by a real OpenID Connect authorization code +
 * PKCE flow in controllers/iduraAuthController.js. The old controller validated no
 * state, sent no nonce and no PKCE, never verified an id_token, and linked to any
 * account whose e-mail matched before marking it verified.
 *
 * `optionalAuthenticate` on the start endpoint, for the same reason as Vipps and
 * Google: signing in with BankID must work when signed out, but the primary use case
 * is a signed-in person verifying THEIR account (`?link=1`), and that session cookie is
 * the only thing that authorises attaching a verified identity to an existing account.
 * The account id is recorded server-side at the start of the flow and read back from
 * the session at the end — never from the callback query string.
 *
 * Both endpoints answer with a redirect carrying an opaque error code; the mapping to
 * Norwegian copy lives in the frontend (src/features/auth/oauthErrors.ts). No OAuth
 * error, token error, issuer value or stack trace reaches the browser.
 */
router.get('/idura', optionalAuthenticate, iduraAuthController.startIduraAuth);
router.get('/idura/callback', iduraAuthController.iduraCallback);

router.get('/vipps', optionalAuthenticate, (req, res) => {
  req.baseUrl = '/api/auth/web';
  return vippsController.redirectToVipps(req, res, { platform: 'web' });
});
router.get('/vipps/callback', (req, res) => {
  req.baseUrl = '/api/auth/web';
  return vippsController.vippsCallback(req, res, { platform: 'web' });
});

module.exports = router;
