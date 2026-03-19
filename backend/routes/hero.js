const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const { authenticate, requireAdmin } = require('../middleware/auth');
const heroController = require('../controllers/heroController');

// Public route to get active heroes
router.get('/', heroController.GetHero);

// Admin routes
router.get('/all', authenticate, requireAdmin, heroController.GetAllHeroes);
router.post('/', authenticate, requireAdmin, upload.single('image'), heroController.CreateHero);
router.put('/:id', authenticate, requireAdmin, upload.single('image'), heroController.UpdateHero);
router.delete('/:id', authenticate, requireAdmin, heroController.DeleteHero);

module.exports = router;