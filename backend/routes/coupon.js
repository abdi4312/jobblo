const express = require('express');
const router = express.Router();
const subscriptionRebuildInProgress = require('../middleware/subscriptionRebuildInProgress');

router.post('/', subscriptionRebuildInProgress);
router.get('/', subscriptionRebuildInProgress);
router.put('/:id', subscriptionRebuildInProgress);
router.delete('/:id', subscriptionRebuildInProgress);
router.post('/validate', subscriptionRebuildInProgress);

module.exports = router;
