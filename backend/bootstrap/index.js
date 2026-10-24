/**
 * Starts the API: env → MongoDB → Express app on an HTTP server → socket.io (+ Redis adapter)
 * → listen → background work → graceful shutdown. server.js only calls start().
 */
require('../config/env');

const http = require('http');
const connectDB = require('../db');
const redis = require('../config/redis');
const { setupSockets } = require('./socket');
const { startBackground } = require('./background');
const { registerShutdown } = require('./shutdown');

function warnIfPublic(port) {
  if (process.env.NODE_ENV === 'production' && !['127.0.0.1', '::1', 'localhost'].includes(process.env.HOST)) {
    console.warn(`[security] HOST is "${process.env.HOST || 'unset'}": the API listens on all interfaces. Set HOST=127.0.0.1 so only the local nginx can reach port ${port}, and firewall the port.`);
  }
}

/** With Redis, socket.io events emitted on one instance reach sockets connected to another. */
function attachSocketAdapter(io) {
  if (!redis.enabled()) return false;
  const { createAdapter } = require('@socket.io/redis-adapter');
  const pub = redis.newClient('socket:pub');
  const sub = redis.newClient('socket:sub');
  io.adapter(createAdapter(pub, sub, { key: `${redis.PREFIX}:socket.io` }));
  return true;
}

async function start({ port = process.env.PORT || 5001, host = process.env.HOST } = {}) {
  // Connect first; requiring the app before the connection resolves is fine (connect-mongo
  // waits on mongoose's promise), but a failed connection must stop the boot.
  const db = connectDB()
    .then(() => console.log('✅  MongoDB connected'))
    .catch((err) => {
      console.error('❌  MongoDB connection error:', err.message);
      process.exit(1);
    });

  const app = require('../app');
  const server = http.createServer(app);
  const io = setupSockets(server, app);
  const redisAdapter = attachSocketAdapter(io);

  warnIfPublic(port);
  await new Promise((resolve, reject) => {
    server.once('error', (err) => reject(err.code === 'EADDRINUSE' ? new Error(`Port ${port} is already in use — is another API instance running?`) : err));
    server.listen({ port, host }, resolve);
  });
  console.log(`🚀  Jobblo API listening on http://localhost:${port}${process.env.NODE_ENV !== 'production' ? ` (docs: /api/docs)` : ''}`);
  console.log(`    WebSocket on ws://localhost:${port}${redisAdapter ? ' (Redis adapter)' : ''} · Redis: ${redis.enabled() ? 'on' : 'off (in-process queues, memory rate limits and cache)'}`);

  await db;
  const bg = startBackground();
  if (bg.failed.length) console.error(`[bootstrap] background starters failed: ${bg.failed.join(', ')}`);

  registerShutdown({ server, io });
  return { app, server, io };
}

module.exports = { start, attachSocketAdapter };
