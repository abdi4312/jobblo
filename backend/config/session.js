const mongoose = require('mongoose');
const session = require('express-session');

/**
 * express-session (OAuth / BankID transaction state only — auth itself is JWT + models/Session).
 *
 * This used to run on express-session's MemoryStore, documented as unsuitable for
 * production: it leaks, it is per-process, and every session is lost on restart. The BankID
 * flow keeps its `state`, `nonce` and PKCE `code_verifier` here while the person reaches for
 * a code device, and the callback arrives on a different request minutes later — with
 * MemoryStore a restart or a second instance makes every BankID login fail closed.
 *
 * connect-mongo stores sessions in the database Jobblo already runs and reuses Mongoose's
 * connection (Cosmos bills and caps connections). Without MONGO_URI it falls back to
 * MemoryStore so local work without a database still runs — loudly in production.
 */
function buildSessionStore(env = process.env) {
  if (!env.MONGO_URI) {
    if (env.NODE_ENV === 'production') {
      console.error('CRITICAL: MONGO_URI is not set, so sessions are using the in-memory store. BankID logins will fail on restart and across instances.');
    }
    return undefined; // express-session falls back to MemoryStore
  }
  const MongoStore = require('connect-mongo').default;
  return MongoStore.create({
    clientPromise: mongoose.connection.asPromise().then((conn) => conn.getClient()),
    // NOT 'sessions': that collection is models/Session.js (refresh tokens) with a UNIQUE
    // index on refreshToken — connect-mongo documents collided on `refreshToken: null` and
    // BankID could not start at all.
    collectionName: 'expressSessions',
    ttl: 24 * 60 * 60, // an in-flight OIDC transaction at most
    touchAfter: 3600, // one write per hour per session; Cosmos charges per write
    // Holds a PKCE code_verifier: encrypted at rest so a DB dump cannot finish someone's login.
    crypto: env.SESSION_SECRET ? { secret: env.SESSION_SECRET } : undefined,
  });
}

function sessionMiddleware(env = process.env) {
  return session({
    // Separate from JWT_SECRET so leaking one does not compromise the other; falls back.
    secret: env.SESSION_SECRET || env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: buildSessionStore(env),
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  });
}

module.exports = { buildSessionStore, sessionMiddleware };
