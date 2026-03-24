const List = require("../models/List");

// Get all lists for a user (where they are owner or contributor)
exports.getUserLists = async (req, res) => {
  try {
    // Check both 'user' (owner array) and 'contributors' array
    const lists = await List.find({
      $or: [{ user: req.userId }, { contributors: req.userId }],
    }).populate("services");
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
    const list = await List.findOne({ _id: listId, user: req.userId });

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
    const list = await List.findOne({ _id: listId, user: req.userId });

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

// Get list by ID (Owner and contributors can access)
exports.getListById = async (req, res) => {
  try {
    const { listId } = req.params;
    // Check if user is owner or contributor
    const list = await List.findOne({
      _id: listId,
      $or: [{ user: req.userId }, { contributors: req.userId }],
    })
      .populate("services")
      .populate("user", "name lastName avatarUrl email")
      .populate("contributors", "name lastName avatarUrl email");

    if (!list) {
      return res
        .status(404)
        .json({ message: "List not found or permission denied" });
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
