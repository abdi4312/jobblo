const User = require("../models/User");
const Service = require("../models/Service");
const mongoose = require("mongoose");
const Category = require("../models/Category");
const List = require("../models/List");
const Notification = require("../models/Notification");

// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper to authorize user
function authorizeUser(req, targetUserId) {
  const currentUserId = req.userId;
  const currentUserRole = req.user?.role;

  // Only superAdmin OR the same user can proceed
  if (currentUserRole !== "superAdmin" && currentUserId !== targetUserId) {
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
      oauthProviders,
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
      oauthProviders,
    });
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error
      return res.status(400).json({ error: "Email or phone already exists" });
    }
    res.status(400).json({ error: err.message });
  }
};

// Search users
exports.searchUsers = async (req, res) => {
  try {
    const query = req.query.query || req.query.q;
    console.log("Search query:", query);
    if (!query || query.length < 2) {
      return res.status(200).json([]);
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
      _id: { $ne: req.userId }, // Exclude current user
    }).limit(10);

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Top 10 Users by Rating and Reviews
exports.getTopUsers = async (req, res) => {
  try {
    const topUsers = await User.find({ _id: { $ne: req.userId } })
      .select("name lastName email avatarUrl averageRating reviewCount")
      .sort({ reviewCount: -1, averageRating: -1 })
      .limit(10);
    res.status(200).json(topUsers);
  } catch (error) {
    console.error("Get top users error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Unified Search for Categories, People, and Public Lists with Pagination
exports.searchAll = async (req, res) => {
  try {
    const { query, type, page = 1, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(200).json({
        categories: { results: [], total: 0 },
        people: { results: [], total: 0 },
        lists: { results: [], total: 0 },
      });
    }

    const regex = new RegExp(query, "i");
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const numericLimit = parseInt(limit);

    // If a specific type is requested, return only that type with pagination
    if (type) {
      let results = [];
      let total = 0;

      if (type === "categories") {
        total = await Category.countDocuments({ name: regex, isActive: true });
        results = await Category.find({ name: regex, isActive: true })
          .skip(skip)
          .limit(numericLimit);
      } else if (type === "people") {
        const queryObj = {
          $or: [{ name: regex }, { lastName: regex }, { email: regex }],
          _id: { $ne: req.userId },
        };
        total = await User.countDocuments(queryObj);
        results = await User.find(queryObj)
          .select("name lastName avatarUrl email averageRating reviewCount")
          .skip(skip)
          .limit(numericLimit);
      } else if (type === "lists") {
        total = await List.countDocuments({ name: regex, public: true });
        results = await List.find({ name: regex, public: true })
          .populate("services")
          .skip(skip)
          .limit(numericLimit);
      }

      return res.status(200).json({
        results,
        total,
        page: parseInt(page),
        limit: numericLimit,
        totalPages: Math.ceil(total / numericLimit),
      });
    }

    // Default: return top 3 for each category (for the initial search dropdown)
    // 1. Search Categories
    const categoriesCount = await Category.countDocuments({
      name: regex,
      isActive: true,
    });
    const categories = await Category.find({
      name: regex,
      isActive: true,
    }).limit(3);

    // 2. Search People (Users)
    const peopleCount = await User.countDocuments({
      $or: [{ name: regex }, { lastName: regex }, { email: regex }],
      _id: { $ne: req.userId },
    });
    const people = await User.find({
      $or: [{ name: regex }, { lastName: regex }, { email: regex }],
      _id: { $ne: req.userId },
    })
      .select("name lastName avatarUrl email averageRating reviewCount")
      .limit(3);

    // 3. Search Public Lists
    const listsCount = await List.countDocuments({
      name: regex,
      public: true,
    });
    const lists = await List.find({
      name: regex,
      public: true,
    })
      .populate("services")
      .limit(3);

    res.status(200).json({
      categories: { results: categories, total: categoriesCount },
      people: { results: people, total: peopleCount },
      lists: { results: lists, total: listsCount },
    });
  } catch (error) {
    console.error("Unified search error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const user = await User.findById(id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
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
    const allowedUpdates = [
      "name",
      "email",
      "phone",
      "lastName",
      "bio",
      "birthDate",
      "gender",
      "address",
      "postNumber",
      "postSted",
      "country",
    ];

    if (req.user.role === "superAdmin") {
      allowedUpdates.push("role");
    }

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // ⭐ HANDLE AVATAR UPLOAD
    if (req.file) {
      updates.avatarUrl = req.file.path;
      updates.avatarPublicId = req.file.filename;
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ error: "No valid fields provided for update" });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Delete old avatar if a new one is uploaded
    if (req.file && user.avatarPublicId) {
      const cloudinary = require("../config/cloudinary");
      try {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      } catch (err) {
        console.error("Old avatar deletion error:", err);
      }
    }

    const updatedUser = await User.findByIdAndUpdate(id, updates, {
      new: true,
    });
    res.json(updatedUser);
  } catch (err) {
    console.error("updateUser Error:", err);
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

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getUserServices = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    const services = await Service.find({ userId: id });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// List all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

// Follow/Unfollow a user
exports.followUser = async (req, res) => {
  try {
    const currentUserId = req.userId;
    const targetUserId = req.params.id;

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
      User.findById(targetUserId),
    ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(currentUserId, {
        $pull: { following: targetUserId },
      });

      await User.findByIdAndUpdate(targetUserId, {
        $pull: { followers: currentUserId },
      });
      return res.json({ message: "Unfollowed", isFollowing: false });
    } else {
      // Follow
      await User.findByIdAndUpdate(currentUserId, {
        $addToSet: { following: targetUserId },
      });

      await User.findByIdAndUpdate(targetUserId, {
        $addToSet: { followers: currentUserId },
      });

      // Create notification for the target user
      await Notification.create({
        userId: targetUserId,
        senderId: currentUserId,
        type: "follow",
        content: `${currentUser.name} started following you`,
      });

      return res.json({ message: "Followed", isFollowing: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get blocked users list (More Reliable Version)
exports.getBlockedUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Fetch the user and populate blockedUsers
    const user = await User.findById(req.userId).populate(
      "blockedUsers",
      "name lastName avatarUrl",
    );

    if (!user) return res.status(404).json({ error: "User not found" });

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
      return res.status(400).json({ error: "Invalid user ID format" });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isBlocked = currentUser.blockedUsers?.includes(targetUserId);

    if (isBlocked) {
      // Unblock
      await User.findByIdAndUpdate(currentUserId, {
        $pull: { blockedUsers: targetUserId },
      });
      return res.json({ message: "User unblocked", isBlocked: false });
    } else {
      // Block
      await User.findByIdAndUpdate(currentUserId, {
        $addToSet: { blockedUsers: targetUserId },
      });

      // Also unfollow automatically if blocking
      await User.findByIdAndUpdate(currentUserId, {
        $pull: { following: targetUserId, followers: targetUserId },
      });
      await User.findByIdAndUpdate(targetUserId, {
        $pull: { followers: currentUserId, following: currentUserId },
      });

      return res.json({ message: "User blocked", isBlocked: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
