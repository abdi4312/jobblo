const express = require("express");
const router = express.Router();
const JobbloShopController = require("../controllers/JobbloShopController");
const { authenticate } = require("../middleware/auth");

router.get("/", JobbloShopController.getjobbloShop);
router.post("/buy", authenticate, JobbloShopController.buyItem);

module.exports = router;
