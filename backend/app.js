require('dotenv').config(); // Laster inn .env-variabler
const connectDB = require('./db'); // Importer db-filen
connectDB(); // Koble til MongoDB

const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

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
const feedRouter = require('./routes/feed');
const filterRouter = require('./routes/filter');
const contractsRouter = require('./routes/contract');
const heroSelectRouter = require('./routes/Herojs');
const chatRouter = require('./routes/chat');
const couponRouter = require('./routes/coupon');
const stripeRouter = require('./routes/stripe');

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// CORS configuration
const corsOptions = {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true,
    optionsSuccessStatus: 200
};

const passport = require('./config/passport');
const session = require('express-session');

const app = express();

app.use(cors(corsOptions));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

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
app.use('/api/orders', ordersRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/admin', adminRouter);
app.use('/api', reviewsRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/feed', feedRouter);
app.use('/api/filter', filterRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/hero', heroSelectRouter);
app.use("/api/chats", chatRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/coupons', couponRouter);


// Error handler
app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({ error: err.message });
});

module.exports = app;
