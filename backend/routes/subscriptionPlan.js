const express = require('express');
const router = express.Router();
const subscriptionRebuildInProgress = require('../middleware/subscriptionRebuildInProgress');

router.get('/', subscriptionRebuildInProgress);
router.post('/', subscriptionRebuildInProgress);
router.put('/:id', subscriptionRebuildInProgress);
router.delete('/:id', subscriptionRebuildInProgress);

module.exports = router;
