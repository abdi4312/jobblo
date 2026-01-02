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
    passport.authenticate('google', { failureRedirect: process.env.frontendURL + '?error=auth_failed', session: false }),
    
    // 2. Sirf ek hi response handler rakhein
    (req, res) => {
        try {
            if (!req.user) {
                return res.redirect(process.env.frontendURL + '?error=no_user');
            }

            // Generate JWT
            const token = jwt.sign(
                { userId: req.user._id, email: req.user.email },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            const cookieOptions = {
                httpOnly: true,
                secure: false, // localhost par false, production mein true
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 
            };

            // Token ko cookie mein set karein
            res.cookie('token', token, cookieOptions);

            // AB SIRF REDIRECT KAREIN (res.json nahi karna)
            // Redirect frontend ke dashboard par le jayega aur cookie sath jayegi
            return res.redirect(process.env.frontendURL);

        } catch (error) {
            console.error("Callback Error:", error);
            // Error hone ki soorat mein agar response nahi bheja gaya to redirect karein
            if (!res.headersSent) {
                return res.redirect('http://localhost:3000/login?error=server_error');
            }
        }
    }
);

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
router.get('/profile', (req, res) => {
    if (req.user) {
        res.json({
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                avatarUrl: req.user.avatarUrl,
                verified: req.user.verified
            }
        });
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

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
  // Clear the JWT cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: false,    // production me true
    sameSite: 'none'
  });

  res.json({ message: 'Logged out successfully' });
});


module.exports = router; 