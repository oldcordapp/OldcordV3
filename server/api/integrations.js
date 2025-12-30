const express = require('express');
const { rateLimitMiddleware } = require('../helpers/middlewares');
const { logText } = require('../helpers/logger');
const quickcache = require('../helpers/quickcache');
const router = express.Router({ mergeParams: true });
const Watchdog = require('../helpers/watchdog');
const errors = require('../helpers/errors');

router.get("/tenor/search", rateLimitMiddleware(global.config.ratelimit_config.tenorSearch.maxPerTimeFrame, global.config.ratelimit_config.tenorSearch.timeFrame), Watchdog.middleware(global.config.ratelimit_config.tenorSearch.maxPerTimeFrame, global.config.ratelimit_config.tenorSearch.timeFrame, 0.1), quickcache.cacheFor(60 * 30, true), async (req, res) => {
    try {
        const query = req.query.q;

        if (!query || !global.config.tenor_api_key) {
             return res.json([]);
        }

        const baseUrl = "https://tenor.googleapis.com/v2/search";
        const params = new URLSearchParams({
            q: query,
            key: global.config.tenor_api_key,
            limit: 50,
            media_filter: "tinygif"
        }).toString();

        const url = `${baseUrl}?${params}`;

        const response = await fetch(url, {
            method: "GET"
        });

        const data = await response.json();
        const results = data.results || [];

        const gifs = results
            .map(gif => {
                const media = gif.media_formats?.tinygif;
                return {
                    type: "gif",
                    src: media?.url || null,
                    url: gif.itemurl,
                    width: gif.width,
                    height: 100
                };
            })
            .filter(g => g.src !== null);

        return res.json(gifs);
    } catch (err) {
        logText(err, "error");
    
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

module.exports = router;