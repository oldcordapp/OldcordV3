import { Router } from 'express';
import type { Request, Response } from "express";

import { response_500 } from '../helpers/errors.js';
import { logText } from '../helpers/logger.ts';
const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      indicators_suppressed: true,
      indicators_confirmed: [
        'direct-messages',
        'voice-conversations',
        'organize-by-topic',
        'writing-messages',
        'instant-invite',
        'server-settings',
        'create-more-servers',
        'friends-list',
        'whos-online',
        'create-first-server',
      ],
    });
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/indicators/suppress', async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      indicators_suppressed: true,
      indicators_confirmed: [
        'direct-messages',
        'voice-conversations',
        'organize-by-topic',
        'writing-messages',
        'instant-invite',
        'server-settings',
        'create-more-servers',
        'friends-list',
        'whos-online',
        'create-first-server',
      ],
    });
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
  }
});

router.put('/indicators/:indicator', async (_req: Request, res: Response) => {
  try {
    return res.status(200).json({
      indicators_suppressed: true,
      indicators_confirmed: [
        'direct-messages',
        'voice-conversations',
        'organize-by-topic',
        'writing-messages',
        'instant-invite',
        'server-settings',
        'create-more-servers',
        'friends-list',
        'whos-online',
        'create-first-server',
      ],
    });
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
