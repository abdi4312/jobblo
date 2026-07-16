const GlobalConfig = require('../../models/GlobalConfig');
const Hero = require('../../models/Hero');
const HomeHero = require('../../models/HomeHero');
const UpcomingFeature = require('../../models/UpcomingFeature');
const { sendSuccess, sendError, asyncHandler } = require('../../utils/apiResponse');
const { logActivity } = require('../../services/admin/activityService');

const SECRET_KEY_PATTERNS = ['secret', 'password', 'token', 'apikey', 'privatekey', 'authorization'];

const isSecretKey = (key) => {
  const lower = key.toLowerCase();
  return SECRET_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
};

const toObject = (configs) => {
  return configs.reduce((acc, c) => {
    acc[c.key] = c.value;
    return acc;
  }, {});
};

const getLogBase = (req) => ({
  adminId: req.user._id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

const getAllConfigs = asyncHandler(async (req, res) => {
  const configs = await GlobalConfig.find().lean();
  const filtered = configs.filter((c) => !isSecretKey(c.key));
  return sendSuccess(res, { configs: toObject(filtered) }, 'All configs retrieved.');
});

const getConfigByKey = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const config = await GlobalConfig.findOne({ key }).lean();
  if (!config) {
    return sendError(res, 'Config not found.', 404);
  }
  return sendSuccess(res, { key: config.key, value: config.value, description: config.description }, 'Config retrieved.');
});

const updateConfig = asyncHandler(async (req, res) => {
  const { key, value, description } = req.body;
  if (!key || value === undefined) {
    return sendError(res, 'Key and value are required.', 400);
  }
  const config = await GlobalConfig.findOneAndUpdate(
    { key },
    { value, description },
    { new: true, upsert: true }
  ).lean();
  await logActivity({
    ...getLogBase(req),
    action: 'settings_updated',
    targetModel: 'GlobalConfig',
    targetId: config._id,
    description: `Updated config key: ${key}`,
    metadata: { key },
  });
  return sendSuccess(res, { key: config.key, value: config.value }, 'Config updated.');
});

const deleteConfig = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const config = await GlobalConfig.findOneAndDelete({ key });
  if (!config) {
    return sendError(res, 'Config not found.', 404);
  }
  await logActivity({
    ...getLogBase(req),
    action: 'settings_updated',
    targetModel: 'GlobalConfig',
    targetId: config._id,
    description: `Deleted config key: ${key}`,
    metadata: { key },
  });
  return sendSuccess(res, { key }, 'Config deleted.');
});

const getFeatureFlags = asyncHandler(async (req, res) => {
  const flags = await GlobalConfig.find({
    key: { $regex: /^(feature_|flag_)/i },
  }).lean();
  const filtered = flags.filter((f) => !isSecretKey(f.key));
  return sendSuccess(res, { flags: filtered.map((f) => ({ key: f.key, value: f.value, description: f.description })) }, 'Feature flags retrieved.');
});

const toggleFeatureFlag = asyncHandler(async (req, res) => {
  const { key, enabled } = req.body;
  if (!key) {
    return sendError(res, 'Key is required.', 400);
  }
  if (typeof enabled !== 'boolean') {
    return sendError(res, 'Enabled must be a boolean.', 400);
  }
  const config = await GlobalConfig.findOne({ key });
  if (!config) {
    return sendError(res, 'Feature flag not found.', 404);
  }
  config.value = enabled;
  await config.save();
  await logActivity({
    ...getLogBase(req),
    action: 'settings_updated',
    targetModel: 'GlobalConfig',
    targetId: config._id,
    description: `Toggled feature flag: ${key} → ${enabled}`,
    metadata: { key, enabled },
  });
  return sendSuccess(res, { key, value: enabled }, 'Feature flag toggled.');
});

const updateHomepageContent = asyncHandler(async (req, res) => {
  const { heroTitle, heroSubtitle, heroDescription, ctaText, ctaUrl, featuredCategories, statistics, announcementBanner } = req.body;
  const entries = { heroTitle, heroSubtitle, heroDescription, ctaText, ctaUrl, featuredCategories, statistics, announcementBanner };
  const ops = Object.entries(entries)
    .filter(([, v]) => v !== undefined)
    .map(([field, value]) => ({
      updateOne: {
        filter: { key: `homepage_${field}` },
        update: { $set: { value } },
        upsert: true,
      },
    }));
  if (ops.length > 0) {
    await GlobalConfig.bulkWrite(ops);
  }
  await logActivity({
    ...getLogBase(req),
    action: 'settings_updated',
    targetModel: 'GlobalConfig',
    description: 'Updated homepage content',
    metadata: { updatedFields: Object.keys(entries).filter((k) => entries[k] !== undefined) },
  });
  return sendSuccess(res, {}, 'Homepage content updated.');
});

const getHomepageContent = asyncHandler(async (req, res) => {
  const configs = await GlobalConfig.find({ key: { $regex: /^homepage_/i } }).lean();
  return sendSuccess(res, { content: toObject(configs) }, 'Homepage content retrieved.');
});

const updateNavigation = asyncHandler(async (req, res) => {
  const { headerLinks, footerLinks, socialLinks } = req.body;
  const ops = [];
  if (headerLinks !== undefined) {
    ops.push({ updateOne: { filter: { key: 'nav_header' }, update: { $set: { value: headerLinks } }, upsert: true } });
  }
  if (footerLinks !== undefined) {
    ops.push({ updateOne: { filter: { key: 'nav_footer' }, update: { $set: { value: footerLinks } }, upsert: true } });
  }
  if (socialLinks !== undefined) {
    ops.push({ updateOne: { filter: { key: 'nav_social' }, update: { $set: { value: socialLinks } }, upsert: true } });
  }
  if (ops.length > 0) {
    await GlobalConfig.bulkWrite(ops);
  }
  await logActivity({
    ...getLogBase(req),
    action: 'settings_updated',
    targetModel: 'GlobalConfig',
    description: 'Updated navigation links',
    metadata: { updatedFields: ['headerLinks', 'footerLinks', 'socialLinks'].filter((k) => req.body[k] !== undefined) },
  });
  return sendSuccess(res, {}, 'Navigation updated.');
});

const getNavigation = asyncHandler(async (req, res) => {
  const configs = await GlobalConfig.find({ key: { $in: ['nav_header', 'nav_footer', 'nav_social'] } }).lean();
  return sendSuccess(res, { navigation: toObject(configs) }, 'Navigation retrieved.');
});

const updateFooter = asyncHandler(async (req, res) => {
  const { contactEmail, supportEmail, copyrightText, aboutText } = req.body;
  const entries = { contactEmail, supportEmail, copyrightText, aboutText };
  const ops = Object.entries(entries)
    .filter(([, v]) => v !== undefined)
    .map(([field, value]) => ({
      updateOne: {
        filter: { key: `footer_${field}` },
        update: { $set: { value } },
        upsert: true,
      },
    }));
  if (ops.length > 0) {
    await GlobalConfig.bulkWrite(ops);
  }
  await logActivity({
    ...getLogBase(req),
    action: 'settings_updated',
    targetModel: 'GlobalConfig',
    description: 'Updated footer content',
    metadata: { updatedFields: Object.keys(entries).filter((k) => entries[k] !== undefined) },
  });
  return sendSuccess(res, {}, 'Footer updated.');
});

const getFooter = asyncHandler(async (req, res) => {
  const configs = await GlobalConfig.find({ key: { $regex: /^footer_/i } }).lean();
  return sendSuccess(res, { footer: toObject(configs) }, 'Footer retrieved.');
});

const getAnnouncements = asyncHandler(async (req, res) => {
  const configs = await GlobalConfig.find({ key: { $regex: /^announcement_/i } }).lean();
  const filtered = configs.filter((c) => !isSecretKey(c.key));
  return sendSuccess(res, { announcements: filtered.map((c) => ({ key: c.key, value: c.value })) }, 'Announcements retrieved.');
});

const updateAnnouncement = asyncHandler(async (req, res) => {
  const { key, text, type, isActive, linkUrl } = req.body;
  if (!key) {
    return sendError(res, 'Key is required.', 400);
  }
  const value = {};
  if (text !== undefined) value.text = text;
  if (type !== undefined) value.type = type;
  if (isActive !== undefined) value.isActive = isActive;
  if (linkUrl !== undefined) value.linkUrl = linkUrl;
  const config = await GlobalConfig.findOneAndUpdate(
    { key },
    { value },
    { new: true, upsert: true }
  ).lean();
  await logActivity({
    ...getLogBase(req),
    action: 'settings_updated',
    targetModel: 'GlobalConfig',
    targetId: config._id,
    description: `Updated announcement: ${key}`,
    metadata: { key },
  });
  return sendSuccess(res, { key, value }, 'Announcement updated.');
});

const getMaintenanceMode = asyncHandler(async (req, res) => {
  const config = await GlobalConfig.findOne({ key: 'maintenance_mode' }).lean();
  return sendSuccess(res, {
    maintenanceMode: config ? config.value : { enabled: false, message: '' },
  }, 'Maintenance mode retrieved.');
});

const toggleMaintenanceMode = asyncHandler(async (req, res) => {
  const { enabled, message } = req.body;
  if (typeof enabled !== 'boolean') {
    return sendError(res, 'Enabled must be a boolean.', 400);
  }
  const value = { enabled, message: message || '' };
  const config = await GlobalConfig.findOneAndUpdate(
    { key: 'maintenance_mode' },
    { value },
    { new: true, upsert: true }
  ).lean();
  await logActivity({
    ...getLogBase(req),
    action: 'settings_updated',
    targetModel: 'GlobalConfig',
    targetId: config._id,
    description: `Toggled maintenance mode: ${enabled}`,
    metadata: { enabled },
  });
  return sendSuccess(res, { maintenanceMode: value }, 'Maintenance mode updated.');
});

module.exports = {
  getAllConfigs,
  getConfigByKey,
  updateConfig,
  deleteConfig,
  getFeatureFlags,
  toggleFeatureFlag,
  updateHomepageContent,
  getHomepageContent,
  updateNavigation,
  getNavigation,
  updateFooter,
  getFooter,
  getAnnouncements,
  updateAnnouncement,
  getMaintenanceMode,
  toggleMaintenanceMode,
};
