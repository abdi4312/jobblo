const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const supportController = require('../controllers/supportController');

/**
 * Support requests. `createTicket` is deliberately unauthenticated: someone who
 * cannot log in is the person most likely to need help. It attaches req.userId
 * when the caller happens to be signed in, which the auth middleware sets on
 * the authenticated routes below.
 */
router.post('/tickets', supportController.createTicket);
router.get('/tickets/mine', authenticate, supportController.getMyTickets);

module.exports = router;
