/**
 * Redis — optional. With REDIS_URL set, Jobblo uses it for background job queues (BullMQ),
 * the rate-limit store, a shared cache and the socket.io adapter. Without it everything
 * falls back to in-process behaviour, exactly as before Redis existed.
 *
 * A Redis outage must degrade, never crash: the shared client fails commands fast
 * (maxRetriesPerRequest 1) so callers can fall back, and reconnects in the background.
 * BullMQ connections are separate (BullMQ requires maxRetriesPerRequest: null).
 */
require('./env');

const PREFIX = process.env.REDIS_PREFIX || 'jobblo';
// Off under jest unless a test opts in (REDIS_IN_TESTS=true): unit tests never need a Redis server.
const enabled = () => Boolean(process.env.REDIS_URL) && (process.env.NODE_ENV !== 'test' || process.env.REDIS_IN_TESTS === 'true');

let shared = null;
const connections = new Set();
const state = { status: 'off', lastError: null, lastErrorAt: null };

function track(client, label) {
  client.jobbloLabel = label;
  connections.add(client);
  let lastLog = 0;
  client.on('ready', () => {
    state.status = 'ready';
    state.lastError = null;
  });
  client.on('error', (err) => {
    state.status = 'error';
    state.lastError = err.message;
    state.lastErrorAt = new Date();
    // One log line per 30 s per connection, not one per reconnect attempt.
    if (Date.now() - lastLog > 30_000) {
      lastLog = Date.now();
      console.error(`[redis:${label}] ${err.message}`);
    }
  });
  client.on('end', () => connections.delete(client));
  return client;
}

function newClient(label, options = {}) {
  const IORedis = require('ioredis');
  return track(new IORedis(process.env.REDIS_URL, { connectionName: `jobblo:${label}`, enableOfflineQueue: true, ...options }), label);
}

/** The shared command client (cache, rate limits, health). null when Redis is off. */
function getRedis() {
  if (!enabled()) return null;
  if (!shared) shared = newClient('shared', { maxRetriesPerRequest: 1, connectTimeout: 5000 });
  return shared;
}

/** A new connection for BullMQ (queues need their own, with retries disabled per request). */
function bullConnection(label) {
  return newClient(`bull:${label}`, { maxRetriesPerRequest: null });
}

/** Can a command be sent right now? */
const isReady = () => Boolean(shared && shared.status === 'ready');

async function pingRedis() {
  const r = getRedis();
  if (!r) return { enabled: false };
  const started = Date.now();
  try {
    await r.ping();
    return { enabled: true, ok: true, ms: Date.now() - started };
  } catch (err) {
    return { enabled: true, ok: false, error: err.message };
  }
}

/** This instance's own Redis connections and their state (Redis Overview page). */
const connectionStates = () => [...connections].map((c) => ({ label: c.jobbloLabel, status: c.status }));

async function closeRedis() {
  await Promise.allSettled([...connections].map((c) => c.quit().catch(() => c.disconnect())));
  connections.clear();
  shared = null;
}

module.exports = { PREFIX, enabled, getRedis, newClient, bullConnection, isReady, pingRedis, closeRedis, connectionStates, state };
