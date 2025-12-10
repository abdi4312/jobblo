const User = require('../models/User');
const Service = require('../models/Service');

exports.getFollowingFeed = async (req, res) => {
    try {
        const userId = req.userId; // Always authenticated user

        // Fetch only fields needed to reduce payload + speed up query
        const user = await User.findById(userId).select('following');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Empty feed if user follows no one
        if (!user.following || user.following.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const services = await Service.find({
            userId: { $in: user.following },
            status: 'open'
        })
            .populate('userId', 'name avatarUrl verified')
            .populate('categories', 'name')
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            count: services.length,
            data: services
        });

    } catch (error) {
        console.error("FEED ERROR:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
