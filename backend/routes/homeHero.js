const express = require("express");
const router = express.Router();
const homeHeroController = require("../controllers/home-hero-controller");
const { authenticate, requireAdmin } = require("../middleware/auth");
const upload = require("../middleware/homeHeroUpload");

// Public route to get active hero
router.get("/", homeHeroController.getHero);

// Admin routes
router.get("/all", authenticate, requireAdmin, homeHeroController.getAllHeroes);
router.post("/", authenticate, requireAdmin, upload.single("media"), homeHeroController.createHero);
router.put("/:id", authenticate, requireAdmin, upload.single("media"), homeHeroController.updateHero);
router.delete("/:id", authenticate, requireAdmin, homeHeroController.deleteHero);

module.exports = router;
