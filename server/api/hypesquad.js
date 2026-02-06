import errors from '../helpers/consts/errors.js';
import { rateLimitMiddleware } from '../helpers/middlewares.js';
import Watchdog from '../helpers/watchdog.ts';
import { Router } from 'express';
const router = Router();

router.post('/online',
  rateLimitMiddleware(
    global.config.ratelimit_config.hypesquad.maxPerTimeFrame,
    global.config.ratelimit_config.hypesquad.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.hypesquad.maxPerTimeFrame,
    global.config.ratelimit_config.hypesquad.timeFrame,
    0.75,
  ), async (req, res) => {
    const acc = req.account;
    const { house_id } = req.body;

    // TODO: add damn badges (i don't know how but yes)
    const dbsuccess = await global.database.changeHypesquadStatus(acc.id, house_id);
    if (!dbsuccess) return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    
    return res.status(200).send(String(house_id));
});

export default router;
