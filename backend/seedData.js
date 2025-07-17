require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Job = require('./models/Job');
const Message = require('./models/Message');
const Favorite = require('./models/Favorite');

const connectDB = async () => {
    try {
        const MONGODB_URI = process.env.MONGO_URI;
        if (!MONGODB_URI) {
            throw new Error('MONGO_URI is not defined in environment variables');
        }
        
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
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

const testJobs = [
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
    const jobDeleteResult = await Job.deleteMany({});
    const messageDeleteResult = await Message.deleteMany({});
    const favoriteDeleteResult = await Favorite.deleteMany({});
    
    console.log(`   - Removed ${userDeleteResult.deletedCount} users`);
    console.log(`   - Removed ${jobDeleteResult.deletedCount} jobs`);
    console.log(`   - Removed ${messageDeleteResult.deletedCount} messages`);
    console.log(`   - Removed ${favoriteDeleteResult.deletedCount} favorites`);
    
    // Verify collections are empty
    const userCount = await User.countDocuments();
    const jobCount = await Job.countDocuments();
    const messageCount = await Message.countDocuments();
    const favoriteCount = await Favorite.countDocuments();
    
    if (userCount > 0 || jobCount > 0 || messageCount > 0 || favoriteCount > 0) {
      console.log('⚠️  Warning: Some collections still contain data. Trying to clear again...');
      await User.deleteMany({});
      await Job.deleteMany({});
      await Message.deleteMany({});
      await Favorite.deleteMany({});
    }
    
    console.log('👥 Creating users...');
    
    // Create users
    const createdUsers = await User.create(testUsers);
    console.log(`✅ Created ${createdUsers.length} users`);
    
    console.log('💼 Creating jobs...');
    
    // Create jobs with random users
    const jobsWithUsers = testJobs.map(job => ({
      ...job,
      user: createdUsers[Math.floor(Math.random() * createdUsers.length)]._id
    }));
    
    const createdJobs = await Job.create(jobsWithUsers);
    console.log(`✅ Created ${createdJobs.length} jobs`);
    
    console.log('💬 Creating messages...');
    
    // Create some sample messages
    const sampleMessages = [
      {
        content: "Hei! Jeg er interessert i hagearbeid-tjenesten din. Kan du hjelpe meg med å klippe plenen og beskjære buskene?",
        sender: createdUsers[0]._id,
        receiver: createdUsers[1]._id,
        job: createdJobs[0]._id,
        conversationId: `conv_${createdUsers[0]._id}_${createdUsers[1]._id}_${createdJobs[0]._id}`
      },
      {
        content: "Takk for henvendelsen! Ja, jeg kan hjelpe deg med hagearbeid. Hvor stor er hagen og når trenger du det gjort?",
        sender: createdUsers[1]._id,
        receiver: createdUsers[0]._id,
        job: createdJobs[0]._id,
        conversationId: `conv_${createdUsers[0]._id}_${createdUsers[1]._id}_${createdJobs[0]._id}`
      },
      {
        content: "Er det mulig å få hjelp med husvask neste uke? Trenger grundig rengjøring av hele huset.",
        sender: createdUsers[2]._id,
        receiver: createdUsers[1]._id,
        job: createdJobs[1]._id,
        conversationId: `conv_${createdUsers[2]._id}_${createdUsers[1]._id}_${createdJobs[1]._id}`
      },
      {
        content: "Absolutt! Jeg kan komme neste uke. Hvor mange rom og hvilke dager passer deg best?",
        sender: createdUsers[1]._id,
        receiver: createdUsers[2]._id,
        job: createdJobs[1]._id,
        conversationId: `conv_${createdUsers[2]._id}_${createdUsers[1]._id}_${createdJobs[1]._id}`
      }
    ];
    
    const createdMessages = await Message.create(sampleMessages);
    console.log(`✅ Created ${createdMessages.length} messages`);
    
    console.log('⭐ Creating favorites...');
    
    // Create some favorites
    const sampleFavorites = [
      {
        user: createdUsers[0]._id,
        job: createdJobs[0]._id
      },
      {
        user: createdUsers[0]._id,
        job: createdJobs[2]._id
      },
      {
        user: createdUsers[1]._id,
        job: createdJobs[1]._id
      },
      {
        user: createdUsers[2]._id,
        job: createdJobs[3]._id
      },
      {
        user: createdUsers[3]._id,
        job: createdJobs[4]._id
      }
    ];
    
    const createdFavorites = await Favorite.create(sampleFavorites);
    console.log(`✅ Created ${createdFavorites.length} favorites`);
    
    // Final verification
    const finalUserCount = await User.countDocuments();
    const finalJobCount = await Job.countDocuments();
    const finalMessageCount = await Message.countDocuments();
    const finalFavoriteCount = await Favorite.countDocuments();
    
    console.log('\n🎉 Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${finalUserCount} (expected: ${createdUsers.length})`);
    console.log(`   - Jobs: ${finalJobCount} (expected: ${createdJobs.length})`);
    console.log(`   - Messages: ${finalMessageCount} (expected: ${createdMessages.length})`);
    console.log(`   - Favorites: ${finalFavoriteCount} (expected: ${createdFavorites.length})`);
    
    console.log('\n🔗 Test your APIs:');
    console.log('   GET /api/users - List all users');
    console.log('   GET /api/jobs - List all jobs');
    console.log('   GET /api/messages - List all messages');
    console.log('   GET /api/favorites - List all favorites');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase(); 