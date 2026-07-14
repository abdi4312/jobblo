const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Session = require('../../models/Session');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId, parseSort, parseDate } = require('../../utils/pagination');
const { logActivity } = require('../../services/admin/activityService');

// Allowed role values — canonical set. 'superAdmin' is not assignable via normal form.
const ASSIGNABLE_ROLES = ['user', 'provider', 'company'];
const ALL_ROLES = ['user', 'provider', 'company', 'superAdmin'];

// Fields never returned in user lists or details
const SENSITIVE_SELECT = '-password -passwordResetToken -passwordResetExpires';

// Allowed sort fields for users list
const SORT_FIELDS = ['name', 'email', 'createdAt', 'lastLogin', 'role'];

/**
 * GET /api/admin/users
 * Server-side paginated, searchable, filterable user list.
 */
const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const sort = parseSort(req.query.sortBy, req.query.sortOrder, SORT_FIELDS, 'createdAt');

  const query = { isDeleted: { $ne: true } };

  if (req.query.search) {
    const escaped = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (req.query.role && ALL_ROLES.includes(req.query.role)) {
    query.role = req.query.role;
  }

  if (req.query.accountStatus && ['active', 'inactive', 'verified'].includes(req.query.accountStatus)) {
    query.accountStatus = req.query.accountStatus;
  }

  if (req.query.verified === 'true') query.verified = true;
  if (req.query.verified === 'false') query.verified = false;

  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = dateFrom;
    if (dateTo) query.createdAt.$lte = new Date(dateTo.setHours(23, 59, 59, 999));
  }

  // Also filter for archived/deleted when explicitly requested
  if (req.query.showDeleted === 'true') {
    delete query.isDeleted;
    query.isDeleted = true;
  }

  const [total, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .select(SENSITIVE_SELECT)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return sendSuccess(res, { users }, 'Brukere hentet.', buildPagination(total, page, limit));
});

/**
 * POST /api/admin/users
 * Create a new user. Role cannot be set to superAdmin through this endpoint.
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  if (!name || !email || !password) {
    return sendError(res, 'Navn, e-post og passord er påkrevd.', 400);
  }

  if (role && !ASSIGNABLE_ROLES.includes(role)) {
    return sendError(res, `Ugyldig rolle. Tillatte roller: ${ASSIGNABLE_ROLES.join(', ')}.`, 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return sendError(res, 'E-postadressen er allerede registrert.', 409);
  }

  const hashed = await bcrypt.hash(password, 12);
  const newUser = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone?.trim() || undefined,
    password: hashed,
    role: role || 'user',
  });

  await logActivity({
    adminId: req.user._id,
    action: 'user_created',
    targetModel: 'User',
    targetId: newUser._id,
    description: `Admin opprettet bruker: ${newUser.email}`,
    metadata: { role: newUser.role },
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const safeUser = newUser.toObject();
  delete safeUser.password;
  delete safeUser.passwordResetToken;
  delete safeUser.passwordResetExpires;

  return sendSuccess(res, { user: safeUser }, 'Bruker opprettet.', null, 201);
});

/**
 * GET /api/admin/users/:id
 * User detail without sensitive fields.
 */
const getUserById = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig bruker-ID.', 400);

  const user = await User.findOne({ _id: id, isDeleted: { $ne: true } })
    .select(SENSITIVE_SELECT)
    .lean();

  if (!user) return sendError(res, 'Bruker ikke funnet.', 404);

  return sendSuccess(res, { user });
});

/**
 * PUT /api/admin/users/:id/role
 * Change a user's role. Cannot assign superAdmin. Cannot demote self.
 * Cannot remove the last superAdmin.
 */
const changeUserRole = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig bruker-ID.', 400);

  const { role } = req.body;
  if (!role || !ASSIGNABLE_ROLES.includes(role)) {
    return sendError(
      res,
      `Ugyldig rolle. Tilgjengelige roller: ${ASSIGNABLE_ROLES.join(', ')}.`,
      400
    );
  }

  // Prevent demoting self
  if (id.equals(req.user._id)) {
    return sendError(res, 'Du kan ikke endre din egen rolle.', 403);
  }

  const targetUser = await User.findById(id).select('role name email isDeleted').lean();
  if (!targetUser || targetUser.isDeleted) {
    return sendError(res, 'Bruker ikke funnet.', 404);
  }

  const prevRole = targetUser.role;

  // If the target is a superAdmin, prevent demotion if they are the last one
  if (prevRole === 'superAdmin') {
    const superAdminCount = await User.countDocuments({
      role: 'superAdmin',
      isDeleted: { $ne: true },
    });
    if (superAdminCount <= 1) {
      return sendError(res, 'Kan ikke endre rollen til den siste superadmin.', 403);
    }
  }

  const updated = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true, runValidators: true }
  ).select(SENSITIVE_SELECT);

  if (!updated) return sendError(res, 'Bruker ikke funnet.', 404);

  await logActivity({
    adminId: req.user._id,
    action: 'role_change',
    targetModel: 'User',
    targetId: id,
    description: `Rolle endret fra "${prevRole}" til "${role}" for ${targetUser.email}`,
    metadata: { prevRole, newRole: role },
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { user: updated }, 'Brukerrolle oppdatert.');
});

/**
 * PUT /api/admin/users/:id/status
 * Activate or deactivate a user account.
 */
const updateUserStatus = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig bruker-ID.', 400);

  const { accountStatus } = req.body;
  if (!accountStatus || !['active', 'inactive', 'verified'].includes(accountStatus)) {
    return sendError(res, 'Ugyldig kontostatus. Tillatte verdier: active, inactive, verified.', 400);
  }

  if (id.equals(req.user._id)) {
    return sendError(res, 'Du kan ikke endre din egen kontostatus.', 403);
  }

  const user = await User.findByIdAndUpdate(
    id,
    { accountStatus },
    { new: true }
  ).select(SENSITIVE_SELECT);

  if (!user) return sendError(res, 'Bruker ikke funnet.', 404);

  const action = accountStatus === 'inactive' ? 'user_deactivated' : 'user_activated';
  await logActivity({
    adminId: req.user._id,
    action,
    targetModel: 'User',
    targetId: id,
    description: `Kontostatus satt til "${accountStatus}" for ${user.email}`,
    metadata: { accountStatus },
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { user }, 'Kontostatus oppdatert.');
});

/**
 * PUT /api/admin/users/:id/verify
 * Mark a user as verified.
 */
const verifyUser = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig bruker-ID.', 400);

  const user = await User.findByIdAndUpdate(
    id,
    { verified: true, accountStatus: 'verified' },
    { new: true }
  ).select(SENSITIVE_SELECT);

  if (!user) return sendError(res, 'Bruker ikke funnet.', 404);

  await logActivity({
    adminId: req.user._id,
    action: 'user_verified',
    targetModel: 'User',
    targetId: id,
    description: `Bruker verifisert: ${user.email}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { user }, 'Bruker verifisert.');
});

/**
 * DELETE /api/admin/users/:id
 * Soft delete — sets isDeleted, deletedAt, accountStatus=inactive.
 * Never hard-deletes a user with associated data.
 * Cannot delete self or the last superAdmin.
 */
const softDeleteUser = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig bruker-ID.', 400);

  // Cannot delete self
  if (id.equals(req.user._id)) {
    return sendError(res, 'Du kan ikke slette din egen konto.', 403);
  }

  const targetUser = await User.findById(id).select('role name email isDeleted').lean();
  if (!targetUser || targetUser.isDeleted) {
    return sendError(res, 'Bruker ikke funnet.', 404);
  }

  // Cannot delete the last superAdmin
  if (targetUser.role === 'superAdmin') {
    const superAdminCount = await User.countDocuments({
      role: 'superAdmin',
      isDeleted: { $ne: true },
    });
    if (superAdminCount <= 1) {
      return sendError(res, 'Kan ikke slette den siste superadmin.', 403);
    }
  }

  await User.findByIdAndUpdate(id, {
    isDeleted: true,
    deletedAt: new Date(),
    accountStatus: 'inactive',
  });

  await logActivity({
    adminId: req.user._id,
    action: 'user_deleted',
    targetModel: 'User',
    targetId: id,
    description: `Bruker (myk sletting): ${targetUser.email}`,
    metadata: { role: targetUser.role },
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, {}, 'Bruker deaktivert og arkivert.');
});

/**
 * PUT /api/admin/users/:id/restore
 * Restore a soft-deleted user.
 */
const restoreUser = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig bruker-ID.', 400);

  const user = await User.findByIdAndUpdate(
    id,
    { isDeleted: false, deletedAt: null, accountStatus: 'active' },
    { new: true }
  ).select(SENSITIVE_SELECT);

  if (!user) return sendError(res, 'Bruker ikke funnet.', 404);

  await logActivity({
    adminId: req.user._id,
    action: 'user_restored',
    targetModel: 'User',
    targetId: id,
    description: `Bruker gjenopprettet: ${user.email}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { user }, 'Bruker gjenopprettet.');
});

/**
 * DELETE /api/admin/users/:id/sessions
 * Revoke all active sessions for a user.
 */
const revokeUserSessions = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig bruker-ID.', 400);

  const result = await Session.deleteMany({ userId: id });

  await logActivity({
    adminId: req.user._id,
    action: 'session_revoked',
    targetModel: 'Session',
    targetId: id,
    description: `${result.deletedCount} sesjon(er) tilbakekalt for bruker ${id}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { revokedCount: result.deletedCount }, 'Sesjoner tilbakekalt.');
});

module.exports = {
  getUsers,
  createUser,
  getUserById,
  changeUserRole,
  updateUserStatus,
  verifyUser,
  softDeleteUser,
  restoreUser,
  revokeUserSessions,
};
