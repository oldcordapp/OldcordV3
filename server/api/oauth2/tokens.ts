import { Router } from 'express';
import type { Request, Response } from "express";

const router = Router({ mergeParams: true });

router.get('/', async (_req: Request, res: Response) => {
  return res.status(200).json([]);
});

export default router;
