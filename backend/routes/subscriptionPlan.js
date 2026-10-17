const express = require('express');
const router = express.Router();
const subscriptionRebuildInProgress = require('../middleware/subscriptionRebuildInProgress');
const subscriptionV2Controller = require('../controllers/subscriptionV2Controller');

router.get('/', subscriptionV2Controller.getPlanCatalogue);
router.post('/', subscriptionRebuildInProgress);
router.put('/:id', subscriptionRebuildInProgress);
router.delete('/:id', subscriptionRebuildInProgress);

module.exports = router;
