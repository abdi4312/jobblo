/**
 * Allowed browser origins — one list for HTTP CORS, the CSRF origin guard and socket.io.
 *
 * `origin: true` once reflected ANY origin while also sending credentials, which meant any
 * website could make authenticated API calls on behalf of a logged-in Jobblo user. Allowed
 * origins come from ALLOWED_ORIGINS (comma-separated) and FRONTEND_URL; in development the
 * usual localhost ports are added so nothing changes locally.
 */
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];

const trim = (o) => o.trim().replace(/\/$/, '');

function allowedOrigins(env = process.env) {
  return [
    ...(env.ALLOWED_ORIGINS || '').split(',').map(trim).filter(Boolean),
    ...(env.FRONTEND_URL ? [trim(env.FRONTEND_URL)] : []),
    ...(env.NODE_ENV === 'production' ? [] : DEV_ORIGINS),
  ];
}

/** Same rule everywhere: no Origin header (curl, server-to-server, Stripe) passes; otherwise allowlist. */
function originCheck(list) {
  return (origin, callback) => {
    if (!origin) return callback(null, true);
    return callback(null, list.includes(origin.replace(/\/$/, '')));
  };
}

function corsOptions(list) {
  return {
    origin: originCheck(list),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200,
  };
}

module.exports = { DEV_ORIGINS, allowedOrigins, originCheck, corsOptions };
