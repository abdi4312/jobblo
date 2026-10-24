/**
 * The Express application: middleware in order, then routes, then error handlers.
 * Starting it (env, database, HTTP + socket.io server, background work, shutdown) is
 * bootstrap/ — see server.js. Requiring this file has no side effects beyond building `app`.
 */
require('./config/env');

const express = require('express');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const passport = require('./config/passport');
const { allowedOrigins, corsOptions } = require('./config/cors');
const { sessionMiddleware } = require('./config/session');
const { mountRoutes } = require('./routes/api');
const { notFound, uploadErrors, errorHandler } = require('./middleware/errorHandlers');
const requestId = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimiter');
const faults = require('./services/monitoring/faults');

const origins = allowedOrigins();
if (process.env.NODE_ENV === 'production' && origins.length === 0) {
  console.error('[jobblo] No ALLOWED_ORIGINS or FRONTEND_URL set. Browser requests with credentials will be refused.');
}

const app = express();

// Trust X-Forwarded-For only from the known reverse proxy: production runs nginx on the same
// host, so loopback by default. Trusting any hop let a client reaching the port forge its IP
// (dodging IP blocks and rate limits). Other topologies name their proxy: TRUST_PROXY=10.0.4.12
// or a hop count.
app.set('trust proxy', process.env.TRUST_PROXY ? (/^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY) : 'loopback');

// ── Stripe webhooks ── before express.json() (signature verification needs the raw body) and
// before apiLimiter (Stripe retry storms must never be rate-limited away). One dispatcher, two
// paths: /api/stripe/webhook is canonical; the safepay-checkout path keeps an endpoint already
// configured in the Stripe dashboard working. webhookGuard is a no-op unless a staging
// failure-simulator experiment is running.
const stripeWebhook = require('./services/stripe/webhookDispatcher').stripeWebhook;
const rawJson = express.raw({ type: 'application/json' });
app.post('/api/stripe/webhook', rawJson, faults.webhookGuard, stripeWebhook);
app.post('/api/safepay-checkout/webhook', rawJson, faults.webhookGuard, stripeWebhook);

app.use(cors(corsOptions(origins)));
// CSRF: refuse state-changing requests from other sites' browsers, before body parsing.
app.use(require('./middleware/csrfOrigin').createCsrfOriginGuard(origins));
app.use(require('./middleware/requestMetrics').requestMetrics); // before the limiter so 429s count
app.use(faults.faultMiddleware); // staging failure simulator; after metrics so faults are measured
app.use(require('./services/monitoring/contracts').contractSampler); // response shapes (names/types only)
app.use(require('./services/monitoring/ipBlocks').ipBlockGuard); // after metrics so blocked attempts count
app.use(apiLimiter);
if (process.env.NODE_ENV !== 'production') app.use(logger('dev'));
// Review photos arrive as base64 data URLs in JSON (SafePayApproval): 100kb killed every real
// phone photo in the body parser.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: false, limit: '12mb' }));
app.use(cookieParser());
app.use(requestId);
app.use(sessionMiddleware());
app.use(passport.initialize());
app.use(passport.session());

// Swagger UI: off in production unless ENABLE_API_DOCS=true (it publishes the whole API surface).
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  const swaggerUi = require('swagger-ui-express');
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(require('./swagger')));
}

mountRoutes(app);

app.use(notFound);
app.use(uploadErrors);
app.use(errorHandler);

module.exports = app;
