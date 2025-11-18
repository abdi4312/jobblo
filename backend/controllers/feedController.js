const Service = require('../models/Service');
const User = require('../models/User');

exports.getFollowingFeed = async (req, res) => {
    try {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.following.length === 0) {
            return res.json([]);
        }
        
        const services = await Service.find({
            userId: { $in: user.following },
            status: 'open'
        })
        .populate('userId', 'name avatarUrl verified')
        .populate('categories', 'name')
        .sort({ _id: -1 }); // Newest first
        
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
