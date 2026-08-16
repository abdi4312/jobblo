const express = require('express');
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const chatSocket = require('./sockets/chat.socket');
const { joinUserRooms } = require('./sockets/rooms');

require('dotenv').config({ path: __dirname + '/.env' });

const connectDB = require('./db');
connectDB()
  .then(() => console.log('✅  MongoDB connected'))
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });

const app = require('./app');
const port = process.env.PORT || 5001;

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173' || 'http://localhost:5174',
    credentials: true,
  },
});

// Make io accessible to routes
app.set('io', io);
chatSocket(io);
io.on('connection', (socket) => {
  // Private notification rooms, joined here rather than in response to a client `join`.
  //
  // (F-50) The room used to be named by a client-supplied userId, so an authenticated
  // attacker could emit `join` with a victim's id and receive their entire order, payment
  // and notification event stream. That was fixed by ignoring the payload — but the join
  // still only happened when the client asked, which meant it happened once per page load
  // and never again after a reconnect. See `sockets/rooms.js`: this runs on every
  // connection, including every reconnect, from the authenticated id alone.
  joinUserRooms(socket);

  // Join service room
  socket.on('join_service', (serviceId) => {
    socket.join(`service_${serviceId}`);
  });

  // Kept for older clients still sending it. The rooms are already joined above; this is
  // a no-op that exists so an outdated tab does not error.
  socket.on('join', () => joinUserRooms(socket));

  socket.on('disconnect', () => {});
});
// io.on('connection', (socket) => {
//   console.log(`Socket.io connected: ${socket.id}`);

// Authenticate user with JWT
// socket.on('user:connect', (data) => {
//   const { token, userId } = data;

// Verify JWT token
// if (!process.env.JWT_SECRET) {
//   socket.emit('error', { message: 'Server not configured for authentication' });
//   socket.disconnect();
//   return;
// }

// try {
// const decoded = jwt.verify(token, process.env.JWT_SECRET);

// Verify token userId matches claimed userId (token has userId field)
// if (decoded.userId !== userId) {
//   socket.emit('error', { message: 'Invalid credentials' });
//   socket.disconnect();
//   return;
// }

// Valid authentication - join user room
//     socket.join(userId.toString());
//     socket.userId = userId; // Store userId on socket for later use
//     console.log(`✅ User ${userId} authenticated on socket ${socket.id}`);

//     // Emit success event
//     socket.emit('user:authenticated', { message: 'Authentication successful' });
//   } catch (err) {
//     socket.emit('error', { message: 'Authentication failed: ' + err.message });
//     console.error(`❌ Token verification failed:`, err.message);
//     socket.disconnect();
//   }
// });

// Handle joining a chat room
// socket.on('join-chat', (orderId) => {
//   if (!socket.userId) {
//     socket.emit('error', { message: 'User not authenticated' });
//     return;
//   }
//   socket.join(`chat-${orderId}`);
//   console.log(`User ${socket.userId} joined chat room ${orderId}`);
// });

// Handle leaving a chat room
// socket.on('leave-chat', (orderId) => {
//   socket.leave(`chat-${orderId}`);
//   console.log(`User ${socket.userId} left chat room ${orderId}`);
// });

//   socket.on('disconnect', () => {
//     console.log(`❌ Socket.io disconnected: ${socket.id}`);
//   });
// });

app.use(express.json());

/**
 * @swagger
 * /api/test:
 *   get:
 *     summary: Test-endepunkt for å sjekke at API-et kjører
 *     responses:
 *       200:
 *         description: API fungerer
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Jobblo test-API kjører! 🚀
 */
app.get('/api/test', (req, res) => {
  res.json({ message: 'Jobblo test-API kjører! 🚀' });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

server.listen(port, () => {
  console.log(`🚀  Jobblo API listening on http://localhost:${port}`);
  console.log(`Swagger-docs på http://localhost:${port}/api/docs`);
  console.log(`WebSocket server running on ws://localhost:${port}`);

  // Lifecycle automation: escrow auto-release, payout retries, abandoned-order
  // cleanup and money reconciliation. Set ENABLE_SCHEDULER=false to keep a second
  // instance from duplicating the work (the jobs are idempotent, so it is only noise).
  require('./services/scheduler').startScheduler();
});
