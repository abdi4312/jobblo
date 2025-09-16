require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            ssl: true,
            retryWrites: false,
            serverSelectionTimeoutMS: 10000
        });
        console.log('✅ Connected to CosmosDB');
        process.exit(0);
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    }
})();
