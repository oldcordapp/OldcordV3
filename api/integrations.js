const express = require('express');
const { rateLimitMiddleware } = require('../helpers/middlewares');
const { logText } = require('../helpers/logger');
const quickcache = require('../helpers/quickcache');
const router = express.Router({ mergeParams: true });
const fetch = require('node-fetch');

router.get("/tenor/search", rateLimitMiddleware(global.config.ratelimit_config.tenorSearch.maxPerTimeFrame, global.config.ratelimit_config.tenorSearch.timeFrame), quickcache.cacheFor(60 * 30, true), async (req, res) => {
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
                    width: 100,
                    height: 100
                };
            })
            .filter(g => g.src !== null);

        return res.json(gifs);
    } catch (err) {
        logText(err, "error");
    
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

module.exports = router;