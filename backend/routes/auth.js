const {iduraCallback} = require('../controllers/iduraAuthcontroller');

const User = require('../models/User');

const {authenticate} = require('../middleware/auth');

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
router.post('/register', authController.register);

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
router.post('/login', authController.login);

// Google OAuth Routes

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Initiate Google OAuth login
 *     tags: [OAuth]
 *     description: Redirects user to Google for authentication
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 */
router.get('/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * @swagger
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags: [OAuth]
 *     description: Handles the callback from Google OAuth
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *       401:
 *         description: Authentication failed
 */
router.get('/google/callback',
    // 1. Passport authenticate ko handle karein
    passport.authenticate('google', { failureRedirect: process.env.FRONTEND_URL + '?error=auth_failed', session: false }),
    
    // 2. Sirf ek hi response handler rakhein
    (req, res) => {
        try {
            if (!req.user) {
                return res.redirect(process.env.FRONTEND_URL + '?error=no_user');
            }

            // Generate JWT
            const token = jwt.sign(
                { id: req.user._id, },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

           const cookieOptions = {
                httpOnly: true,         
                secure: false,           
                sameSite: 'lax',         
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            };
            // Token ko cookie mein set karein
            res.cookie('token', token, cookieOptions);

            return res.redirect(process.env.FRONTEND_URL + 'oauth-success');

        } catch (error) {
            console.error("Callback Error:", error);
            // Error hone ki soorat mein agar response nahi bheja gaya to redirect karein
            if (!res.headersSent) {
                return res.redirect('http://localhost:3000/login?error=server_error');
            }
        }
    }
);

router.get("/idura/callback", iduraCallback);

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *       401:
 *         description: Not authenticated
 */
router.get('/profile', authenticate, async(req, res) => {
    try {

        const  id  = req.userId;

        const user = await User.findById(id).select('-password');

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});


router.get(
  '/vipps',
  passport.authenticate('vipps', { session: false })
);

router.get(
  '/vipps/callback',
  passport.authenticate('vipps', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    // Generate JWT
    const token = jwt.sign({ userId: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
  }
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [OAuth]
 *     responses:
 *       200:
 *         description: Successfully logged out
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: false,       
    sameSite: 'lax'   
  });

  res.json({ message: 'Logged out successfully' });
});


module.exports = router; 