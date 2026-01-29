const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');


console.log('Loading passport config...');
console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID ? 'Present' : 'Missing');
console.log('Google Client Secret:', process.env.GOOGLE_CLIENT_SECRET ? 'Present' : 'Missing');

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('OAuth callback - Profile received:', profile.id, profile.emails[0].value);

        // Check if user already exists with this Google ID
        let existingUser = await User.findOne({
            'oauthProviders.provider': 'google',
            'oauthProviders.providerId': profile.id
        });
        console.log('Existing Google user found:', existingUser ? 'YES' : 'NO');

        if (existingUser) {
            // User exists, return the user
            return done(null, existingUser);
        }

        // Check if user exists with same email
        existingUser = await User.findOne({ email: profile.emails[0].value });
        console.log('Existing email user found:', existingUser ? 'YES' : 'NO');

        if (existingUser) {
            // Check if Google provider is already linked
            const googleProvider = existingUser.oauthProviders.find(
                provider => provider.provider === 'google'
            );

            if (!googleProvider) {
                // Link Google account to existing user
                existingUser.oauthProviders.push({
                    provider: 'google',
                    providerId: profile.id
                });
                await existingUser.save();
            }
            return done(null, existingUser);
        }

        // Simple approach: Try to find or create user step by step
        console.log('Creating/finding user with simple approach for email:', profile.emails[0].value);

        // First, try to create the user with a basic structure
        let user;
        try {
            // Try to create a new user directly
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                password: 'oauth-user',
                phone: `oauth-temp-${profile.id}`, // Temporary unique placeholder
                avatarUrl: profile.photos[0]?.value,
                verified: true,
                role: 'user',
                subscription: 'free',
                followers: [],
                following: [],
                earnings: 0,
                spending: 0,
                availability: [],
                oauthProviders: [{
                    provider: 'google',
                    providerId: profile.id
                }]
            });

            await user.save();
            console.log('New user created successfully:', user.email);
        } catch (createError) {
            console.log('User creation failed (likely duplicate email):', createError.message);
            // If creation fails, find the existing user
            user = await User.findOne({ email: profile.emails[0].value });

            if (!user) {
                console.log('No user found after creation failure');
                return done(new Error('Failed to create or find user'), null);
            }
            console.log('Found existing user:', user.email);
        }

        // If user exists but doesn't have Google OAuth, add it
        if (user && user.save) { // Check if it's a real DB user
            const hasGoogleAuth = user.oauthProviders.some(p => p.provider === 'google');
            if (!hasGoogleAuth) {
                user.oauthProviders.push({
                    provider: 'google',
                    providerId: profile.id
                });
                await user.save();
            }
        }

        console.log('User operation completed for:', user?.email);
        return done(null, user);
    } catch (error) {
        console.error('OAuth error:', error);
        return done(error, null);
    }
}));

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