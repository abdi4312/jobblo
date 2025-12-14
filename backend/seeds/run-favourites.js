require('dotenv').config();
const mongoose = require('mongoose');
const seedFavorites = require('./favourites.seed');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('❤️ Seeding favorites only');

    await seedFavorites();

    console.log('✅ Favorites seeded');
    process.exit();
}

run();
