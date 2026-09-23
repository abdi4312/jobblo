const Hero = require('../models/Hero');

/**
 * GET ACTIVE HEROES (For Frontend)
 * Public: powers the Explore banner carousel.
 */
exports.GetHero = async (req, res) => {
  try {
    const now = new Date();
    const heroes = await Hero.find({
      activeFrom: { $lte: now },
      expireAt: { $gte: now },
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json(heroes);
  } catch (err) {
    console.error('Get active heroes error:', err);
    res.status(500).json({ error: 'Kunne ikke hente hero data' });
  }
};
