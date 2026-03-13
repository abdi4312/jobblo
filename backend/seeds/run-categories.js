require('dotenv').config();
const mongoose = require('mongoose');
const seedCategories = require('./categories.seed');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('💬 Seeding categories only');

    await seedCategories();

    console.log('✅ Categories seeded');
    process.exit();
}

run();
