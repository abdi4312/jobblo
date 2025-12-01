exports.getFollowingFeed = async (req, res) => {
    try {
        const userId = req.userId; // Fra authenticate middleware

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.following || user.following.length === 0) {
            return res.json([]); // Tom feed
        }

        const services = await Service.find({
            userId: { $in: user.following },
            status: 'open'
        })
            .populate('userId', 'name avatarUrl verified')
            .populate('categories', 'name')
            .sort({ createdAt: -1 }); // Nyeste først

        res.json(services);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
