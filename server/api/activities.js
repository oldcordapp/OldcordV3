import { Router } from 'express';
const router = Router({ mergeParams: true });

router.get('/statistics/applications/:applicationid', async (req, res) => {
  return res.status(200).json([]);
});

export default router;
