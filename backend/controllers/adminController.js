const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');

// Hjelpefunksjon for JWT admin-sjekk 
const verifyAdmin = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            res.status(401).json({ error: 'Token required' });
            return null;
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user || user.role !== 'admin') {
            res.status(403).json({ error: 'Admin access required' });
            return null;
        }
        
        return user;
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
        return null;
    }
};

exports.getAllUsers = async (req, res) => {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;
    
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllOrders = async (req, res) => {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;
    
    try {
        const orders = await Order.find()
            .populate('customerId', 'name email')
            .populate('providerId', 'name email')
            .populate('serviceId', 'title');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.changeUserRole = async (req, res) => {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;
    
    try {
        const { role } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id, 
            { role }, 
            { new: true }
        ).select('-password');
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteUser = async (req, res) => {
    const admin = await verifyAdmin(req, res);
    if (!admin) return;
    
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};