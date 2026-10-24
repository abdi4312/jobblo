const mongoose = require('mongoose');

/** Helpers shared by the user controllers. */

// ── Shared helpers
// Helper to validate ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Helper to authorize user
function authorizeUser(req, targetUserId) {
  const currentUserId = req.userId;
  const currentUserRole = req.user?.role;

  // Only superAdmin OR the same user can proceed
  if (currentUserRole !== 'superAdmin' && currentUserId !== targetUserId) {
    return false;
  }
  return true;
}

module.exports = { isValidId, authorizeUser };
