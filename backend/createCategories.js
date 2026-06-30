require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const createCategories = async () => {
  try {
    await connectDB();

    console.log('🗑️  Clearing existing categories...');
    await Category.deleteMany({});

    console.log('📝 Creating categories...');

    const categories = [
      {
        name: 'Hagearbeid',
        slug: 'hagearbeid',
        description: 'Hagearbeid og vedlikehold av hager og uteområder',
        icon: '🌱',
        isActive: true,
      },
      {
        name: 'Rengjøring',
        slug: 'rengjoring',
        description: 'Husvask og rengjøring av hjem og kontorer',
        icon: '🧹',
        isActive: true,
      },
      {
        name: 'Transport',
        slug: 'transport',
        description: 'Flytting og transport av møbler og gjenstander',
        icon: '🚚',
        isActive: true,
      },
      {
        name: 'Maling',
        slug: 'maling',
        description: 'Maling og tapetsering av rom og bygg',
        icon: '🎨',
        isActive: true,
      },
      {
        name: 'Elektrisk',
        slug: 'elektrisk',
        description: 'Elektrisk arbeid og installasjoner',
        icon: '⚡',
        isActive: true,
      },
      {
        name: 'Rørlegger',
        slug: 'rorlegger',
        description: 'Rørleggerarbeid og vannsystemer',
        icon: '🔧',
        isActive: true,
      },
      {
        name: 'Snørydding',
        slug: 'snorydding',
        description: 'Snørydding og vintervedlikehold',
        icon: '❄️',
        isActive: true,
      },
      {
        name: 'Bilvask',
        slug: 'bilvask',
        description: 'Bilvask og detaljering',
        icon: '🚗',
        isActive: true,
      },
    ];

    const createdCategories = await Category.create(categories);

    console.log('✅ Categories created successfully!');
    console.log('\n📋 Category IDs for use in jobs:');
    createdCategories.forEach((cat) => {
      console.log(`   ${cat.name}: ${cat._id}`);
    });

    console.log('\n💡 You can now use these IDs in the categories field when creating jobs.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating categories:', error);
    process.exit(1);
  }
};

createCategories();
