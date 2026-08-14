const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // `server.js` kicks this off and then synchronously `require`s the whole app, which
      // blocks the event loop until it finishes — so the driver cannot make progress on
      // server selection during that window. Under `npm start` that require takes ~1.5 s
      // and 5 s was enough; under `npm run dev` ts-node-dev transpiles every file on the
      // way in, blows past 5 s, and the connection "times out" against a database that is
      // running and healthy — then `process.exit(1)` below kills the server. This only
      // bounds the initial handshake, so a longer ceiling costs nothing when Mongo is up
      // and still fails fast enough when it genuinely is not.
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
