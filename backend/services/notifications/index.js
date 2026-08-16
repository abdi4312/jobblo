const Notification = require('../../models/Notification');

/**
 * Every notification the product sends goes through here.
 *
 * Before this there were twenty-one places that called `Notification.create` directly and
 * three that went through a helper. Eighteen of the twenty-one never emitted anything over
 * the socket, so the notification existed in the database and the user found out about it
 * the next time something happened to refetch — which is why "someone applied to my job"
 * did not feel real time. Payment received, dispute updated, escrow auto-released,
 * subscription activated and every admin action were all in that silent group.
 *
 * The rules this file exists to enforce:
 *
 *   1. Creating a notification and delivering it are one operation. There is no way to do
 *      the first without the second.
 *   2. Delivery targets a room the server put the socket in — never a room the client asked
 *      to join. See `sockets/rooms.js` for why that distinction cost us every notification
 *      after a reconnect.
 *   3. A notification failure never breaks the thing that caused it. Nobody's payment
 *      should 500 because a socket was mid-reconnect.
 *   4. The unread count travels with the event. The client used to refetch a count over
 *      HTTP every time a socket event arrived — one extra round trip per notification, per
 *      open tab, to learn a number the server already knew.
 */

const { userRooms } = require('../../sockets/rooms');

/**
 * The notification catalogue.
 *
 * `type` was a free-form string at every call site, which is how the tray ended up with
 * 'order', 'ordre', 'system', 'system_update' and 'test' all meaning roughly one thing and
 * the frontend carrying a lookup table with duplicate entries to cope. These are the types
 * the model's enum allows; anything else is a bug and is logged rather than silently
 * written.
 *
 * `urgent` marks the events worth interrupting someone for — they get a sound and, if the
 * tab is in the background, a system notification. The rest land quietly in the tray.
 * That judgement belongs here, next to the event, not in the client.
 */
const TYPES = {
  message: { urgent: true },
  order: { urgent: true },
  application: { urgent: true },
  payment: { urgent: true },
  review: { urgent: false },
  job_update: { urgent: false },
  follow: { urgent: false },
  favorite: { urgent: false },
  promotion: { urgent: false },
  alert: { urgent: true },
  system: { urgent: false },
  system_update: { urgent: false },
  general: { urgent: false },
};

const isKnownType = (type) => Object.prototype.hasOwnProperty.call(TYPES, type);

/** What the tray shows on the sender chip, plus the ids the client routes on. */
const POPULATE = [
  { path: 'senderId', select: 'name lastName avatarUrl' },
  { path: 'orderId' },
  { path: 'requestId' },
];

/**
 * Emit an arbitrary real-time event to one user, on every room they occupy.
 *
 * Controllers reach for `io.to(...)` directly all over this codebase and disagree about
 * the room name. This is the only correct spelling.
 */
function emitToUser(io, userId, event, payload) {
  if (!io || !userId || !event) return;
  try {
    for (const room of userRooms(userId)) {
      io.to(room).emit(event, payload);
    }
  } catch (err) {
    console.error('emitToUser(%s, %s) failed: %s', userId, event, err.message);
  }
}

/** The user's current unread total, sent alongside every notification. */
async function unreadCount(userId) {
  try {
    return await Notification.countDocuments({ userId, read: false });
  } catch {
    return null;
  }
}

/**
 * Create a notification and deliver it.
 *
 * @param {import('socket.io').Server} io
 * @param {object} input
 * @param {string} input.userId     recipient
 * @param {string} input.type       one of TYPES
 * @param {string} input.content    the line shown in the tray
 * @param {string} [input.senderId] who caused it, for the avatar
 * @param {string} [input.orderId]
 * @param {string} [input.requestId]
 * @param {string} [input.event]    companion socket event to emit alongside
 * @param {object} [input.payload]  its payload
 * @returns {Promise<object|null>} the populated notification, or null if it could not be
 *   created — callers are not expected to check, that is the point.
 */
async function notify(io, input = {}) {
  const { userId, type, content, senderId, orderId, requestId, event, payload } = input;

  try {
    if (!userId || !type || !content) {
      console.error('notify: missing userId/type/content (type=%s)', type);
      return null;
    }

    if (!isKnownType(type)) {
      // The model's enum would reject this anyway, but it would do so as an unhandled
      // validation error inside whatever business operation happened to be running.
      console.error('notify: unknown notification type "%s" — not sent', type);
      return null;
    }

    const created = await Notification.create({
      userId,
      type,
      content,
      senderId: senderId || null,
      orderId: orderId || null,
      requestId: requestId || null,
    });

    const populated = await Notification.findById(created._id).populate(POPULATE);

    const count = await unreadCount(userId);
    emitToUser(io, userId, 'new_notification', {
      ...(populated ? populated.toObject() : created.toObject()),
      // The client decides between "sound + system notification" and "quiet tray entry"
      // on this flag rather than keeping its own copy of which types matter.
      urgent: TYPES[type].urgent,
      unreadCount: count,
    });

    if (count !== null) emitToUser(io, userId, 'notification_count', { count });
    if (event) emitToUser(io, userId, event, payload ?? {});

    return populated;
  } catch (err) {
    // Deliberately swallowed. A notification is a side effect of something more important
    // that has already succeeded; failing the request now would roll nothing back and
    // would tell the user their payment failed when it did not.
    console.error('notify failed [type=%s user=%s]: %s', type, userId, err.message);
    return null;
  }
}

/**
 * The same notification to several people — dispute parties, both sides of an order.
 * Runs them concurrently; one failure does not stop the others.
 */
async function notifyMany(io, userIds, build) {
  const unique = [...new Set((userIds || []).filter(Boolean).map(String))];
  return Promise.all(unique.map((userId) => notify(io, { ...build(userId), userId })));
}

/**
 * A system broadcast: one document, everybody's tray.
 *
 * Kept separate from `notify` because it is genuinely a different shape — `userId` is null,
 * there is no per-user unread count to send, and it goes to the whole namespace.
 */
async function broadcast(io, { type, content }) {
  try {
    if (!isKnownType(type)) {
      console.error('broadcast: unknown notification type "%s"', type);
      return null;
    }
    const created = await Notification.create({ type, content, isSystem: true, userId: null });
    if (io) io.emit('new_notification', { ...created.toObject(), urgent: TYPES[type].urgent });
    return created;
  } catch (err) {
    console.error('broadcast failed [type=%s]: %s', type, err.message);
    return null;
  }
}

module.exports = { notify, notifyMany, broadcast, emitToUser, unreadCount, TYPES };
