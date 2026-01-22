const Hero = require('../models/Hero');

const Service = require('../models/Service');
const User = require('../models/User');
const Order = require('../models/Order');

// Authentication handled by middleware - req.user and req.userId available
exports.getAllUsers = async (req, res) => {
    try {
        // Query params se page aur limit nikalna (Default: page 1, limit 10)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Total users count (Frontend pagination buttons ke liye zaroori hai)
        const totalUsers = await User.countDocuments();

        const users = await User.find()
            .select('-password')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 }); // New users pehle dikhane ke liye

        res.json({
            users,
            totalPages: Math.ceil(totalUsers / limit),
            currentPage: page,
            totalUsers
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('customerId', 'name email')
            .populate('providerId', 'name email')
            .populate('serviceId', 'title');
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllServices = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalServices = await Service.countDocuments();
        const services = await Service.find()
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        res.json({
            services,
            totalPages: Math.ceil(totalServices / limit),
            currentPage: page,
            totalResults: totalServices
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllHeroItems = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const skip = (page - 1) * limit;

        const total = await Hero.countDocuments();
        const heroItems = await Hero.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            heroes: heroItems,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        // Yeh line aapko terminal mein batayegi ke error kya hai
        console.error("GET HERO ERROR:", err.message); 
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
}

exports.UpdateHero = async (req, res) => {
  try {
    const hero = await Hero.findById(req.params.id);
    if (!hero) {
      return res.status(404).json({ error: "Hero ikke funnet" });
    }

    // Update text fields
    hero.title = req.body.title ?? hero.title;
    hero.subtitle = req.body.subtitle ?? hero.subtitle;
    hero.description = req.body.description ?? hero.description;

    // Image URL update (Agar frontend se naya URL aaye)
    hero.image = req.body.image ?? hero.image;

    // Date Fields Update
    hero.activeFrom = req.body.activeFrom ?? hero.activeFrom;
    hero.expireAt = req.body.expireAt ?? hero.expireAt;

    await hero.save();
    res.status(200).json(hero);
  } catch (err) {
    console.error("Update hero error:", err);
    res.status(500).json({ error: "Kunne ikke oppdatere hero" });
  }
};

/**
 * DELETE HERO
 */
exports.DeleteHero = async (req, res) => {
  try {
    const hero = await Hero.findById(req.params.id);
    if (!hero) {
      return res.status(404).json({ error: "Hero ikke funnet" });
    }

    // Sirf database se delete karein kyunki image external URL hai
    await hero.deleteOne();
    res.status(200).json({ message: "Hero slettet" });
  } catch (err) {
    console.error("Delete hero error:", err);
    res.status(500).json({ error: "Kunne ikke slette hero" });
  }
};

exports.changeUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password');

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};