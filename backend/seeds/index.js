require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');

const seedUsers = require('./users.seed');
const seedCategories = require('./categories.seed');
const seedServices = require('./services.seed');
const seedOrders = require('./orders.seed');
const seedReviews = require('./reviews.seed');
const seedNotifications = require('./notifications.seed');
const seedPlans = require("./plan.seed");
const seedConversations = require('./conversations.seed');

async function run() {
    try {
        console.log('Seeder started');
        console.log('DB:', process.env.MONGO_URI);

        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');

        const users = await seedUsers();
        console.log(`👤 Users: ${users.length}`);

        const categories = await seedCategories();
        console.log(`📂 Categories: ${categories.length}`);

        const services = await seedServices(users, categories);
        console.log(`🛠 Services: ${services.length}`);

        const orders = await seedOrders(users, services);
        console.log(`📦 Orders: ${orders.length}`);

        const plans = await seedPlans();
        console.log(`💳 Plans: ${plans.length}`);

        await seedReviews(orders);
        console.log('⭐ Reviews seeded');

        await seedNotifications(users, orders);
        console.log('🔔 Notifications seeded');

        console.log('🎉 Database seeded successfully');
        process.exit(0);

    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

run();
