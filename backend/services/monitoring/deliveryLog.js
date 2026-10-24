const mongoose = require('mongoose');

/**
 * Fire-and-forget DeliveryLog write. Skipped when the database is not connected,
 * so a send never waits on (or fails because of) monitoring.
 */
function logDelivery(fields) {
  if (mongoose.connection.readyState !== 1) return;
  require('../../models/DeliveryLog')
    .create({ at: new Date(), ...fields })
    .catch(() => {});
}

module.exports = { logDelivery };
