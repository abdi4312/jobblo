// Jobblo API entry point. Everything that starts the server lives in bootstrap/:
// env, MongoDB, the Express app (app.js), socket.io, background jobs and graceful shutdown.
require('./bootstrap')
  .start()
  .catch((err) => {
    console.error('❌  Failed to start:', err);
    process.exit(1);
  });
