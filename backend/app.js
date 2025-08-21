require('dotenv').config(); // Laster inn .env-variabler
const connectDB = require('./db'); // Importer db-filen
connectDB(); // Koble til MongoDB
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const jobsRouter = require('./routes/job');
const favoritesRouter = require('./routes/favorites');
const messagesRouter = require('./routes/messages');
const uploadRouter = require('./routes/upload');
const ordersRouter = require('./routes/orders');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');


const app = express();

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
app.use('/api/jobs', jobsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/orders', ordersRouter);

// Error handler
app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({ error: err.message });
});

module.exports = app;
