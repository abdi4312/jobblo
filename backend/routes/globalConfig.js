const express = require("express");
const router = express.Router();
const globalConfigController = require("../controllers/globalConfigController");
const { authenticate, requireAdmin } = require("../middleware/auth");

// Public access for some configs might be needed, but for now let's keep it protected for admin management
router.get("/", authenticate, requireAdmin, globalConfigController.getConfigs);
router.get("/:key", globalConfigController.getConfigByKey); // Some might be public
router.post(
  "/update",
  authenticate,
  requireAdmin,
  globalConfigController.updateConfig,
);
router.post(
  "/initialize",
  authenticate,
  requireAdmin,
  globalConfigController.initializeConfigs,
);

module.exports = router;
