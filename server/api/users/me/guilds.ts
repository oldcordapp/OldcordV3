import { Router } from 'express';

import dispatcher from '../../../helpers/dispatcher.ts';
import errors from '../../../helpers/errors.ts';
import globalUtils from '../../../helpers/globalutils.ts';
import lazyRequest from '../../../helpers/lazyRequest.ts';
import { logText } from '../../../helpers/logger.ts';
import { guildMiddleware, rateLimitMiddleware } from '../../../helpers/middlewares.ts';
import Watchdog from '../../../helpers/watchdog.ts';
import type { NextFunction, Request, Response } from "express";
import { prisma } from '../../../prisma.ts';

const router = Router();

router.param('guildid', async (req: any, _res: Response, next: NextFunction, guildid: string) => {
  req.guild = await prisma.guild.findUnique({
    where: {
      id: guildid
    },
    include: {
      members: true
    }
  });

  next();
});

router.delete(
  '/:guildid',
  guildMiddleware,
  rateLimitMiddleware(
    global.config.ratelimit_config.leaveGuild.maxPerTimeFrame,
    global.config.ratelimit_config.leaveGuild.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.leaveGuild.maxPerTimeFrame,
    global.config.ratelimit_config.leaveGuild.timeFrame,
    0.5,
  ),
  async (req: any, res: Response) => {
    try {
      try {
        const user = req.account;
        const guild = req.guild;

        if (guild.owner_id == user.id) {
          await dispatcher.dispatchEventInGuild(guild, 'GUILD_DELETE', {
            id: req.params.guildid,
          });

          await prisma.guild.delete({
            where: {
              id: guild.id
            }
          });

          return res.status(204).send();
        } else {
          await prisma.member.deleteMany({
            where: {
              user_id: user.id,
              guild_id: guild.id
            }
          }); //??

          await dispatcher.dispatchEventTo(user.id, 'GUILD_DELETE', {
            id: req.params.guildid,
          });

          const activeSessions = dispatcher.getAllActiveSessions();

          for (const session of activeSessions) {
            if (session.subscriptions && session.subscriptions[req.guild.id]) {
              if (session.user.id === user.id) continue;

              await lazyRequest.handleMemberRemove(session, req.guild, user.id);
            }
          }

          await dispatcher.dispatchEventInGuild(req.guild, 'GUILD_MEMBER_REMOVE', {
            type: 'leave',
            user: globalUtils.miniUserObject(user),
            guild_id: String(req.params.guildid),
          });

          return res.status(204).send();
        }
      } catch (error) {
        logText(error, 'error');

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json({
        code: 500,
        message: 'Internal Server Error',
      });
    }
  },
);

router.patch(
  '/:guildid/settings',
  guildMiddleware,
  rateLimitMiddleware(
    global.config.ratelimit_config.updateUsersGuildSettings.maxPerTimeFrame,
    global.config.ratelimit_config.updateUsersGuildSettings.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.updateUsersGuildSettings.maxPerTimeFrame,
    global.config.ratelimit_config.updateUsersGuildSettings.timeFrame,
    0.5,
  ),
  async (req: any, res: Response) => {
    try {
      const user = req.account;
      const guild = req.guild;

      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        select: { guild_settings: true }
      });

      let allSettings = (userData?.guild_settings as any[]) || [];
      let guildSettings = allSettings.find((x) => x.guild_id === guild.id);

      if (!guildSettings) {
        guildSettings = {
          guild_id: guild.id,
          muted: false,
          message_notifications: 2,
          suppress_everyone: false,
          mobile_push: false,
          channel_overrides: [],
        };
        allSettings.push(guildSettings);
      }

      const fields = ['muted', 'suppress_everyone', 'message_notifications', 'mobile_push'];

      fields.forEach(field => {
        if (req.body[field] !== undefined) guildSettings[field] = req.body[field];
      });

      if (req.body.channel_overrides) {
        if (!Array.isArray(guildSettings.channel_overrides)) guildSettings.channel_overrides = [];

        for (const [id, override] of Object.entries(req.body.channel_overrides as any) as any) {
          let channelObj = guildSettings.channel_overrides.find((x: any) => x.channel_id === id);

          if (!channelObj) {
            channelObj = { channel_id: id };
            guildSettings.channel_overrides.push(channelObj);
          }

          if (override.muted !== undefined) channelObj.muted = override.muted;
          if (override.message_notifications !== undefined) 
            channelObj.message_notifications = override.message_notifications;
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          guild_settings: allSettings
        }
      });

      await dispatcher.dispatchEventTo(user.id, 'USER_GUILD_SETTINGS_UPDATE', guildSettings);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.get('/premium/subscriptions', async (req: any, res: Response) => {
  if (global.config.infinite_boosts) {
    return res.status(200).json([]);
  }

  const subscriptions = await prisma.guildSubscription.findMany({
      where: { user_id: req.account.id },
      select: {
        guild_id: true,
        user_id: true,
        subscription_id: true,
        ended: true,
      }
  });

  return res.status(200).json(subscriptions.map(sub => ({
      guild_id: sub.guild_id,
      user_id: sub.user_id,
      id: sub.subscription_id,
      ended: sub.ended,
    })));
});

router.get('/premium/subscriptions/cooldown', async (_req: Request, res: Response) => {
  return res.status(200).json({
    ends_at: null,
  });
});

export default router;
