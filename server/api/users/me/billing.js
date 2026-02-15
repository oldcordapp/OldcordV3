import { Router } from 'express';
const router = Router();
import { AVAILABLE_PLANS_ID } from '../../../helpers/consts/subscriptions.js';
import Snowflake from '../../../helpers/utils/snowflake.js';

router.param('guildid', async (req, _, next, guildid) => {
  req.guild = await global.database.getGuildById(guildid);

  next();
});

router.get('/subscriptions', async (req, res) => {
  const subscriptions = await global.database.getUserSubscriptions(req.account.id);

  return res.status(200).json(subscriptions);
});
router.post('/subscriptions', async (req, res) => {//TODO: check if the payment source is valid/exists (because why not)
  const acc = req.account;
  const { payment_gateway_plan_id: plan, payment_source_id: cardID } = req.body;

  if (plan === AVAILABLE_PLANS_ID.premium_month_tier_2 || plan === AVAILABLE_PLANS_ID.premium_year_tier_2){
    // TODO make the nitro badge dynamic
    const gotPremium = await global.database.setUserPremium(acc.id, true);
    if (gotPremium===null) return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  };

  return res.status(200).json({success:true});
});

router.get('/payment-sources', (req, res) => {
  return res.status(200).json([
    //TODO put this on the user's db idk thing and make this is the default
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
