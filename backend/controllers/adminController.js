const bcrypt = require('bcryptjs');
const Service = require('../models/Service');
const User = require('../models/User');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

/**
 * Legacy admin controller — kept for backward compatibility with existing routes.
 * New features use backend/controllers/admin/ modular controllers.
 */

// Authentication handled by middleware - req.user and req.userId available
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    let query = { isDeleted: { $ne: true } };
    if (req.query.search) {
      const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (req.query.role) {
      const validRoles = ['user', 'provider', 'company', 'superAdmin'];
      if (validRoles.includes(req.query.role)) {
        query.role = req.query.role;
      }
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalUsers, activeThisMonth, users] = await Promise.all([
      User.countDocuments(query),
      User.countDocuments({ isDeleted: { $ne: true }, createdAt: { $gte: startOfMonth } }),
      User.find(query)
        .select('-password -passwordResetToken -passwordResetExpires')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
    ]);

    res.json({
      users,
      totalPages: Math.ceil(totalUsers / limit),
      currentPage: page,
      totalUsers,
      activeThisMonth,
    });
  } catch (err) {
    console.error('[Admin] getAllUsers error');
    res.status(500).json({ error: 'Serverfeil.' });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    const ASSIGNABLE_ROLES = ['user', 'provider', 'company'];
    if (role && !ASSIGNABLE_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ message: `Ugyldig rolle. Tillatte roller: ${ASSIGNABLE_ROLES.join(', ')}.` });
    }

    const hashed = await bcrypt.hash(password, 12);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'E-postadressen er allerede registrert.' });
    }

    const newUser = new User({
      name,
      email,
      phone: phone?.trim() || undefined,
      password: hashed,
      role: role || 'user',
    });

    await newUser.save();
    const safeUser = newUser.toObject();
    delete safeUser.password;
    res.status(201).json({ message: 'Bruker opprettet.', user: safeUser });
  } catch (error) {
    console.error('[Admin] createUser error');
    res.status(500).json({ message: 'Kunne ikke opprette bruker.' });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const total = await Order.countDocuments();
    const orders = await Order.find()
      .populate('customerId', 'name email')
      .populate('providerId', 'name email')
      .populate('serviceId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    console.error('[Admin] getAllOrders error');
    res.status(500).json({ error: 'Serverfeil.' });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalServices = await Service.countDocuments();
    const services = await Service.find().skip(skip).limit(limit).sort({ createdAt: -1 });

    res.json({
      services,
      totalPages: Math.ceil(totalServices / limit),
      currentPage: page,
      totalResults: totalServices,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Admin control for viewing broadcast history
exports.getSystemNotificationsHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Filter: Sirf system-wide alerts (global broadcasts)
    const query = { userId: null, isSystem: true };

    const total = await Notification.countDocuments(query);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 }) // Latest first
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      data: notifications,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const ASSIGNABLE_ROLES = ['user', 'provider', 'company'];
    if (!role || !ASSIGNABLE_ROLES.includes(role)) {
      return res
        .status(400)
        .json({ error: `Ugyldig rolle. Tillatte roller: ${ASSIGNABLE_ROLES.join(', ')}.` });
    }

    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Ugyldig bruker-ID.' });
    }

    // Prevent self-demotion
    if (req.params.id === req.user._id.toString()) {
      return res.status(403).json({ error: 'Du kan ikke endre din egen rolle.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password -passwordResetToken -passwordResetExpires');
    if (!user) return res.status(404).json({ error: 'Bruker ikke funnet.' });
    res.json(user);
  } catch (err) {
    console.error('[Admin] changeUserRole error');
    res.status(500).json({ error: 'Serverfeil.' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Ugyldig bruker-ID.' });
    }

    // Cannot delete self
    if (req.params.id === req.user._id.toString()) {
      return res.status(403).json({ error: 'Du kan ikke slette din egen konto.' });
    }

    const targetUser = await User.findById(req.params.id).select('role isDeleted');
    if (!targetUser || targetUser.isDeleted) {
      return res.status(404).json({ error: 'Bruker ikke funnet.' });
    }

    // Cannot delete the last superAdmin
    if (targetUser.role === 'superAdmin') {
      const count = await User.countDocuments({ role: 'superAdmin', isDeleted: { $ne: true } });
      if (count <= 1) {
        return res.status(403).json({ error: 'Kan ikke slette den siste superadmin.' });
      }
    }

    // Soft delete — preserves financial and order history
    await User.findByIdAndUpdate(req.params.id, {
      isDeleted: true,
      deletedAt: new Date(),
      accountStatus: 'inactive',
    });

    res.json({ message: 'Bruker deaktivert og arkivert.' });
  } catch (err) {
    console.error('[Admin] deleteUser error');
    res.status(500).json({ error: 'Serverfeil.' });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');

    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ error: 'Invalid service ID format' });

    const service = await Service.findById(id);
    if (!service) return res.status(404).json({ error: 'Service not found' });

    // ⭐ DELETE ALL IMAGES FROM AZURE
    if (service.imageMetadata && service.imageMetadata.length > 0) {
      const { deleteFromAzure } = require('../utils/azureUpload');
      for (const meta of service.imageMetadata) {
        if (meta.blobName) await deleteFromAzure(meta.blobName);
      }
    }

    await service.deleteOne();

    res.json({ message: 'Service deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
