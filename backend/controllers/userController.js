const User = require('../models/User');
const Service = require('../models/Service');
const mongoose = require('mongoose');

// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper to authorize user 
function authorizeUser(req, targetUserId) {
  const currentUserId = req.userId;       
  const currentUserRole = req.user.role;

  // Only admin OR the same user can proceed
  if (currentUserRole !== "admin" && currentUserId !== targetUserId) {
    return false;
  }
  return true;
}

// Create a new user
exports.createUser = async (req, res) => {
    try {
        const {
            name,
            lastName,
            email,
            phone,
            avatarUrl,
            bio,
            role,
            birthDate,
            gender,
            address,
            postNumber,
            postSted,
            country,
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
            lastName,
            email,
            phone,
            avatarUrl,
            bio,
            role,
            birthDate,
            gender,
            address,
            postNumber,
            postSted,
            country,
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
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        // Authorization check
       if (!authorizeUser(req, id)) {
          return res.status(403).json({ error: "Not authorized" });
       }

        const user = await User.findById(id).select('-password');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({ error: "Invalid user ID format" });
        }

        // Authorization check
        if (!authorizeUser(req, id)) {
          return res.status(403).json({ error: "Not authorized" });
        }

         // Allowed fields for normal user
        const allowedUpdates = ["name", "email", "phone", "lastName", "bio", "birthDate","gender",
            "address","postNumber","postSted","country"];

        if (req.user.role === "admin") {
            allowedUpdates.push("role");
        }

        const updates = {};
         for (const key of allowedUpdates) {
           if (req.body[key] !== undefined) {
            updates[key] = req.body[key];
        }
         }

         if (updates.length === 0) {
            return res.status(400).json({ error: "No fields provided for update" });
        }
        // Prevent normal user from changing 'role'
            // ❌ If nothing to update, return early
        if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields provided for update" });
        }

        const user = await User.findByIdAndUpdate(id, updates, { new: true });

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Authorization check
    if (!authorizeUser(req, id)) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const user = await User.findByIdAndDelete(id);

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted' });
  } catch (err) {
        res.status(500).json({ error: 'Server error' });
  }
};

exports.getUserServices = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Authorization check
    if (!authorizeUser(req, id)) {
      return res.status(403).json({ error: "Not authorized" });
    }
    const services = await Service.find({ userId: id });
    res.json(services);
  } catch (err) {
        res.status(500).json({ error: 'Server error' });
  }
};

// List all users
exports.getAllUsers = async (req, res) => {
  try {
        const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
        res.status(500).json({ error: 'Server error' });
  }
};

// Follow/Unfollow a user
exports.followUser = async (req, res) => {
  try {
    const currentUserId = req.userId;
        const targetUserId = req.params.id

    // Validate IDs
    if (!isValidId(currentUserId) || !isValidId(targetUserId)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    // Can't follow yourself
    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: "You cannot follow yourself" });
    }

    // Fetch users
    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
            User.findById(targetUserId)
        ])

    if (!currentUser || !targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(currentUserId, {
                $pull: { following: targetUserId }
      });

      await User.findByIdAndUpdate(targetUserId, {
                $pull: { followers: currentUserId }
      });

      return res.json({ message: "Unfollowed", isFollowing: false });
    } else {
      // Follow
      await User.findByIdAndUpdate(currentUserId, {
                $addToSet: { following: targetUserId }
      });

      await User.findByIdAndUpdate(targetUserId, {
                $addToSet: { followers: currentUserId }
      });

      return res.json({ message: "Followed", isFollowing: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};