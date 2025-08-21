const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashed, phone });
        
        let token = null;
        if (process.env.JWT_SECRET) {
            token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        }
        
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
        
        res.json({ user, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
