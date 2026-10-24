const User = require('../../models/User');
const { isValidId } = require('./userHelpers');

/** Blocking and unblocking other users. */

// Get blocked users list (More Reliable Version)
exports.getBlockedUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Fetch the user and populate blockedUsers
    const user = await User.findById(req.userId).populate(
      'blockedUsers',
      'name lastName avatarUrl'
    );

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Filter out any null entries (in case some IDs in the array don't exist in the database)
    const allBlocked = (user.blockedUsers || []).filter((u) => u !== null);

    const totalCount = allBlocked.length;
    const startIndex = (page - 1) * limit;
    const paginatedBlocked = allBlocked.slice(startIndex, startIndex + limit);

    res.json({
      data: paginatedBlocked,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Block/Unblock a user
exports.blockUser = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.id;

    if (!isValidId(currentUserId) || !isValidId(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: 'You cannot block yourself' });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isBlocked = currentUser.blockedUsers?.includes(targetUserId);

    if (isBlocked) {
      // Unblock
      await User.findByIdAndUpdate(currentUserId, {
        $pull: { blockedUsers: targetUserId },
      });
      return res.json({ message: 'User unblocked', isBlocked: false });
    } else {
      // Block
      await User.findByIdAndUpdate(currentUserId, {
        $addToSet: { blockedUsers: targetUserId },
      });

      return res.json({ message: 'User blocked', isBlocked: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
