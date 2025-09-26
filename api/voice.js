const express = require('express');
const globalUtils = require('../helpers/globalutils');

const router = express.Router({ mergeParams: true });
const quickcache = require('../helpers/quickcache');

router.get("/regions", quickcache.cacheFor(60 * 60 * 5, true), async (_, res) => {
    return res.status(200).json(globalUtils.getRegions());
});

module.exports = router;