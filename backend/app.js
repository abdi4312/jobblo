require('dotenv').config(); // Laster inn .env-variabler
const connectDB = require('./db'); // Importer db-filen
connectDB(); // Koble til MongoDB
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors'); // Add CORS
require('dotenv').config({ path: path.join(__dirname, '.env') });
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const servicesRouter = require('./routes/service');
const favoritesRouter = require('./routes/favorites');
const messagesRouter = require('./routes/messages');
const uploadRouter = require('./routes/upload');
const ordersRouter = require('./routes/order');
const notificationsRouter = require('./routes/notifications');
const adminRouter = require('./routes/admin');
const reviewsRouter = require('./routes/review');
const categoryRouter = require('./routes/category');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// CORS configuration, frontend can access the backend api from localhost:5173
const corsOptions = {
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
};

const app = express();

app.use(cors(corsOptions)); 
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/services', servicesRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/order', ordersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api', reviewsRouter);
app.use('/api/categories', categoryRouter);

// Error handler
app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({ error: err.message });
});

module.exports = app;