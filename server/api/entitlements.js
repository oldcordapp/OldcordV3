import { Router } from 'express';

import { logText } from '../helpers/utils/logger.ts';
import { generate } from '../helpers/utils/snowflake.js';
const router = Router({ mergeParams: true });
import { response_500 } from '../helpers/consts/errors.js';
import { cacheFor } from '../helpers/quickcache.js';

router.param('code', async (req, _, next, code) => {
  const id = '1279311572212178955';

  req.gift = {
    code: req.params.code,
    sku_id: id,
    application_id: id,
    uses: 0,
    max_uses: 9999,
    expires_at: null,
    redeemed: false,
    entitlement_branches: [id],
    batch_id: id,
    store_listing: {
      id: id,
      summary:
        'In this game work your way to the top of your own games company! Release a mobile chat application then sell your data to tencent! Sell the platform and then months later have them be fined for privacy violations! Afterwards, start a quirky company for gamers and take the world by storm! Rolling out promising features and stability at first just to have it all unravel into a corporate shell with microtransactions and bloatware. Do you have what it takes to become the CEO of Discord?',
      sku: {
        id: id,
        type: 1,
        product_line: null,
        dependent_sku_id: null,
        application_id: id,
        manifest_labels: null,
        access_type: 2,
        name: 'JASON CITRON SIMULATOR 2024',
        features: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        release_date: '2000-01-01',
        premium: false,
        slug: 'jasoncitronsimulator2024',
        flags: 0,
        genres: [31],
        legal_notice: 'pls dont take this seriously k thx',
        system_requirements: {
          1: {
            minimum: {
              operating_system_version: 'O',
              cpu: 'L',
              gpu: 'D',
              ram: 1337000,
              disk: 1337000,
              sound_card: 'C',
              directx: 'O',
              network: 'R',
              notes: 'D',
            },
            recommended: {
              operating_system_version: '2',
              cpu: '0',
              gpu: '2',
              ram: 1337000,
              disk: 1337000,
              sound_card: '4',
              directx: 'Y',
              network: 'a',
              notes: 'a',
            },
          },
        },
        show_age_gate: false,
        price: {
          amount: 9999,
          currency: 'usd',
          currency_exponent: 2,
        },
        locales: [],
      },
      tagline: 'Jason Citron Simulator 2024',
      box_art: {
        id: generate(),
        size: 95039,
        mime_type: 'image/png',
        width: 600,
        height: 800,
      },
      thumbnail: {
        id: generate(),
        size: 297008,
        mime_type: 'image/png',
        width: 1280,
        height: 720,
      },
      preview_video: {
        id: generate(),
        size: 1311923,
        mime_type: 'video/mp4',
        width: 640,
        height: 360,
      },
      hero_video: {
        id: generate(),
        size: 1311923,
        mime_type: 'video/mp4',
        width: 640,
        height: 360,
      },
      benefits: [],
    },
  };

  next();
});

router.get('/gift-codes/:code', cacheFor(60 * 10), async (req, res) => {
  try {
    return res.status(200).json(req.gift);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
