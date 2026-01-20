const Subscription = require('../models/Subscription');

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const cookieOptions = {
  httpOnly: true,          // JS se access nahi hoga, secure
  secure: false,           // true in production with HTTPS
  sameSite: 'lax',         // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

exports.register = async (req, res) => {
    try {
        const { name, lastName, email, password, } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, lastName, email, password: hashed});
        
        let token = null;
        if (process.env.JWT_SECRET) {
            token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        }
        
        // Set token in cookie if it exists
        if (token) {
            res.cookie('token', token, cookieOptions);
        }

        await Subscription.create({
        userId: user._id,

        currentPlan: {
            plan: "Free",
            planType: "private",
            startDate: new Date(),
            status: "active",
            autoRenew: false,
        }
        });

        res.status(201).json({ user, token });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Email or phone already exists' });
        }
        res.status(500).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        const match = await bcrypt.compare(password, user?.password || '');
        if (!user || !match) return res.status(401).json({ error: 'Invalid credentials' });
        
        // Only create token if JWT_SECRET is available
        let token = null;
        if (process.env.JWT_SECRET) {
            token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        }
        
        // Set token in cookie if it exists
        if (token) {
            res.cookie('token', token, cookieOptions);
        }
        
        res.json({ user, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
