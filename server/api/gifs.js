import { Router } from 'express';

import { logText } from '../helpers/logger.js';
const router = Router({ mergeParams: true });
import { response_500 } from '../helpers/errors.js';
import { cacheFor } from '../helpers/quickcache.js';

router.get('/trending', cacheFor(60 * 5, true), async (req, res) => {
  try {
    //let provider = req.query.provider || 'tenor';
    //fuck giphy

    if (!global.config.tenor_api_key) {
      return res.status(200).json({ categories: [], gifs: [] });
    }

    const catRes = await fetch(
      `https://tenor.googleapis.com/v2/categories?key=${global.config.tenor_api_key}&type=featured`,
    );
    const catData = await catRes.json();

    const trendRes = await fetch(
      `https://tenor.googleapis.com/v2/featured?key=${global.config.tenor_api_key}&limit=10&media_filter=tinygif`,
    );
    const trendData = await trendRes.json();

    const categories = (catData.tags || []).map((tag) => ({
      name: tag.searchterm,
      src: tag.image,
      label: tag.searchterm,
    }));

    const gifs = (trendData.results || []).map((gif) => ({
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

    return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/trending-gifs', cacheFor(60 * 5, true), async (req, res) => {
  try {
    if (!global.config.tenor_api_key) {
      return res.status(200).json([]);
    }

    const response = await fetch(
      `https://tenor.googleapis.com/v2/featured?key=${global.config.tenor_api_key}&limit=50&media_filter=tinymp4,gif`,
    );
    const data = await response.json();

    const gifs = (data.results || []).map((gif) => {
      const video = gif.media_formats.tinymp4;

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

    return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/search', cacheFor(60 * 5, true), async (req, res) => {
  try {
    if (!global.config.tenor_api_key) {
      return res.status(200).json([]);
    }

    const query = req.query.q;
    const limit = req.query.limit || 50;
    const mediaFilter = req.query.media_format?.includes('mp4') ? 'tinymp4,gif' : 'tinygif,gif';
    const params = new URLSearchParams({
      q: query,
      key: global.config.tenor_api_key,
      limit: limit,
      media_filter: mediaFilter,
      contentfilter: 'medium',
    });

    const response = await fetch(`https://tenor.googleapis.com/v2/search?${params}`);
    const data = await response.json();

    const gifs = (data.results || []).map((gif) => {
      const isMp4Req = req.query.media_format?.includes('mp4');
      const media = isMp4Req ? gif.media_formats.tinymp4 : gif.media_formats.tinygif;

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

    return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
