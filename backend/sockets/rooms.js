/**
 * Which socket.io rooms a user occupies, and — more importantly — who puts them there.
 *
 * The app grew two conventions for the same thing. `chat.socket.js` joined the raw
 * `<userId>` room inside `io.on('connection')`, while `server.js` joined `user_<userId>`
 * but only in response to a `join` event the *client* had to send. Controllers then picked
 * whichever name their author happened to know: the notification helper emitted to
 * `<userId>`, and orders, payments and provider work emitted to `user_<userId>`.
 *
 * That second convention is the bug behind "sometimes it is not real time".
 * `socket.emit('join')` runs once, when the React hook mounts. socket.io reconnects
 * transparently after a network blip — and a reconnect is a *new* socket with no rooms.
 * Nothing re-sent `join`, so from the first dropped connection onward the user was no
 * longer in `user_<id>` and every order, application and payment event went to an empty
 * room until they reloaded the page. Chat kept working the whole time, because its room
 * was joined server-side on connection. On a phone, where the socket drops every time the
 * browser is backgrounded, that is most of the session.
 *
 * So: rooms are joined by the server, on connection, from the authenticated id — never
 * from a client message, and never once-per-mount. Both names are joined because
 * controllers throughout the codebase still use both, and a room is free.
 */

/** Every room that should receive events addressed to this user. */
function userRooms(userId) {
  const id = String(userId || '');
  if (!id) return [];
  return [id, `user_${id}`];
}

/**
 * Put an authenticated socket in its rooms. Called from `io.on('connection')`, so it runs
 * again on every reconnect without the client having to know anything about it.
 */
function joinUserRooms(socket) {
  if (!socket?.userId) return;
  for (const room of userRooms(socket.userId)) socket.join(room);
}

module.exports = { userRooms, joinUserRooms };
