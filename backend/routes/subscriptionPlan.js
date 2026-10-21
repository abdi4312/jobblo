const express = require('express');
const router = express.Router();
const subscriptionRebuildInProgress = require('../middleware/subscriptionRebuildInProgress');
const subscriptionV2Controller = require('../controllers/subscriptionV2Controller');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.get('/', subscriptionV2Controller.getPlanCatalogue);
router.post('/', subscriptionRebuildInProgress);
// Entitlements only (price/name/type/isActive locked to Stripe); create/delete stay off.
router.put('/:id', authenticate, requireAdmin, subscriptionV2Controller.updatePlanEntitlements);
router.delete('/:id', subscriptionRebuildInProgress);

module.exports = router;
