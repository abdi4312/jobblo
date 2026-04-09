const List = require("../models/List");
const Service = require("../models/Service");
const Notification = require("../models/Notification");
const User = require("../models/User");
const notificationController = require("./notificationController");

// Get all lists for a user (where they are owner or contributor)
exports.getUserLists = async (req, res) => {
  try {
    const { userId } = req.query;
    const currentUserId = req.userId;

    let query = {};

    if (userId && userId !== currentUserId) {
      // If requesting another user's lists, only show public ones
      query = {
        $or: [{ user: userId }, { contributors: userId }],
        public: true,
      };
    } else {
      // Show all lists for current user
      query = {
        $or: [{ user: currentUserId }, { contributors: currentUserId }],
      };
    }

    const lists = await List.find(query)
      .populate("services")
      .populate("followers", "name lastName avatarUrl email");
    res.status(200).json(lists);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching lists", error: error.message });
  }
};

// Create a new list
exports.createList = async (req, res) => {
  try {
    const { name } = req.body;
    // user is an array in the original model
    const newList = new List({ name, user: [req.userId] });
    await newList.save();
    res.status(201).json(newList);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating list", error: error.message });
  }
};

// Add a service to a list (Owners and contributors can add)
exports.addServiceToList = async (req, res) => {
  try {
    const { listId, serviceId } = req.body;
    // Check if user is owner or contributor
    const list = await List.findOne({
      _id: listId,
      $or: [{ user: req.userId }, { contributors: req.userId }],
    });

    if (!list) {
      return res
        .status(404)
        .json({ message: "List not found or permission denied" });
    }

    if (list.services.includes(serviceId)) {
      return res.status(400).json({ message: "Service already in list" });
    }

    list.services.push(serviceId);
    list.latestservice = serviceId; // Keeping latestservice updated as per original model
    await list.save();

    // Send notification to the service provider
    const service = await Service.findById(serviceId);
    const currentUser = await User.findById(req.userId);

    if (service && service.userId && service.userId.toString() !== req.userId) {
      await notificationController.createAndEmitNotification(
        req.app.get("io"),
        {
          userId: service.userId,
          senderId: req.userId,
          type: "favorite",
          content: `${currentUser.name} added your item "${service.title}" to their list`,
        },
      );
    }

    res.status(200).json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding service to list", error: error.message });
  }
};

// Remove a service from a list (Owners and contributors can remove)
exports.removeServiceFromList = async (req, res) => {
  try {
    const { listId, serviceId } = req.params;
    // Check if user is owner or contributor
    const list = await List.findOne({
      _id: listId,
      $or: [{ user: req.userId }, { contributors: req.userId }],
    });

    if (!list) {
      return res
        .status(404)
        .json({ message: "List not found or permission denied" });
    }

    list.services = list.services.filter((id) => id.toString() !== serviceId);

    // Update latestservice if it was the one removed
    if (list.latestservice && list.latestservice.toString() === serviceId) {
      list.latestservice =
        list.services.length > 0
          ? list.services[list.services.length - 1]
          : null;
    }

    await list.save();
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({
      message: "Error removing service from list",
      error: error.message,
    });
  }
};

// Update a list
exports.updateList = async (req, res) => {
  try {
    const { listId } = req.params;
    const { name, description, public } = req.body;
    // Allow finding the list if user is owner OR contributor
    const list = await List.findOne({
      _id: listId,
      $or: [{ user: req.userId }, { contributors: req.userId }],
    });

    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    if (name) list.name = name;
    if (description !== undefined) list.description = description;
    if (public !== undefined) list.public = public;

    await list.save();
    res.status(200).json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating list", error: error.message });
  }
};

// Add contributors (Supports multiple)
exports.addContributors = async (req, res) => {
  try {
    const { listId } = req.params;
    const { userIds } = req.body; // Expecting an array of IDs
    const list = await List.findOne({ _id: listId, user: req.userId });

    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    if (Array.isArray(userIds)) {
      userIds.forEach((userId) => {
        if (!list.contributors.includes(userId)) {
          list.contributors.push(userId);
        }
      });
      await list.save();
    }

    res.status(200).json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding contributors", error: error.message });
  }
};

// Remove contributor
exports.removeContributor = async (req, res) => {
  try {
    const { listId, userId } = req.params;
    // Allow finding the list if user is owner OR contributor
    const list = await List.findOne({
      _id: listId,
      $or: [{ user: req.userId }, { contributors: req.userId }],
    });

    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    list.contributors = list.contributors.filter(
      (id) => id.toString() !== userId,
    );
    await list.save();
    res.status(200).json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error removing contributor", error: error.message });
  }
};

// Get list by ID (Owners, contributors, and anyone if public)
exports.getListById = async (req, res) => {
  try {
    const { listId } = req.params;
    // Check if user is owner, contributor, OR if the list is public
    const list = await List.findOne({
      _id: listId,
      $or: [
        { user: req.userId },
        { contributors: req.userId },
        { public: true },
      ],
    })
      .populate("services")
      .populate("user", "name lastName avatarUrl email")
      .populate("contributors", "name lastName avatarUrl email")
      .populate("followers", "name lastName avatarUrl email");

    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    res.status(200).json(list);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching list", error: error.message });
  }
};

// Delete a list
exports.deleteList = async (req, res) => {
  try {
    const { listId } = req.params;
    const list = await List.findOneAndDelete({ _id: listId, user: req.userId });

    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    res.status(200).json({ message: "List deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting list", error: error.message });
  }
};

// Toggle Follow a list
exports.toggleFollowList = async (req, res) => {
  try {
    const { listId } = req.params;
    const userId = req.userId;

    const list = await List.findById(listId);
    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    if (!list.public) {
      // Only public lists can be followed, unless you are a contributor
      const isContributor = list.contributors.some(
        (id) => id.toString() === userId,
      );
      const isOwner = list.user.some((id) => id.toString() === userId);
      if (!isContributor && !isOwner) {
        return res
          .status(403)
          .json({ message: "Cannot follow a private list" });
      }
    }

    const isFollowing = list.followers.some((id) => id.toString() === userId);

    if (isFollowing) {
      // Unfollow
      list.followers = list.followers.filter((id) => id.toString() !== userId);
    } else {
      // Follow
      list.followers.push(userId);
    }

    await list.save();
    res.status(200).json({
      message: isFollowing
        ? "Unfollowed successfully"
        : "Followed successfully",
      isFollowing: !isFollowing,
      followersCount: list.followers.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error toggling follow", error: error.message });
  }
};
