/**
 * The one socket.io server instance, reachable from anywhere.
 *
 * `app.set('io', io)` only helps code that has a `req`. The scheduler, the Stripe
 * provisioning service and the admin state services do not — which is part of why their
 * notifications were written to the database and never delivered: there was no obvious way
 * to reach the socket server from a background job, so nobody tried.
 *
 * Registered once at boot in `server.js`. `getIO()` returns null before that, and every
 * caller treats a null io as "skip delivery" rather than an error, so importing this from
 * a unit test does not require standing up a server.
 */

let io = null;

function setIO(instance) {
  io = instance;
}

function getIO() {
  return io;
}

module.exports = { setIO, getIO };
