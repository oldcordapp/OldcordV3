import { Router } from 'express';
import type { Request, Response } from 'express';
import { logText } from '../helpers/logger.ts';
import { response_500 } from '../helpers/errors.ts';
import { cacheFor } from '../helpers/quickcache.ts';

const router = Router({ mergeParams: true });

interface TenorMedia {
  url: string;
  dims: [number, number];
  size: number;
}

interface TenorResult {
  id: string;
  itemurl: string;
  media_formats: {
    tinygif: TenorMedia;
    gif: TenorMedia;
    tinymp4: TenorMedia;
  };
}

interface TenorCategory {
  searchterm: string;
  image: string;
}

router.get('/trending', cacheFor(60 * 5, true), async (_req: Request, res: Response) => {
  try {
    const apiKey = global.config.tenor_api_key;
    if (!apiKey) {
      return res.status(200).json({ categories: [], gifs: [] });
    }

    const [catRes, trendRes] = await Promise.all([
      fetch(`https://tenor.googleapis.com/v2/categories?key=${apiKey}&type=featured`),
      fetch(`https://tenor.googleapis.com/v2/featured?key=${apiKey}&limit=10&media_filter=tinygif`)
    ]);

    const catData = (await catRes.json()) as { tags: TenorCategory[] };
    const trendData = (await trendRes.json()) as { results: TenorResult[] };

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

    return res.json({ categories, gifs });
  } catch (error) {
    logText(error, 'error');
    return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/trending-gifs', cacheFor(60 * 5, true), async (_req: Request, res: Response) => {
  try {
    const apiKey = global.config.tenor_api_key;

    if (!apiKey) {
      return res.status(200).json([]);
    }

    const response = await fetch(
      `https://tenor.googleapis.com/v2/featured?key=${apiKey}&limit=50&media_filter=tinymp4,gif`
    );
    const data = (await response.json()) as { results: TenorResult[] };

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

router.get('/search', cacheFor(60 * 5, true), async (req: Request, res: Response) => {
  try {
    const apiKey = global.config.tenor_api_key;
    if (!apiKey) {
      return res.status(200).json([]);
    }

    const query = req.query.q as string;
    const limit = (req.query.limit as string) || '50';
    const isMp4Req = (req.query.media_format as string)?.includes('mp4');
    
    const mediaFilter = isMp4Req ? 'tinymp4,gif' : 'tinygif,gif';
    const params = new URLSearchParams({
      q: query || '',
      key: apiKey,
      limit: limit,
      media_filter: mediaFilter,
      contentfilter: 'medium',
    });

    const response = await fetch(`https://tenor.googleapis.com/v2/search?${params}`);
    const data = (await response.json()) as { results: TenorResult[] };

    const gifs = (data.results || []).map((gif) => {
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