const Service = require('../../models/Service');
const Order = require('../../models/Order');
const mongoose = require('mongoose');
const { isValidId } = require('./serviceHelpers');

/** Work progress on a listing: time entries and the checklist. */

// ------------------- Time Entries -------------------

exports.addTimeEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { hours, date, note } = req.body;

    if (!isValidId(id)) return res.status(400).json({ error: 'Invalid service ID' });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // Time is logged against the caller, never against a user named in the body.
    // `userId` used to come from req.body with no ownership check at all, so any
    // logged-in user could write a billable entry on any listing and attribute it to
    // anyone.
    const userId = req.userId;

    // The owner logs time on their own job; the assigned worker logs time on a job
    // they were awarded. Nobody else.
    const isOwner = String(service.userId) === String(userId);
    let isAssignedWorker = false;
    if (!isOwner) {
      const order = await Order.findOne({
        serviceId: service._id,
        providerId: userId,
        status: { $in: ['paid', 'in_progress', 'ready_for_review'] },
      }).select('_id');
      isAssignedWorker = Boolean(order);
    }
    if (!isOwner && !isAssignedWorker) {
      return res.status(403).json({ error: 'Ikke autorisert for dette oppdraget.' });
    }

    const numericHours = Number(hours);
    if (!Number.isFinite(numericHours) || numericHours <= 0 || numericHours > 24) {
      return res.status(400).json({ error: 'hours må være mellom 0 og 24' });
    }
    const entryDate = date ? new Date(date) : new Date();
    if (Number.isNaN(entryDate.getTime())) {
      return res.status(400).json({ error: 'Ugyldig dato' });
    }

    service.timeEntries.push({ userId, hours: numericHours, date: entryDate, note });
    await service.save();

    res.status(201).json(service.timeEntries.at(-1));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getTimeEntries = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    res.json(service.timeEntries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ------------------- Checklist -------------------

exports.updateChecklistItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { checked } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Ticking off work was authenticated but not authorized — any logged-in user could
    // mark items complete on any listing, and be stamped into `checkedBy` doing it.
    // The owner or the assigned worker only.
    const isOwner = String(service.userId) === String(userId);
    let isAssignedWorker = false;
    if (!isOwner) {
      const order = await Order.findOne({
        serviceId: service._id,
        providerId: userId,
        status: { $in: ['paid', 'in_progress', 'ready_for_review'] },
      }).select('_id');
      isAssignedWorker = Boolean(order);
    }
    if (!isOwner && !isAssignedWorker) {
      return res.status(403).json({ error: 'Ikke autorisert for dette oppdraget.' });
    }

    // Find the checklist item
    const checklistItem = service.checklist.find((item) => item.id === itemId);
    if (!checklistItem) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    // Update the item
    checklistItem.checked = checked;
    checklistItem.checkedBy = checked ? userId : null;
    checklistItem.checkedAt = checked ? new Date() : null;

    await service.save();

    res.json(service.checklist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
