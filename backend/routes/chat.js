const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { authenticate } = require('../middleware/auth');

router.post("/create", authenticate, chatController.createOrGetChat);
router.get("/get", authenticate, chatController.getMyChats);
router.get("/:chatId", authenticate, chatController.getChatById);
router.post("/:chatId/message", authenticate, chatController.sendMessage);
router.delete("/:chatId", authenticate, chatController.deleteChat);
router.patch("/:chatId/delete-for-me", authenticate, chatController.deleteForMe);

module.exports = router;
