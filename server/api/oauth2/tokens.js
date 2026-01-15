import { Router } from 'express';
const router = Router({ mergeParams: true });

router.get('/', async (req, res) => {
  return res.status(200).json([]);
});

export default router;
