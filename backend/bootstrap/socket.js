const { Server } = require('socket.io');
const chatSocket = require('../sockets/chat.socket');
const { joinUserRooms } = require('../sockets/rooms');
const { setIO } = require('../sockets/io');
const { allowedOrigins, originCheck } = require('../config/cors');

/**
 * socket.io on the HTTP server, with the same origin allowlist as HTTP CORS (it used to be
 * `FRONTEND_URL || 'http://localhost:5173' || …`, whose second fallback could never apply).
 * With REDIS_URL the redis adapter is attached in bootstrap/index.js, so events emitted on
 * one instance reach sockets connected to another.
 */
function setupSockets(server, app) {
  const io = new Server(server, { cors: { origin: originCheck(allowedOrigins()), credentials: true } });

  app.set('io', io); // for code with a `req`
  setIO(io); // for background jobs and services without one (sockets/io.js)
  chatSocket(io);

  io.on('connection', (socket) => {
    // Private rooms from the authenticated id on every connection and reconnect — never from a
    // client-supplied id (F-50: a `join` with a victim's id used to stream their events).
    joinUserRooms(socket);
    socket.on('join_service', (serviceId) => socket.join(`service_${serviceId}`));
    // Older clients still send `join`; the rooms are already joined above.
    socket.on('join', () => joinUserRooms(socket));
  });

  return io;
}

module.exports = { setupSockets };
