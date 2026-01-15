import { createHash } from 'crypto';

import globalUtils from './globalutils.js';

const quickcache = {
  cacheStore: new Map(),
  requestLock: new Map(),
  getCacheKey(req, shared) {
    if (!req.headers['authorization'] && !shared) {
      return null;
    }

    let url = req.originalUrl;

    let inValue = `${url}::SHARED`;

    if (!shared) {
      let token = req.headers['authorization'];
      inValue = `${url}::${token}`;
    }

    let hash = createHash('sha256').update(inValue).digest('hex');

    return hash;
  },
  cacheFor(ttl, shared = false) {
    return function (req, res, next) {
      if (
        req.method !== 'GET' ||
        req.headers['cache-control'] === 'no-cache' ||
        !globalUtils.config['cache_authenticated_get_requests']
      ) {
        return next();
      } //NEVER cache anything other than GET or well no-cache

      let self = quickcache;
      let cacheKey = self.getCacheKey(req, shared);

      if (cacheKey === null) {
        return next();
      }

      let currentTime = Math.floor(Date.now() / 1000);
      let cachedEntry = self.cacheStore.get(cacheKey);

      if (cachedEntry && cachedEntry.cached_until > currentTime) {
        res.setHeader(
          'x-oldcord-cache-info',
          JSON.stringify({
            status: 'hit',
            cached_at: cachedEntry.cached_at,
            cached_until: cachedEntry.cached_until,
          }),
        );

        return res.json(JSON.parse(cachedEntry.data));
      }

      if (self.requestLock.has(cacheKey)) {
        self.requestLock.get(cacheKey).push(res);
        return;
      }

      self.requestLock.set(cacheKey, [res]);

      let originalJson = res.json;

      res.json = (body) => {
        let expiry = currentTime + ttl;

        let cacheEntry = {
          data: JSON.stringify(body),
          cached_at: currentTime,
          cached_until: expiry,
        };

        self.cacheStore.set(cacheKey, cacheEntry);

        let waitList = self.requestLock.get(cacheKey) || [];
        let cacheInfo = {
          status: 'miss',
          cached_at: currentTime,
          cached_until: expiry,
        };

        waitList.forEach((client) => {
          client.setHeader('x-oldcord-cache-info', JSON.stringify(cacheInfo));

          originalJson.call(client, body);
        });

        self.requestLock.delete(cacheKey);
      };

      next();
    };
  },
};

export const {
  cacheStore,
  requestLock,
  getCacheKey,
  cacheFor
} = quickcache;

export default quickcache;
