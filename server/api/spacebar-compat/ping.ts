import { Router } from 'express';
import type { Request, Response } from "express"

import { config } from '../../helpers/globalutils.js';
const router = Router();

router.get('/', (_req: Request, res: Response) => {
  return res.json({
    ping: 'pong! this is oldcord! not spacebar! you got FOOLED!',
    instance: {
      id: 'what the fuck is this?',
      name: config.instance.name,
      description: config.instance.description,
      image: null,
      correspondenceEmail: null,
      correspondenceUserID: null,
      frontPage: null,
      tosPage: config.instance.legal.terms,
    },
  });
});

export default router;
