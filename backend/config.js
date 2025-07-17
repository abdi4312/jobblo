module.exports = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://jobblo-cosmos-account-1:fiob7twCAX5BjnkCE6xvmSAI5tVXWc7aSVYsZGTfmbnfoFZMpWUkAcwUtSjwdSrP0zwYwUEsJEBzACDbuF6Q0w==@jobblo-cosmos-account-1.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@jobblo-cosmos-account-1@',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      retryWrites: false,
      maxIdleTimeMS: 120000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    }
  },
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development'
};
