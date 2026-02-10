import { Router, type Request, type Response } from 'express';

import dispatcher from '../helpers/dispatcher.ts';
import errors from '../helpers/errors.ts';
import globalUtils from '../helpers/globalutils.ts';
import Twitch from '../helpers/integrations/twitch.ts';

const router = Router({ mergeParams: true });
const integrationConfig = globalUtils.config.integration_config;

export interface PendingCallback {
  token: any;
  platform: any;
  user_agent: string;
  release_date: string;
};

let pendingCallback: PendingCallback[] = [];

router.get('/:platform/authorize', async (req: Request, res: Response) => {
  const token = req.query.token;
  const platform = req.params.platform;

  if (!token) {
    return res.status(401).json(errors.response_401.UNAUTHORIZED);
  }

  const checkPlatform = integrationConfig.find((x) => x.platform == platform);

  if (!checkPlatform) {
    return res.status(400).json({
      code: 400,
      message: 'This platform is not currently supported by Oldcord. Try again later.',
    });
  }

  pendingCallback.push({
    token: token,
    platform: platform,
    user_agent: req.headers['user-agent'] || 'unknown',
    release_date: (req as any).client_build || 'unknown',
  });

  return res.redirect(
    `https://id.twitch.tv/oauth2/authorize?response_type=code&client_id=${checkPlatform.client_id}&redirect_uri=${encodeURI(checkPlatform.redirect_uri)}&scope=channel_subscriptions+channel_check_subscription+channel%3Aread%3Asubscriptions&state=3ebc725b6bf7dfd21f353c5e8f91c212`,
  );
});

router.get('/:platform/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const platform = req.params.platform;
  //let state = req.params.state;
  const pending = pendingCallback.find(
    (x) => x.user_agent == req.headers['user-agent'] && x.release_date == req.client_build,
  );

  if (!pending) {
    return res.status(401).json(errors.response_401.UNAUTHORIZED);
  }

  const token = pending.token;

  if (!token) {
    return res.status(401).json(errors.response_401.UNAUTHORIZED);
  }

  const account = await global.database.getAccountByToken(token);

  if (!account) {
    return res.status(401).json(errors.response_401.UNAUTHORIZED);
  }

  if (platform != 'twitch') {
    return res.status(400).json({
      code: 400,
      message: 'Unsupported platform',
    });
  } //Whats the error here?

  if (!code) {
    return res.status(400).json({
      code: 400,
      message: 'Something went wrong while connecting your account. Try again later.',
    });
  }

  const twitch = new Twitch(code);

  const access_token = await twitch.getAccessToken();

  if (access_token == null) {
    return res.status(400).json({
      code: 400,
      message: 'Something went wrong while connecting your account. Try again later.',
    });
  }

  const user = await twitch.getUser(access_token);

  if (user == null) {
    return res.status(400).json({
      code: 400,
      message: 'Something went wrong while connecting your account. Try again later.',
    });
  }

  const attemptAddConnection = await global.database.addConnectedAccount(
    account.id,
    platform,
    user.id,
    user.login,
  );

  if (!attemptAddConnection) {
    return res.status(400).json({
      code: 400,
      message: 'Something went wrong while connecting your account. Try again later.',
    });
  }

  pendingCallback = pendingCallback.filter((x) => x !== pending);

  await dispatcher.dispatchEventTo(account.id, 'USER_CONNECTIONS_UPDATE', {});

  return res.status(200).json({
    code: 200,
    message: 'Success',
  });
});

export default router;
