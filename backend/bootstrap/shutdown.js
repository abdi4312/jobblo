/**
 * Graceful shutdown on SIGTERM / SIGINT (deploys, Ctrl+C, nodemon restarts): stop taking new
 * connections, let in-flight requests and running queue jobs finish, then close Redis and
 * MongoDB. A deadline forces the exit so a stuck request cannot block a deploy forever.
 */
const DEADLINE_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000;

function registerShutdown({ server, io, extra = [] }) {
  let closing = false;
  const close = async (signal) => {
    if (closing) return;
    closing = true;
    console.log(`[shutdown] ${signal}: closing (max ${DEADLINE_MS / 1000}s)…`);
    const timer = setTimeout(() => {
      console.error('[shutdown] deadline reached — forcing exit');
      process.exit(1);
    }, DEADLINE_MS);
    timer.unref();
    const step = async (name, fn) => {
      try {
        await fn();
      } catch (err) {
        console.error(`[shutdown] ${name}:`, err.message);
      }
    };
    await step('http', () => new Promise((resolve) => server.close(() => resolve())));
    if (io) await step('socket.io', () => new Promise((resolve) => io.close(() => resolve())));
    await step('queue workers', () => require('../services/queue').stopWorkers());
    for (const [name, fn] of extra) await step(name, fn);
    await step('redis', () => require('../config/redis').closeRedis());
    await step('mongodb', () => require('mongoose').disconnect());
    console.log('[shutdown] done');
    process.exit(0);
  };
  process.once('SIGTERM', () => close('SIGTERM'));
  process.once('SIGINT', () => close('SIGINT'));
  return close;
}

module.exports = { registerShutdown };
