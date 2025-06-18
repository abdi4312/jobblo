const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.status(201).json({ user, token });
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    const match = await bcrypt.compare(password, user?.password || '');
    if (!user || !match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ user, token });
};

exports.me = async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json(user);
};
