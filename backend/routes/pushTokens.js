const express = require('express');
const { authenticate } = require('../middleware/auth');
const controller = require('../controllers/pushTokenController');

const router = express.Router();
router.post('/', authenticate, controller.register);
router.delete('/current', authenticate, controller.deactivateCurrent);

module.exports = router;