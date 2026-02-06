import { Router } from 'express';
import type { Response } from "express";
import { getRegions } from '../helpers/utils/globalutils.js';

const router = Router({ mergeParams: true });
import { cacheFor } from '../helpers/quickcache.js';

router.get('/regions', cacheFor(60 * 60 * 5, true), async (res: Response) => {
  return res.status(200).json(getRegions());
});

export default router;
