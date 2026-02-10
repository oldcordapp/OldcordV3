import { Router } from 'express';

import { logText } from '../helpers/logger.ts';
import { rateLimitMiddleware } from '../helpers/middlewares.ts';
import { cacheFor } from '../helpers/quickcache.ts';
const router = Router({ mergeParams: true });
import { response_500 } from '../helpers/errors.ts';
import { middleware } from '../helpers/watchdog.ts';
import type { Response } from "express";

router.get(
  '/tenor/search',
  rateLimitMiddleware(
    global.config.ratelimit_config.tenorSearch.maxPerTimeFrame,
    global.config.ratelimit_config.tenorSearch.timeFrame,
  ),
  middleware(
    global.config.ratelimit_config.tenorSearch.maxPerTimeFrame,
    global.config.ratelimit_config.tenorSearch.timeFrame,
    0.1,
  ),
  cacheFor(60 * 30, true),
  async (req: any, res: Response) => {
    try {
      const query = req.query.q;

      if (!query || !global.config.tenor_api_key) {
        return res.json([]);
      }

      const baseUrl = 'https://tenor.googleapis.com/v2/search';
      const params = new URLSearchParams({
        q: query,
        key: global.config.tenor_api_key,
        limit: 50,
        media_filter: 'tinygif',
      } as any).toString();

      const url = `${baseUrl}?${params}`;

      const response = await fetch(url, {
        method: 'GET',
      });

      const data: any = await response.json();
      const results = data.results || [];

      const gifs = results
        .map((gif) => {
          const media = gif.media_formats?.tinygif;
          return {
            type: 'gif',
            src: media?.url || null,
            url: gif.itemurl,
            width: gif.width,
            height: 100,
          };
        })
        .filter((g) => g.src !== null);

      return res.json(gifs);
    } catch (err) {
      logText(err, 'error');

      return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

export default router;
