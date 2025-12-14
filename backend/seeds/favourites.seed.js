const Favorite = require('../models/Favorite');
const User = require('../models/User');
const Service = require('../models/Service');

module.exports = async () => {
    await Favorite.deleteMany();

    const users = await User.find();
    const services = await Service.find();

    if (!users.length || !services.length) {
        console.log('❌ Users or Services missing');
        return [];
    }

    const favorites = [];

    users.forEach(user => {
        const randomService = services[Math.floor(Math.random() * services.length)];

        favorites.push({
            user: user._id,
            service: randomService._id
        });
    });

    const created = await Favorite.insertMany(favorites);
    console.log(`❤️ Favorites: ${created.length}`);
    return created;
};
