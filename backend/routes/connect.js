const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/stripeConnectController');

router.post('/account',      authenticate, c.createOrGetAccount);
router.post('/account-link', authenticate, c.createAccountLink);
router.post('/refresh',      authenticate, c.refreshAccountStatus);
router.get('/status',        authenticate, c.getStatus);

module.exports = router;
