const mongoose = require('mongoose');
const List = require('../models/List');
const Service = require('../models/Service');
const Notification = require('../models/Notification');
const User = require('../models/User');
const notificationController = require('./notificationController');

/**
 * Favorite / saved list controller.
 *
 * Two things are deliberate here and must not be relaxed again:
 *
 * 1. Error bodies carry a stable machine `code` and a short message. They no longer
 *    carry `error: error.message`. Mongoose validation and cast errors were being
 *    forwarded verbatim to the client, and `frontend/src/utils/getErrorMessage.ts`
 *    prefers the `error` field over `message` — so a raw Mongo string ended up in a
 *    user-facing toast. The exception is logged server-side instead.
 *
 * 2. Ownership-level metadata is owner-only. `List.user` is an array in the model, so
 *    `{ _id, user: req.userId }` is an array-containment match, not an equality bug.
 */
const LIST_NAME_MAX_LENGTH = 60;

const isValidId = (value) => mongoose.Types.ObjectId.isValid(String(value ?? ''));

/**
 * Normalizes a submitted list name. Returns `{ ok: false }` for anything that would
 * otherwise reach Mongo as a required-field failure or as a whitespace-only name.
 */
function normalizeListName(value) {
  if (typeof value !== 'string') return { ok: false };
  const name = value.trim();
  if (!name) return { ok: false };
  if (name.length > LIST_NAME_MAX_LENGTH) return { ok: false };
  return { ok: true, name };
}

const idsInclude = (values, target) =>
  Array.isArray(values) && values.some((value) => String(value?._id ?? value) === String(target));

/** One place to log the real cause without ever putting it in the response body. */
function failed(res, status, code, message, error) {
  if (error) console.error(`[lists] ${code}:`, error.message);
  return res.status(status).json({ code, message });
}

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

    const lists = await List.find(query).populate('services');
    res.status(200).json(lists);
  } catch (error) {
    return failed(res, 500, 'lists_fetch_failed', 'Error fetching lists', error);
  }
};

// Create a new list
exports.createList = async (req, res) => {
  try {
    const parsed = normalizeListName(req.body?.name);
    if (!parsed.ok) {
      return failed(
        res,
        400,
        'invalid_list_name',
        `List name is required and must be at most ${LIST_NAME_MAX_LENGTH} characters`
      );
    }

    // user is an array in the original model
    const newList = new List({ name: parsed.name, user: [req.userId] });
    await newList.save();
    res.status(201).json(newList);
  } catch (error) {
    return failed(res, 500, 'list_create_failed', 'Error creating list', error);
  }
};

// Add a service to a list (Owners and contributors can add)
exports.addServiceToList = async (req, res) => {
  try {
    const { listId, serviceId } = req.body || {};

    if (!isValidId(listId) || !isValidId(serviceId)) {
      return failed(res, 400, 'invalid_id', 'A valid list id and service id are required');
    }

    // Check if user is owner or contributor
    const list = await List.findOne({
      _id: listId,
      $or: [{ user: req.userId }, { contributors: req.userId }],
    });

    if (!list) {
      return failed(res, 404, 'list_not_found', 'List not found or permission denied');
    }

    if (list.services.includes(serviceId)) {
      return failed(res, 400, 'service_already_in_list', 'Service already in list');
    }

    /**
     * The service is resolved BEFORE it is written to the list. This used to run after
     * `list.save()` — purely to build the notification — which meant a bad or deleted
     * serviceId was persisted as a dangling reference that `populate('services')` then
     * silently dropped, leaving a list whose stored length disagreed with what every
     * screen rendered.
     */
    const service = await Service.findById(serviceId);
    if (!service) {
      return failed(res, 404, 'service_not_found', 'Service not found');
    }

    list.services.push(serviceId);
    list.latestservice = serviceId; // Keeping latestservice updated as per original model
    await list.save();

    // Send notification to the service provider
    if (service.userId && service.userId.toString() !== req.userId) {
      const currentUser = await User.findById(req.userId);
      await notificationController.createAndEmitNotification(req.app.get('io'), {
        userId: service.userId,
        senderId: req.userId,
        type: 'favorite',
        content: `${currentUser?.name ?? 'En bruker'} added your item "${service.title}" to their list`,
      });
    }

    res.status(200).json(list);
  } catch (error) {
    return failed(res, 500, 'add_service_failed', 'Error adding service to list', error);
  }
};

// Remove a service from a list (Owners and contributors can remove)
exports.removeServiceFromList = async (req, res) => {
  try {
    const { listId, serviceId } = req.params;

    if (!isValidId(listId) || !isValidId(serviceId)) {
      return failed(res, 400, 'invalid_id', 'A valid list id and service id are required');
    }

    // Check if user is owner or contributor
    const list = await List.findOne({
      _id: listId,
      $or: [{ user: req.userId }, { contributors: req.userId }],
    });

    if (!list) {
      return failed(res, 404, 'list_not_found', 'List not found or permission denied');
    }

    list.services = list.services.filter((id) => id.toString() !== serviceId);

    // Update latestservice if it was the one removed
    if (list.latestservice && list.latestservice.toString() === serviceId) {
      list.latestservice =
        list.services.length > 0 ? list.services[list.services.length - 1] : null;
    }

    await list.save();
    res.status(200).json(list);
  } catch (error) {
    return failed(res, 500, 'remove_service_failed', 'Error removing service from list', error);
  }
};

// Update a list (OWNER ONLY — see the security note below)
exports.updateList = async (req, res) => {
  try {
    const { listId } = req.params;
    // `public` is a reserved word in strict mode and cannot be bound as an identifier,
    // so it is renamed on the way out of the body. The field on the document keeps its
    // name — only the local binding changes.
    const { name, description, public: isPublic } = req.body || {};

    if (!isValidId(listId)) {
      return failed(res, 400, 'invalid_id', 'A valid list id is required');
    }

    /**
     * SECURITY: this used to match `{ $or: [{ user }, { contributors }] }`, so any
     * contributor could rename the list, rewrite its description, or flip it from
     * private to public — publishing the owner's saved services to anyone holding the
     * id, since `getListById` admits any caller when `public` is true. Contributors are
     * an invited-collaborator role for the *contents* of a list; the list's identity and
     * visibility belong to the owner. No product rule granted them that, and no UI ever
     * offered it (web renders the rename/visibility controls under `isOwner`), so the
     * permissive query was reachable only by calling the API directly.
     */
    const list = await List.findOne({ _id: listId, user: req.userId });

    if (!list) {
      return failed(res, 404, 'list_not_found', 'List not found');
    }

    if (name !== undefined) {
      const parsed = normalizeListName(name);
      if (!parsed.ok) {
        return failed(
          res,
          400,
          'invalid_list_name',
          `List name is required and must be at most ${LIST_NAME_MAX_LENGTH} characters`
        );
      }
      list.name = parsed.name;
    }
    if (description !== undefined) list.description = description;
    if (isPublic !== undefined) list.public = isPublic;

    await list.save();
    res.status(200).json(list);
  } catch (error) {
    return failed(res, 500, 'list_update_failed', 'Error updating list', error);
  }
};

// Add contributors (Supports multiple)
exports.addContributors = async (req, res) => {
  try {
    const { listId } = req.params;
    const { userIds } = req.body || {}; // Expecting an array of IDs

    if (!isValidId(listId)) {
      return failed(res, 400, 'invalid_id', 'A valid list id is required');
    }

    const list = await List.findOne({ _id: listId, user: req.userId });

    if (!list) {
      return failed(res, 404, 'list_not_found', 'List not found');
    }

    if (Array.isArray(userIds)) {
      userIds.filter(isValidId).forEach((userId) => {
        if (!list.contributors.includes(userId)) {
          list.contributors.push(userId);
        }
      });
      await list.save();
    }

    res.status(200).json(list);
  } catch (error) {
    return failed(res, 500, 'add_contributors_failed', 'Error adding contributors', error);
  }
};

// Remove contributor (owner removes anyone; a contributor may only remove themselves)
exports.removeContributor = async (req, res) => {
  try {
    const { listId, userId } = req.params;

    if (!isValidId(listId) || !isValidId(userId)) {
      return failed(res, 400, 'invalid_id', 'A valid list id and user id are required');
    }

    const list = await List.findById(listId);

    if (!list) {
      return failed(res, 404, 'list_not_found', 'List not found');
    }

    const isOwner = idsInclude(list.user, req.userId);
    const isContributor = idsInclude(list.contributors, req.userId);

    // Unrelated callers must not learn that the list exists.
    if (!isOwner && !isContributor) {
      return failed(res, 404, 'list_not_found', 'List not found');
    }

    /**
     * SECURITY: the previous query was `{ $or: [{ user }, { contributors }] }` followed
     * by an unconditional filter on the `userId` path param, so ANY contributor could
     * evict any other contributor — or the co-owner entry — from a list they did not
     * own. Removal is an owner action; the only thing a contributor may do is leave.
     */
    if (!isOwner && String(userId) !== String(req.userId)) {
      return failed(
        res,
        403,
        'contributor_cannot_remove_others',
        'Only the list owner can remove other contributors'
      );
    }

    list.contributors = list.contributors.filter((id) => id.toString() !== userId);
    await list.save();
    res.status(200).json(list);
  } catch (error) {
    return failed(res, 500, 'remove_contributor_failed', 'Error removing contributor', error);
  }
};

// Get list by ID (Owners, contributors, and anyone if public)
exports.getListById = async (req, res) => {
  try {
    const { listId } = req.params;

    if (!isValidId(listId)) {
      return failed(res, 400, 'invalid_id', 'A valid list id is required');
    }

    /**
     * Left as owner OR contributor OR `public: true`. That is the existing sharing
     * contract — `updateList` is the only way a list becomes public and it is now
     * owner-only, so a private list can no longer be exposed by a collaborator. Private
     * lists remain unreachable for unrelated callers.
     */
    const list = await List.findOne({
      _id: listId,
      $or: [{ user: req.userId }, { contributors: req.userId }, { public: true }],
    })
      .populate('services')
      .populate('user', 'name lastName avatarUrl email')
      .populate('contributors', 'name lastName avatarUrl email');

    if (!list) {
      return failed(res, 404, 'list_not_found', 'List not found');
    }

    res.status(200).json(list);
  } catch (error) {
    return failed(res, 500, 'list_fetch_failed', 'Error fetching list', error);
  }
};

// Delete a list (owner only — `user` is an array, so this is a containment match)
exports.deleteList = async (req, res) => {
  try {
    const { listId } = req.params;

    if (!isValidId(listId)) {
      return failed(res, 400, 'invalid_id', 'A valid list id is required');
    }

    const list = await List.findOneAndDelete({ _id: listId, user: req.userId });

    if (!list) {
      return failed(res, 404, 'list_not_found', 'List not found');
    }

    res.status(200).json({ message: 'List deleted successfully' });
  } catch (error) {
    return failed(res, 500, 'list_delete_failed', 'Error deleting list', error);
  }
};

