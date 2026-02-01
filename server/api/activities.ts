import { Router } from 'express';
import type { Response } from "express";

const router = Router({ mergeParams: true });

router.get('/statistics/applications/:applicationid', async (res: Response) => {
  return res.status(200).json([]);
});

export default router;
