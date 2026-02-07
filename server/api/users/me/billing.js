import { Router } from 'express';
const router = Router();
import Snowflake from '../../../helpers/utils/snowflake.js';

router.param('guildid', async (req, _, next, guildid) => {
  req.guild = await global.database.getGuildById(guildid);

  next();
});

router.get('/subscriptions', async (req, res) => {
  const subscriptions = await global.database.getUserSubscriptions(req.account.id);

  return res.status(200).json(subscriptions);
});

router.get('/payment-sources', (req, res) => {
  return res.status(200).json([
    {
      id: Snowflake.generate(),
      type: 1,
      invalid: false,
      flags: 0,
      brand: 'visa',
      last_4: '5555',
      expires_month: 12,
      expires_year: 2099,
      country: 'US',
      billing_address: {
        name: 'Johnathon Oldcord',
        line_1: '123 Oldcord Way',
        line_2: null,
        town: 'San Francisco',
        state: 'CA',
        postal_code: '94105',
        country: 'US',
      },
      default: true,
    },
  ]);
});

export default router;
