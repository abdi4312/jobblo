const express = require('express');
const router = express.Router();
const globalConfigController = require('../controllers/globalConfigController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Admin only access to see ALL configs
router.get('/', authenticate, requireAdmin, globalConfigController.getConfigs);

// Public access to fetch specific config by key (for UI feature flags)
router.get('/:key', globalConfigController.getConfigByKey);
router.post('/update', authenticate, requireAdmin, globalConfigController.updateConfig);
router.post('/initialize', authenticate, requireAdmin, globalConfigController.initializeConfigs);

module.exports = router;
