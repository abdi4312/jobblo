const Service = require('../../models/Service');

// Longer than any check-and-create below; an abandoned lock (crash) frees itself.
const LOCK_MS = 30 * 1000;

/**
 * Claim the service for contract creation. Returns null when another request holds it,
 * otherwise { release }. Callers hold it across "no blocking order exists" + order.save().
 */
async function acquireServiceContractLock(serviceId, now = new Date()) {
  const locked = await Service.findOneAndUpdate(
    {
      _id: serviceId,
      $or: [{ contractLockAt: null }, { contractLockAt: { $lte: new Date(now.getTime() - LOCK_MS) } }],
    },
    { $set: { contractLockAt: now } }
  );
  if (!locked) return null;
  return {
    release: () => Service.updateOne({ _id: serviceId, contractLockAt: now }, { $set: { contractLockAt: null } }),
  };
}

module.exports = { acquireServiceContractLock, LOCK_MS };
