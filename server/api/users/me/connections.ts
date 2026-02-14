import { Router } from 'express';

import dispatcher from '../../../helpers/dispatcher.ts';
import errors from '../../../helpers/errors.ts';
import globalUtils from '../../../helpers/globalutils.ts';
import { logText } from '../../../helpers/logger.ts';
import quickcache from '../../../helpers/quickcache.ts';
import type { Response } from "express";
import { prisma } from '../../../prisma.ts';

const router = Router();

router.get('/', quickcache.cacheFor(60 * 5), async (req: any, res: Response) => {
  try {
    const account = req.account;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
    }

    const connectedAccounts = await prisma.connectedAccount.findMany({
      where: {
        user_id: account.id
      }
    });

    return res.status(200).json(connectedAccounts.map(conn => ({
      id: conn.account_id,
      type: conn.platform,
      name: conn.username,
      revoked: conn.revoked,
      integrations: conn.integrations ?? [], 
      visibility: conn.visibility ? 1 : 0,
      friendSync: conn.friendSync,
    })));
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/:platform/:connectionid', async (req: any, res: Response) => {
  try {
    const { account } = req;
    const { platform, connectionid } = req.params;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
    }

    const config = globalUtils.config.integration_config.find((x) => x.platform === platform);

    if (!config) {
      return res.status(400).json({
        code: 400,
        message: 'This platform is not currently supported.',
      });
    }

    try {
      const deleteResult = await prisma.connectedAccount.deleteMany({
        where: {
          account_id: connectionid,
          platform: platform,
          user_id: account.id
        },
      });

      if (deleteResult.count === 0) {
        return res.status(404).json(errors.response_404.UNKNOWN_CONNECTION);
      }
    } catch (error: any) {
      throw error;
    }

    await dispatcher.dispatchEventTo(account.id, 'USER_CONNECTIONS_UPDATE', {});

    const connectedAccounts = await prisma.connectedAccount.findMany({
      where: { user_id: account.id },
      select: {
        account_id: true,
        platform: true,
        username: true,
        revoked: true,
        integrations: true,
        visibility: true,
        friendSync: true,
      }
    });

    return res.status(200).json(connectedAccounts.map(conn => ({
      id: conn.account_id,
      type: conn.platform,
      name: conn.username,
      revoked: conn.revoked,
      integrations: conn.integrations ?? [],
      visibility: conn.visibility ? 1 : 0,
      friendSync: conn.friendSync,
    })));

  } catch (error) {
    logText(error, 'error');
    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.patch('/:platform/:connectionid', async (req: any, res: Response) => {
  try {
    const { account } = req;
    const { platform, connectionid } = req.params;
    const { visibility } = req.body;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
    }

    const config = globalUtils.config.integration_config.find((x) => x.platform === platform);

    if (!config) {
      return res.status(400).json({
        code: 400,
        message: 'This platform is not currently supported.',
      });
    }

    const updateResult = await prisma.connectedAccount.updateMany({
      where: {
        account_id: connectionid,
        platform: platform,
        user_id: account.id,
      },
      data: {
        visibility: visibility === 1, 
      },
    });

    if (updateResult.count === 0) {
      return res.status(404).json(errors.response_404.UNKNOWN_CONNECTION);
    }

    await dispatcher.dispatchEventTo(account.id, 'USER_CONNECTIONS_UPDATE', {});

    const connectedAccounts = await prisma.connectedAccount.findMany({
      where: { user_id: account.id },
      select: {
        account_id: true,
        platform: true,
        username: true,
        revoked: true,
        integrations: true,
        visibility: true,
        friendSync: true,
      }
    });

    return res.status(200).json(connectedAccounts.map(conn => ({
      id: conn.account_id,
      type: conn.platform,
      name: conn.username,
      revoked: conn.revoked,
      integrations: conn.integrations ?? [],
      visibility: conn.visibility ? 1 : 0,
      friendsync: conn.friendSync,
    })));
  } catch (error) {
    logText(error, 'error');
    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
