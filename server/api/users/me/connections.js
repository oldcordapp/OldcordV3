import { Router } from 'express';

import dispatcher from '../../../helpers/dispatcher.js';
import errors from '../../../helpers/errors.js';
import globalUtils from '../../../helpers/globalutils.js';
import { logText } from '../../../helpers/logger.ts';
import quickcache from '../../../helpers/quickcache.js';

const router = Router();

router.get('/', quickcache.cacheFor(60 * 5), async (req, res) => {
  try {
    const account = req.account;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
    }

    const connectedAccounts = await global.database.getConnectedAccounts(account.id);

    return res.status(200).json(connectedAccounts);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/:platform/:connectionid', async (req, res) => {
  try {
    const account = req.account;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
    }

    const platform = req.params.platform;
    const connectionid = req.params.connectionid;

    const config = globalUtils.config.integration_config.find((x) => x.platform == platform);

    if (!config) {
      return res.status(400).json({
        code: 400,
        message: 'This platform is not currently supported by Oldcord. Try again later.',
      }); //figure this out
    }

    const connection = await global.database.getConnectionById(connectionid);

    if (connection == null) {
      return res.status(404).json(errors.response_404.UNKNOWN_CONNECTION);
    }

    const tryRemove = await global.database.removeConnectedAccount(connection.id);

    if (!tryRemove) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    await dispatcher.dispatchEventTo(account.id, 'USER_CONNECTIONS_UPDATE', {});

    const connectedAccounts = await global.database.getConnectedAccounts(account.id);

    return res.status(200).json(connectedAccounts);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.patch('/:platform/:connectionid', async (req, res) => {
  try {
    const account = req.account;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
    }

    const platform = req.params.platform;
    const connectionid = req.params.connectionid;

    const config = globalUtils.config.integration_config.find((x) => x.platform == platform);

    if (!config) {
      return res.status(400).json({
        code: 400,
        message: 'This platform is not currently supported by Oldcord. Try again later.',
      });
    }

    const connection = await global.database.getConnectionById(connectionid);

    if (connection == null) {
      return res.status(404).json(errors.response_404.UNKNOWN_CONNECTION);
    }

    const tryUpdate = await global.database.updateConnectedAccount(
      connection.id,
      req.body.visibility == 1 ? true : false,
    );

    if (!tryUpdate) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    await dispatcher.dispatchEventTo(account.id, 'USER_CONNECTIONS_UPDATE', {});

    const connectedAccounts = await global.database.getConnectedAccounts(account.id);

    return res.status(200).json(connectedAccounts);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
