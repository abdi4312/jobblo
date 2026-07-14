const Category = require('../../models/Category');
const Service = require('../../models/Service');
const { asyncHandler, sendSuccess, sendError, buildPagination } = require('../../utils/apiResponse');
const { parsePagination, parseObjectId } = require('../../utils/pagination');
const { logActivity } = require('../../services/admin/activityService');

/**
 * GET /api/admin/categories
 */
const getCategories = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const query = {};
  if (req.query.search) {
    const esc = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.name = { $regex: esc, $options: 'i' };
  }
  if (req.query.isActive !== undefined) {
    query.isActive = req.query.isActive === 'true';
  }

  const [total, categories] = await Promise.all([
    Category.countDocuments(query),
    Category.find(query)
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return sendSuccess(res, { categories }, 'Kategorier hentet.', buildPagination(total, page, limit));
});

/**
 * POST /api/admin/categories
 */
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, sortOrder, isActive } = req.body;
  if (!name?.trim()) return sendError(res, 'Kategorinavn er påkrevd.', 400);

  const existing = await Category.findOne({ name: name.trim() });
  if (existing) return sendError(res, 'En kategori med dette navnet finnes allerede.', 409);

  const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const category = await Category.create({
    name: name.trim(),
    slug,
    description: description?.trim(),
    sortOrder: sortOrder ?? 0,
    isActive: isActive !== false,
  });

  await logActivity({
    adminId: req.user._id,
    action: 'other',
    targetModel: 'other',
    description: `Kategori opprettet: ${category.name}`,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, { category }, 'Kategori opprettet.', null, 201);
});

/**
 * PUT /api/admin/categories/:id
 */
const updateCategory = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig kategori-ID.', 400);

  const { name, description, sortOrder, isActive } = req.body;
  const update = {};
  if (name !== undefined) {
    update.name = name.trim();
    update.slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }
  if (description !== undefined) update.description = description.trim();
  if (sortOrder !== undefined) update.sortOrder = sortOrder;
  if (isActive !== undefined) update.isActive = isActive;

  const category = await Category.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!category) return sendError(res, 'Kategori ikke funnet.', 404);

  return sendSuccess(res, { category }, 'Kategori oppdatert.');
});

/**
 * DELETE /api/admin/categories/:id
 * Only if no services use it.
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig kategori-ID.', 400);

  const category = await Category.findById(id).lean();
  if (!category) return sendError(res, 'Kategori ikke funnet.', 404);

  const usageCount = await Service.countDocuments({ categories: category.name });
  if (usageCount > 0) {
    return sendError(
      res,
      `Kan ikke slette: ${usageCount} tjeneste(r) bruker denne kategorien.`,
      409
    );
  }

  await Category.findByIdAndDelete(id);

  return sendSuccess(res, {}, 'Kategori slettet.');
});

/**
 * PUT /api/admin/categories/:id/toggle
 */
const toggleCategory = asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  if (!id) return sendError(res, 'Ugyldig kategori-ID.', 400);

  const category = await Category.findById(id);
  if (!category) return sendError(res, 'Kategori ikke funnet.', 404);

  category.isActive = !category.isActive;
  await category.save();

  return sendSuccess(res, { category }, `Kategori ${category.isActive ? 'aktivert' : 'deaktivert'}.`);
});

module.exports = { getCategories, createCategory, updateCategory, deleteCategory, toggleCategory };
