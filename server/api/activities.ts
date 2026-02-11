import type { Response } from 'express';
import { Router } from 'express';

const router = Router({ mergeParams: true });

router.get('/statistics/applications/:applicationid', (_req: any, res: Response) => {
  return res.status(200).json([]);
});

export default router;
