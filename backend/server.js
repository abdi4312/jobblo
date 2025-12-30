const express = require('express');
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const chatSocket = require("./sockets/chat.socket");

require('dotenv').config({ path: __dirname + '/.env' });

const connectDB = require('./db');
connectDB()
  .then(() => console.log('✅  MongoDB connected'))
  .catch(err => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });

const app = require('./app');
const port = 5000;

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);
chatSocket(io);

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
});
