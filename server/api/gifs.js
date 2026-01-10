const express = require('express');
const { logText } = require('../helpers/logger');
const router = express.Router({ mergeParams: true });
const quickcache = require('../helpers/quickcache');
const errors = require('../helpers/errors');

router.get('/trending', quickcache.cacheFor(60 * 5, true), async (req, res) => {
  try {
    //let provider = req.query.provider || 'tenor';
    //fuck giphy

    if (!global.config.tenor_api_key) {
      return res.status(200).json({ categories: [], gifs: [] });
    }

    let catRes = await fetch(
      `https://tenor.googleapis.com/v2/categories?key=${global.config.tenor_api_key}&type=featured`,
    );
    let catData = await catRes.json();

    let trendRes = await fetch(
      `https://tenor.googleapis.com/v2/featured?key=${global.config.tenor_api_key}&limit=10&media_filter=tinygif`,
    );
    let trendData = await trendRes.json();

    let categories = (catData.tags || []).map((tag) => ({
      name: tag.searchterm,
      src: tag.image,
      label: tag.searchterm,
    }));

    let gifs = (trendData.results || []).map((gif) => ({
      type: 'gif',
      id: gif.id,
      src: gif.media_formats.tinygif.url,
      url: gif.itemurl,
      width: gif.media_formats.tinygif.dims[0],
      height: gif.media_formats.tinygif.dims[1],
    }));

    return res.json({
      categories: categories,
      gifs: gifs,
    });
  } catch (error) {
    logText(err, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/trending-gifs', quickcache.cacheFor(60 * 5, true), async (req, res) => {
  try {
    if (!global.config.tenor_api_key) {
      return res.status(200).json([]);
    }

    let response = await fetch(
      `https://tenor.googleapis.com/v2/featured?key=${global.config.tenor_api_key}&limit=50&media_filter=tinymp4,gif`,
    );
    let data = await response.json();

    let gifs = (data.results || []).map((gif) => {
      let video = gif.media_formats.tinymp4;

      return {
        type: 'gif',
        id: gif.id,
        src: video.url,
        url: gif.itemurl,
        width: video.dims[0],
        height: video.dims[1],
        format: 'VIDEO',
      };
    });

    return res.json(gifs);
  } catch (err) {
    logText(err, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/search', quickcache.cacheFor(60 * 5, true), async (req, res) => {
  try {
    if (!global.config.tenor_api_key) {
      return res.status(200).json([]);
    }

    let query = req.query.q;
    let limit = req.query.limit || 50;
    let mediaFilter = req.query.media_format?.includes('mp4') ? 'tinymp4,gif' : 'tinygif,gif';
    let params = new URLSearchParams({
      q: query,
      key: global.config.tenor_api_key,
      limit: limit,
      media_filter: mediaFilter,
      contentfilter: 'medium',
    });

    let response = await fetch(`https://tenor.googleapis.com/v2/search?${params}`);
    let data = await response.json();

    let gifs = (data.results || []).map((gif) => {
      let isMp4Req = req.query.media_format?.includes('mp4');
      let media = isMp4Req ? gif.media_formats.tinymp4 : gif.media_formats.tinygif;

      return {
        type: 'gif',
        id: gif.id,
        src: media.url,
        url: gif.itemurl,
        width: media.dims[0],
        height: media.dims[1],
        format: isMp4Req ? 'VIDEO' : 'GIF',
      };
    });

    return res.json(gifs);
  } catch (err) {
    logText(err, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

module.exports = router;
