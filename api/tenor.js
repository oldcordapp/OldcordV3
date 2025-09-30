const express = require("express");
const axios = require("axios");
const path = require("path");
const router = express.Router();

const config = require(path.join(__dirname, "..", "config.json"));
const TENOR_API_KEY = config.tenor_api_key;

router.get("/search", async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: "Missing query parameter `q`" });
        }

        const response = await axios.get("https://tenor.googleapis.com/v2/search", {
            params: {
                q: query,
                key: TENOR_API_KEY,
                limit: 10,
                media_filter: "tinygif"
            }
        });

        const results = response.data.results || [];

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
        console.error("Error fetching Tenor:", err.message);
        return res.status(500).json({ error: "Failed to fetch GIFs" });
    }
});

module.exports = router;
