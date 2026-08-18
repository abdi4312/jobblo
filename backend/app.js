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
const previewRouter = require('./routes/preview');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const servicesRouter = require('./routes/service');
const favoritesRouter = require('./routes/favorites');
const messagesRouter = require('./routes/messages');
const uploadRouter = require('./routes/upload');
const ordersRouter = require('./routes/order');
const notificationsRouter = require('./routes/notifications');
const adminRouter = require('./routes/admin');
const adminV2Router = require('./routes/admin/index');
const reviewsRouter = require('./routes/review');
const categoryRouter = require('./routes/category');
const filterRouter = require('./routes/filter');
const heroSelectRouter = require('./routes/hero');
const chatRouter = require('./routes/chat');
const couponRouter = require('./routes/coupon');
const subscriptionPlanRouter = require('./routes/subscriptionPlan');
const stripeRouter = require('./routes/stripe');
const transactionRoutes = require('./routes/transaction');
const jobbloShopRouter = require('./routes/shop');
const upcomingFeatureRouter = require('./routes/upcomingFeature');
const listsRouter = require('./routes/lists');
const aiRouter = require('./routes/ai');
const exploreRouter = require('./routes/explore');
const homeHeroRouter = require('./routes/homeHero');
const globalConfigRouter = require('./routes/globalConfig');
const applicantsRouter = require('./routes/applicant');
const safePayRouter = require('./routes/safepay');
const safePayCheckoutRouter = require('./routes/safePayCheckout');
const locationFilterRouter = require('./routes/locationFilter');
const myApplicationsRouter = require('./routes/myApplications');
const errorsRouter = require('./routes/errors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// ── CORS ──────────────────────────────────────────────────────────────────────
// `origin: true` reflected ANY origin while also sending credentials, which means
// any website could make authenticated API calls on behalf of a logged-in Jobblo
// user. Allowed origins now come from ALLOWED_ORIGINS (comma-separated); in dev
// the usual localhost ports are permitted so nothing changes locally.
const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean),
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim().replace(/\/$/, '')] : []),
  ...(process.env.NODE_ENV === 'production' ? [] : DEV_ORIGINS),
];

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.error(
    '[jobblo] No ALLOWED_ORIGINS or FRONTEND_URL set. Browser requests with credentials will be refused.'
  );
}

const corsOptions = {
  origin(origin, callback) {
    // No Origin header: same-origin, curl, server-to-server, Stripe webhooks.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200,
};

const passport = require('./config/passport');
const session = require('express-session');
const mongoose = require('mongoose');
const useragent = require('express-useragent');
const requestId = require('./middleware/requestId');

const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Behind a load balancer / CDN every request arrives from the proxy's IP. Without
// this, express-rate-limit counted the WHOLE user base as one client, so
// authLimiter's 10 requests/hour became 10 logins per hour for everyone —
// indistinguishable from a total outage. It also makes req.secure correct so the
// session cookie below can be secure in production.
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 1);

// ── Stripe webhook ────────────────────────────────────────────────────────────
// MUST be registered before express.json(): signature verification needs the raw
// request body, and any JSON parser that runs first would consume it. Registered
// before apiLimiter too, so Stripe's retry storms are never rate-limited away —
// dropping one of these means a captured payment is never recorded.
//
// One dispatcher, mounted at two paths. /api/stripe/webhook is the canonical URL
// and the one to register for new deployments; the safepay-checkout path is kept
// so an endpoint already configured in the Stripe dashboard does not break. Both
// routes reach the same verification, the same event-level idempotency ledger and
// the same routing by session mode/metadata.
const stripeWebhookHandler = require('./services/stripe/webhookDispatcher').stripeWebhook;
const stripeRawBody = express.raw({ type: 'application/json' });

app.post('/api/stripe/webhook', stripeRawBody, stripeWebhookHandler);
app.post('/api/safepay-checkout/webhook', stripeRawBody, stripeWebhookHandler);

app.use(cors(corsOptions));
app.use(apiLimiter); // Apply general API rate limiting
app.use(useragent.express());
// 'dev' logging writes a line per request to stdout in production too.
if (process.env.NODE_ENV !== 'production') app.use(logger('dev'));
// Review photos are posted as base64 data URLs inside the JSON body
// (SafePayApproval). The default 100kb limit killed every real phone photo in the
// body parser, and the failure surfaced as the object-shaped error envelope that
// the UI then tried to render as a React child.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false, limit: '12mb' }));
app.use(cookieParser());

// Attach a request ID to every request for tracing
app.use(requestId);

/**
 * Session storage.
 *
 * This used to run on express-session's default MemoryStore, which is documented as
 * unsuitable for production: it leaks (nothing is ever evicted), it is per-process, and
 * every session is lost on restart. That was survivable while sessions only held the
 * Vipps `state`.
 *
 * It is not survivable now. The BankID flow keeps its `state`, `nonce` and PKCE
 * `code_verifier` in the session for the duration of an authentication that involves
 * the person reaching for a code device — and the callback arrives on a *different*
 * request, possibly minutes later. With MemoryStore, a pm2 restart or a second app
 * instance means the callback finds no transaction and every BankID login fails closed
 * at the state check. Correct, but broken.
 *
 * connect-mongo stores sessions in the database Jobblo already runs, so there is no new
 * piece of infrastructure to provision. It reuses Mongoose's existing connection rather
 * than opening a second pool — Cosmos bills and caps connections, and a duplicate pool
 * is pure cost. The store is created lazily against `asPromise()`, which resolves when
 * `db.js` finishes connecting; `server.js` starts that before requiring this file.
 *
 * If MONGO_URI is absent the app falls back to MemoryStore so local work without a
 * database still runs, and says so loudly in production rather than silently degrading.
 */
function buildSessionStore() {
  if (!process.env.MONGO_URI) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        'CRITICAL: MONGO_URI is not set, so sessions are using the in-memory store. ' +
          'BankID logins will fail on restart and across instances.'
      );
    }
    return undefined; // express-session falls back to MemoryStore
  }

  const MongoStore = require('connect-mongo').default;

  return MongoStore.create({
    clientPromise: mongoose.connection.asPromise().then((conn) => conn.getClient()),
    /**
     * NOT 'sessions'. That collection already belongs to models/Session.js — the auth
     * refresh-token store — and it carries a UNIQUE index on `refreshToken`.
     *
     * connect-mongo documents have no `refreshToken`, so the first one inserts with
     * `refreshToken: null` and every subsequent one collides:
     *
     *   E11000 duplicate key error ... index: refreshToken_1 dup key: { refreshToken: null }
     *
     * The visible symptom was that BankID could not start at all: `req.session.save()`
     * threw, `startIduraAuth` caught it, and the user was bounced back to the frontend
     * with `bankid_verification_failed` instead of being sent to Idura. It was also
     * quietly writing express-session documents into the authentication collection.
     */
    collectionName: 'expressSessions',
    // Sessions carry an in-flight OIDC transaction at most; a day is generous.
    ttl: 24 * 60 * 60,
    // Do not rewrite the document on every request just to move `expires` — one write
    // per hour per session is plenty, and Cosmos charges per write.
    touchAfter: 3600,
    // The transaction holds a PKCE code_verifier. Encrypting at rest means a database
    // dump is not by itself enough to complete somebody's pending authentication.
    crypto: process.env.SESSION_SECRET ? { secret: process.env.SESSION_SECRET } : undefined,
  });
}

// Session configuration
app.use(
  session({
    // Was reusing JWT_SECRET; a separate secret means leaking one does not
    // compromise the other. Falls back so existing deployments keep working.
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: buildSessionStore(),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Swagger UI — was mounted unauthenticated in production, publishing the entire
// API surface to anyone. Off in production unless ENABLE_API_DOCS is set.
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Routes
// Preview route for social crawlers — must be registered before default 404
app.use('/', previewRouter);
app.use('/', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/services', servicesRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/home-hero', homeHeroRouter);
app.use('/api/config', globalConfigRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/notifications', notificationsRouter);
// New modular admin router mounted FIRST — takes priority over legacy routes
app.use('/api/admin', adminV2Router);
// Legacy admin router — kept for backward compat (hero, system-history)
app.use('/api/admin', adminRouter);
app.use('/api', reviewsRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/plans', subscriptionPlanRouter);
app.use('/api/filter', filterRouter);
app.use('/api/hero', heroSelectRouter);
app.use('/api/chats', chatRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/coupons', couponRouter);
app.use('/api/transactions', transactionRoutes);
// Note: /api/admin/transactions is handled by adminV2Router above
app.use('/api/jobbloShop', jobbloShopRouter);
app.use('/api/lists', listsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/explore', exploreRouter);
app.use('/api/applicants', applicantsRouter);
app.use('/api/safepay', safePayRouter);
app.use('/api/safepay-checkout', safePayCheckoutRouter);
app.use('/api/connect', require('./routes/connect'));
app.use('/api/my-applications', myApplicationsRouter);
app.use('/api/upcomingFeatures', upcomingFeatureRouter);
app.use('/api/location-filter', locationFilterRouter);
app.use('/api/errors', errorsRouter);
app.use('/api/support', require('./routes/support'));
// Error handler
app.use(function (req, res, next) {
  next(createError(404));
});

const { logApplicationError } = require('./utils/errorLogger');
const AppError = require('./utils/AppError');
const multer = require('multer');

// Upload and payload failures, translated. Without this a too-large image became
// a generic 500 and the user was told "Noe gikk galt" with nothing to act on.
app.use(function (err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'Bildet er for stort. Maks 8 MB per fil.',
      LIMIT_FILE_COUNT: 'For mange filer. Du kan laste opp inntil 6 bilder.',
      LIMIT_UNEXPECTED_FILE: 'Uventet fil i opplastingen.',
    };
    return res.status(413).json({ error: messages[err.code] || 'Kunne ikke laste opp filen.' });
  }
  if (err && err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Innholdet er for stort. Prøv med færre eller mindre bilder.' });
  }
  return next(err);
});

app.use(async function (err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isAppErr = err instanceof AppError;

  const errorCode = isAppErr ? err.code : 'INTERNAL_SERVER_ERROR';
  const safeMessage = isAppErr ? err.message : 'Internal server error.';

  // Best-effort logging for >=500 (and explicit AppError cases)
  try {
    const userId = req.user?._id || null;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const requestId = req.requestId || req.get('x-request-id') || null;

    await logApplicationError({
      error: err,
      requestPath: req.path,
      httpMethod: req.method,
      httpStatus: status,
      ip,
      userAgent,
      userId,
      correlationId: requestId,
      errorCode,
      metadata: err.details || null,
    });
  } catch (logErr) {
    console.error('Failed to log error:', logErr.message);
  }

  // Standardized API response
  res.status(isAppErr ? err.statusCode : status);
  return res.json({
    success: false,
    error: {
      code: errorCode,
      referenceId: res.getHeader('X-Request-ID') || req.requestId || undefined,
      message: safeMessage,
    },
  });
});

module.exports = app;
