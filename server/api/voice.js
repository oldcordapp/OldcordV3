import { Router } from 'express';

import { getRegions } from '../helpers/globalutils.js';

const router = Router({ mergeParams: true });
import { cacheFor } from '../helpers/quickcache.js';

router.get('/regions', cacheFor(60 * 60 * 5, true), async (_, res) => {
  return res.status(200).json(getRegions());
});

export default router;
