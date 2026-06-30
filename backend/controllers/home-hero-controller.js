const HomeHero = require('../models/HomeHero');
const cloudinary = require('../config/cloudinary');

// Create Hero
exports.createHero = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Media file is required' });
    }

    const isActive = req.body.isActive === 'true' || req.body.isActive === true;

    // If setting this one as active, deactivate all others
    if (isActive) {
      await HomeHero.updateMany({}, { isActive: false });
    }

    const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';

    const hero = new HomeHero({
      mediaUrl: req.file.path,
      mediaPublicId: req.file.filename,
      mediaType,
      isActive,
    });

    await hero.save();
    res.status(201).json(hero);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update Hero
exports.updateHero = async (req, res) => {
  try {
    const { id } = req.params;
    const isActive = req.body.isActive === 'true' || req.body.isActive === true;

    const hero = await HomeHero.findById(id);
    if (!hero) return res.status(404).json({ error: 'Hero not found' });

    // If setting this one as active, deactivate all others
    if (isActive) {
      await HomeHero.updateMany({ _id: { $ne: id } }, { isActive: false });
    }

    const updates = { isActive };

    if (req.file) {
      // Delete old media from cloudinary
      try {
        await cloudinary.uploader.destroy(hero.mediaPublicId, {
          resource_type: hero.mediaType,
        });
      } catch (err) {
        console.error('Cloudinary delete error:', err);
      }

      updates.mediaUrl = req.file.path;
      updates.mediaPublicId = req.file.filename;
      updates.mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
    }

    const updatedHero = await HomeHero.findByIdAndUpdate(id, updates, {
      new: true,
    });
    res.json(updatedHero);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get Active Hero
exports.getHero = async (req, res) => {
  try {
    const hero = await HomeHero.findOne({ isActive: true }).sort({
      createdAt: -1,
    });
    res.json(hero);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Get All Heroes (for Admin)
exports.getAllHeroes = async (req, res) => {
  try {
    const heroes = await HomeHero.find().sort({ createdAt: -1 });
    res.json(heroes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Delete Hero
exports.deleteHero = async (req, res) => {
  try {
    const { id } = req.params;
    const hero = await HomeHero.findById(id);
    if (!hero) return res.status(404).json({ error: 'Hero not found' });

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(hero.mediaPublicId, {
        resource_type: hero.mediaType,
      });
    } catch (err) {
      console.error('Cloudinary delete error:', err);
    }

    await HomeHero.findByIdAndDelete(id);
    res.json({ message: 'Hero deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
