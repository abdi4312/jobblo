require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Service = require('./models/Service');
const Message = require('./models/Message');
const Favorite = require('./models/Favorite');
const Notification = require('./models/Notification');

const connectDB = async () => {
    try {
        const MONGODB_URI = process.env.MONGO_URI;
        if (!MONGODB_URI) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }
        
        await mongoose.connect(MONGODB_URI, {
            retryWrites: false,
            maxIdleTimeMS: 120000,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    }
};

const testUsers = [
  {
    name: "Ola Nordmann",
    email: "ola.nordmann@email.com",
    password: "password123",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    bio: "Erfaren håndverker med 10+ års erfaring i hagearbeid og vedlikehold. Spesialist på plenklipping, beskjæring og generelt hagearbeid."
  },
  {
    name: "Kari Hansen",
    email: "kari.hansen@email.com", 
    password: "password123",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face",
    bio: "Pålitelig rengjøringspersonell med 5 års erfaring. Spesialist på grundig husvask og kontorrenhold. Fleksible tider og grundig arbeid."
  },
  {
    name: "Erik Johansen",
    email: "erik.johansen@email.com",
    password: "password123", 
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    bio: "Sertifisert elektriker med 8 års erfaring. Spesialist på installasjon og reparasjon av elektriske systemer. Sikker og pålitelig service."
  },
  {
    name: "Maria Olsen",
    email: "maria.olsen@email.com",
    password: "password123",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face", 
    bio: "Profesjonell maler og tapetserer med 6 års erfaring. Spesialist på innvendig maling, tapetsering og oppussing. Kvalitetsmaterialer og grundig arbeid."
  },
  {
    name: "Lars Berg",
    email: "lars.berg@email.com",
    password: "password123",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
    bio: "Erfaren rørlegger med 12 års erfaring. Spesialist på vannsystemer, reparasjoner og installasjoner. Rask og pålitelig service."
  }
];

const testServices = [
  {
    title: "Hagearbeid og Vedlikehold",
    description: "Profesjonell hagearbeid og vedlikehold av hager, plener og uteområder. Inkluderer klipping av plen, beskjæring av busker, planting og generelt vedlikehold. Perfekt for huseiere som trenger hjelp med å holde hagen pen og ryddig.",
    category: "Hagearbeid",
    price: 800,
    location: "Oslo",
    type: "per-time"
  },
  {
    title: "Husvask og Rengjøring",
    description: "Grundig husvask og rengjøring av hjem og kontorer. Inkluderer støvsuging, mopping, vasking av vinduer, bad og kjøkken. Fleksible tider og tilpasset dine behov. Pålitelig og grundig service.",
    category: "Rengjøring",
    price: 600,
    location: "Bergen", 
    type: "per-time"
  },
  {
    title: "Flytting og Transport",
    description: "Hjelp med flytting av møbler, elektronikk og andre gjenstander. Sikker transport med egnet utstyr. Kan også hjelpe med montering og demontering av møbler. Erfaren og forsiktig håndtering.",
    category: "Transport",
    price: 1200,
    location: "Trondheim",
    type: "per-time"
  },
  {
    title: "Maling og Tapetsering",
    description: "Profesjonell maling og tapetsering av rom og bygg. Inkluderer forberedelse av overflater, maling og tapetsering. Kvalitetsmaterialer og grundig arbeid. Perfekt for oppussing og vedlikehold.",
    category: "Maling",
    price: 900,
    location: "Stavanger",
    type: "per-time"
  },
  {
    title: "Elektrisk Arbeid",
    description: "Installasjon og reparasjon av elektrisk utstyr og systemer. Inkluderer montering av lamper, stikkontakter, brytere og andre elektriske komponenter. Sertifisert og sikker arbeid.",
    category: "Elektrisk",
    price: 1100,
    location: "Oslo",
    type: "per-time"
  },
  {
    title: "Vann og Rørlegger",
    description: "Rørleggerarbeid og vedlikehold av vannsystemer. Inkluderer reparasjon av lekkasjer, installasjon av varmtvannsberedere, vasker og toaletter. Rask og pålitelig service.",
    category: "Rørlegger",
    price: 1300,
    location: "Bergen",
    type: "per-time"
  },
  {
    title: "Snørydding og Vintervedlikehold",
    description: "Snørydding av oppkjørseler, fortau og uteområder. Inkluderer også salting og vedlikehold av vinterutstyr. Rask respons og grundig arbeid. Tilgjengelig hele vinteren.",
    category: "Snørydding",
    price: 700,
    location: "Oslo",
    type: "per-time"
  },
  {
    title: "Bilvask og Detaljering",
    description: "Grundig bilvask og detaljering av biler. Inkluderer utvendig vask, innvendig rengjøring, voks og polering. Profesjonelt utstyr og kvalitetsprodukter. Perfekt for å holde bilen fin.",
    category: "Bilvask",
    price: 500,
    location: "Trondheim",
    type: "per-time"
  }
];

const seedDatabase = async () => {
  try {
    // Connect to database
    await connectDB();
    
    console.log('🗑️  Clearing existing data...');
    
    // Clear existing data with confirmation
    const userDeleteResult = await User.deleteMany({});
    const serviceDeleteResult = await Service.deleteMany({});
    const messageDeleteResult = await Message.deleteMany({});
    const favoriteDeleteResult = await Favorite.deleteMany({});
    const notificationDeleteResult = await Notification.deleteMany({});
    
    console.log(`   - Removed ${userDeleteResult.deletedCount} users`);
    console.log(`   - Removed ${serviceDeleteResult.deletedCount} services`);
    console.log(`   - Removed ${messageDeleteResult.deletedCount} messages`);
    console.log(`   - Removed ${favoriteDeleteResult.deletedCount} favorites`);
    console.log(`   - Removed ${notificationDeleteResult.deletedCount} notifications`);
    
    // Verify collections are empty
    const userCount = await User.countDocuments();
    const serviceCount = await Service.countDocuments();
    const messageCount = await Message.countDocuments();
    const favoriteCount = await Favorite.countDocuments();
    const notificationCount = await Notification.countDocuments();
    
    if (userCount > 0 || serviceCount > 0 || messageCount > 0 || favoriteCount > 0 || notificationCount > 0) {
      console.log('⚠️  Warning: Some collections still contain data. Trying to clear again...');
      await User.deleteMany({});
      await Service.deleteMany({});
      await Message.deleteMany({});
      await Favorite.deleteMany({});
      await Notification.deleteMany({});
    }
    
    console.log('👥 Creating users...');
    
    // Create users with error handling for duplicates
    const createdUsers = [];
    for (const userData of testUsers) {
        try {
            const user = await User.create(userData);
            createdUsers.push(user);
        } catch (error) {
            if (error.code === 11000) {
                // User already exists, find and use existing user
                const existingUser = await User.findOne({ email: userData.email });
                if (existingUser) {
                    createdUsers.push(existingUser);
                    console.log(`   - User ${userData.email} already exists, using existing`);
                }
            } else {
                throw error;
            }
        }
    }
    console.log(`✅ Created/found ${createdUsers.length} users`);
    
    console.log('💼 Creating services...');
    
    // Create services with random users
    const servicesWithUsers = testServices.map(service => ({
      ...service,
      userId: createdUsers[Math.floor(Math.random() * createdUsers.length)]._id
    }));
    
    const createdServices = await Service.create(servicesWithUsers);
    console.log(`✅ Created ${createdServices.length} services`);
    
    console.log('💬 Creating messages...');
    
    let createdMessages = [];
    // Skip messages if we don't have enough users or services
    if (createdUsers.length < 1 || createdServices.length < 1) {
        console.log('⚠️  Skipping messages - need at least 1 user and 1 service');
    } else {
        // Create some sample messages using the new Message schema
        const sampleMessages = [
            {
                orderId: createdServices[0]._id, // Use service as orderId for now
                senderId: createdUsers[0]._id,
                message: "Hei! Jeg er interessert i denne tjenesten. Kan du hjelpe meg?",
                type: 'text'
            }
        ];
        
        // Add more messages if we have multiple users
        if (createdUsers.length > 1 && createdServices.length > 1) {
            sampleMessages.push({
                orderId: createdServices[1]._id,
                senderId: createdUsers[1]._id,
                message: "Takk for henvendelsen! Ja, jeg kan hjelpe deg. Hvor stor er oppgaven?",
                type: 'text'
            });
        }
        
        createdMessages = await Message.create(sampleMessages);
        console.log(`✅ Created ${createdMessages.length} messages`);
    }
    
    console.log('⭐ Creating favorites...');
    
    let createdFavorites = [];
    // Create some favorites - only if we have users and services
    if (createdUsers.length > 0 && createdServices.length > 0) {
        const sampleFavorites = [
            {
                user: createdUsers[0]._id,
                service: createdServices[0]._id
            }
        ];
        
        // Add more favorites if we have multiple services
        if (createdServices.length > 1) {
            sampleFavorites.push({
                user: createdUsers[0]._id,
                service: createdServices[1]._id
            });
        }
        
        createdFavorites = await Favorite.create(sampleFavorites);
        console.log(`✅ Created ${createdFavorites.length} favorites`);
    } else {
        console.log('⚠️  Skipping favorites - need at least 1 user and 1 service');
    }
    
    console.log('🔔 Creating notifications...');
    
    let createdNotifications = [];
    // Create some sample notifications - only if we have users
    if (createdUsers.length > 0) {
        const sampleNotifications = [
            {
                userId: createdUsers[0]._id,
                type: 'message',
                content: 'Du har mottatt en ny melding om tjenesten din.',
                read: false
            },
            {
                userId: createdUsers[0]._id,
                type: 'system',
                content: 'Velkommen til Serviceblo! Din konto er nå aktiv.',
                read: true
            }
        ];
        
        createdNotifications = await Notification.create(sampleNotifications);
        console.log(`✅ Created ${createdNotifications.length} notifications`);
    } else {
        console.log('⚠️  Skipping notifications - need at least 1 user');
    }
    
    // Final verification
    const finalUserCount = await User.countDocuments();
    const finalServiceCount = await Service.countDocuments();
    const finalMessageCount = await Message.countDocuments();
    const finalFavoriteCount = await Favorite.countDocuments();
    const finalNotificationCount = await Notification.countDocuments();
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${finalUserCount} (expected: ${createdUsers.length})`);
    console.log(`   - Services: ${finalServiceCount} (expected: ${createdServices.length})`);
    console.log(`   - Messages: ${finalMessageCount} (expected: ${createdMessages.length})`);
    console.log(`   - Favorites: ${finalFavoriteCount} (expected: ${createdFavorites.length})`);
    console.log(`   - Notifications: ${finalNotificationCount} (expected: ${createdNotifications.length})`);
    
    console.log('\n🔗 Test your APIs:');
    console.log('   GET /api/users - List all users');
    console.log('   GET /api/services - List all services');
    console.log('   GET /api/messages - List all messages');
    console.log('   GET /api/favorites - List all favorites');
    console.log('   GET /api/notifications?userId=<USER_ID> - List user notifications');
    console.log('   POST /api/notifications/test - Create test notification');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase(); 