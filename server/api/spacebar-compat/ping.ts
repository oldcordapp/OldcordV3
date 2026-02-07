import { Router } from 'express';
import type { Response } from "express"

import { config } from '../../helpers/utils/globalutils.js';
const router = Router();

router.get('/', (res: Response) => {
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
