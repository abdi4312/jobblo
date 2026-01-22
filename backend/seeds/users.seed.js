const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { avatars } = require('./constants/images');

module.exports = async () => {
    await User.deleteMany();

    const users = [];

    for (let i = 0; i < 12; i++) {
        users.push({
            name: `Bruker ${i + 1}`,
            email: `user${i + 1}@jobblo.no`,
            password: await bcrypt.hash('password123', 10),

            phone: `+47900000${i + 1}`,

            role: i === 0 ? 'superAdmin' : i < 5 ? 'provider' : 'user',
            avatarUrl: avatars[i % avatars.length],
            bio: 'Dette er en testprofil for Jobblo',
            accountStatus: 'verified',
            averageRating: Math.round((Math.random() * 2 + 3) * 10) / 10,
            reviewCount: Math.floor(Math.random() * 20)
        });
    }

    return await User.insertMany(users);
};
