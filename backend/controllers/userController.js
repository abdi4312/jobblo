const User = require('../models/User');
const Service = require('../models/Service');

// Create a new user
exports.createUser = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            avatarUrl,
            bio,
            role,
            subscription,
            verified,
            lastLogin,
            followers,
            following,
            availability,
            earnings,
            spending,
            oauthProviders
        } = req.body;

        const user = new User({
            name,
            email,
            phone,
            avatarUrl,
            bio,
            role,
            subscription,
            verified,
            lastLogin,
            followers,
            following,
            availability,
            earnings,
            spending,
            oauthProviders
        });
        await user.save();
        res.status(201).json(user);
    } catch (err) {
        if (err.code === 11000) {
            // Duplicate key error
            return res.status(400).json({ error: 'Email or phone already exists' });
        }
        res.status(400).json({ error: err.message });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getUserServices = async (req, res) => {
    try {
        const services = await Service.find({ userId: req.params.id });
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// List all users
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};