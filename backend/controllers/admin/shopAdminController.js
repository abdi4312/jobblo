const JobbloShop = require('../../models/JobbloShop');
const { sendSuccess, sendError, asyncHandler, buildPagination } = require('../../utils/apiResponse');
const { parsePagination } = require('../../utils/pagination');
const { logActivity } = require('../../services/admin/activityService');

const getLogBase = (req) => ({
  adminId: req.user._id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

const getShopItems = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const query = {};
  if (req.query.search) {
    const esc = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.title = { $regex: esc, $options: 'i' };
  }

  const [total, items] = await Promise.all([
    JobbloShop.countDocuments(query),
    JobbloShop.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  return sendSuccess(res, { items }, 'Shop items retrieved.', buildPagination(total, page, limit));
});

const createShopItem = asyncHandler(async (req, res) => {
  const { title, description, coins, category } = req.body;

  if (!title || !description || coins === undefined || !category) {
    return sendError(res, 'Title, description, coins, and category are required.', 400);
  }

  const item = await JobbloShop.create({ title, description, coins, category });

  await logActivity({
    ...getLogBase(req),
    action: 'shop_item_created',
    targetModel: 'JobbloShop',
    targetId: item._id,
    description: `Created shop item: ${title}`,
    metadata: { title, coins, category },
  });

  return sendSuccess(res, { item }, 'Shop item created.', null, 201);
});

const updateShopItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, coins, category } = req.body;

  const item = await JobbloShop.findByIdAndUpdate(
    id,
    { $set: { ...(title !== undefined && { title }), ...(description !== undefined && { description }), ...(coins !== undefined && { coins }), ...(category !== undefined && { category }) } },
    { new: true, runValidators: true }
  );

  if (!item) {
    return sendError(res, 'Shop item not found.', 404);
  }

  await logActivity({
    ...getLogBase(req),
    action: 'shop_item_updated',
    targetModel: 'JobbloShop',
    targetId: item._id,
    description: `Updated shop item: ${item.title}`,
    metadata: { title, description, coins, category },
  });

  return sendSuccess(res, { item }, 'Shop item updated.');
});

const toggleShopItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const item = await JobbloShop.findById(id);
  if (!item) {
    return sendError(res, 'Shop item not found.', 404);
  }

  item.isActive = !item.isActive;
  await item.save();

  await logActivity({
    ...getLogBase(req),
    action: 'shop_item_toggled',
    targetModel: 'JobbloShop',
    targetId: item._id,
    description: `Toggled shop item "${item.title}" ${item.isActive ? 'active' : 'inactive'}`,
    metadata: { isActive: item.isActive },
  });

  return sendSuccess(res, { item }, `Shop item ${item.isActive ? 'activated' : 'deactivated'}.`);
});

const deleteShopItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const item = await JobbloShop.findByIdAndDelete(id);
  if (!item) {
    return sendError(res, 'Shop item not found.', 404);
  }

  await logActivity({
    ...getLogBase(req),
    action: 'shop_item_deleted',
    targetModel: 'JobbloShop',
    targetId: id,
    description: `Deleted shop item: ${item.title}`,
    metadata: { title: item.title },
  });

  return sendSuccess(res, {}, 'Shop item deleted.');
});

module.exports = {
  getShopItems,
  createShopItem,
  updateShopItem,
  toggleShopItem,
  deleteShopItem,
};
