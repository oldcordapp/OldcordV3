import { Router } from 'express';

import dispatcher from '../helpers/dispatcher.ts';
import globalUtils from '../helpers/globalutils.ts';
import { logText } from '../helpers/logger.ts';
import { guildPermissionsMiddleware, rateLimitMiddleware } from '../helpers/middlewares.ts';
const router = Router({ mergeParams: true });
import errors from '../helpers/errors.ts';
import lazyRequest from '../helpers/lazyRequest.ts';
import quickcache from '../helpers/quickcache.ts';
import Watchdog from '../helpers/watchdog.ts';
import type { Response } from "express";
import { prisma } from '../prisma.ts';

router.param('memberid', async (req: any, _res: Response, next, memberid) => {
  req.member = req.guild.members.find((x) => x.id === memberid);

  next();
});

router.get(
  '/',
  guildPermissionsMiddleware('BAN_MEMBERS'),
  quickcache.cacheFor(60 * 5, true),
  async (req: any, res: Response) => {
    try {
      const bans = await prisma.ban.findMany({
        where: {
          guild_id: req.params.guildid,
        },
        include: {
          user: true,
        },
      });

      const formattedBans = bans.map((ban) => ({
        user: {
          id: ban.user.id,
          username: ban.user.username,
          discriminator: ban.user.discriminator,
          avatar: ban.user.avatar,
          bot: ban.user.bot,
        }
      }));

      return res.status(200).json(formattedBans);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.put(
  '/:memberid',
  guildPermissionsMiddleware('BAN_MEMBERS'),
  rateLimitMiddleware(
    global.config.ratelimit_config.bans.maxPerTimeFrame,
    global.config.ratelimit_config.bans.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.bans.maxPerTimeFrame,
    global.config.ratelimit_config.bans.timeFrame,
    0.75,
  ),
  async (req: any, res: Response) => {
    try {
      const sender = req.account;

      if (sender.id == req.params.memberid) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      let member = req.member;

      const userInGuild = member != null;

      if (!userInGuild) {
        member = {
          id: req.params.memberid,
          user: {
            id: req.params.memberid,
          },
        };
      }

      if (userInGuild) {
        await prisma.member.delete({
          where: {
            guild_id_user_id: {
              user_id: member.id,
              guild_id: req.params.guildid
            }
          }
        });
      }

      await prisma.ban.create({
        data: {
          guild_id: req.params.guildid,
          user_id: member.id
        }
      });

      if (userInGuild) {
        await dispatcher.dispatchEventTo(member.id, 'GUILD_DELETE', {
          id: req.params.guildid,
        });

        const activeSessions = dispatcher.getAllActiveSessions();

        for (const session of activeSessions) {
          if (session.subscriptions && session.subscriptions[req.guild.id]) {
            if (session.user.id === member.user.id) continue;

            await lazyRequest.handleMemberRemove(session, req.guild, member.user.id);
          }
        }

        await dispatcher.dispatchEventInGuild(req.guild, 'GUILD_MEMBER_REMOVE', {
          type: 'ban',
          moderator: globalUtils.miniUserObject(sender),
          user: globalUtils.miniUserObject(member.user),
          guild_id: String(req.params.guildid),
        });
      }

      if (req.query['delete-message-days']) {
        let deleteMessageDays = parseInt(req.query['delete-message-days']);

        if (deleteMessageDays > 7) {
          deleteMessageDays = 7;
        }

        if (deleteMessageDays > 0) {
          const cutoffDate = new Date();

          cutoffDate.setDate(cutoffDate.getDate() - deleteMessageDays);

          let messages = await prisma.message.findMany({
            where: {
              guild_id: req.params.guildid as string,
              author_id: member.user.id,
              timestamp: {
                gte: cutoffDate.toString()
              }
            }
          });

          if (messages.length > 0) {
            for (var message of messages) {
              const deleteResult = await prisma.message.delete({
                where: { message_id: message.message_id }
              }).catch(() => null);

              if (deleteResult) {
                await dispatcher.dispatchEventInChannel(
                  req.guild,
                  message.channel_id!,
                  'MESSAGE_DELETE',
                  {
                    id: message.message_id,
                    guild_id: req.params.guildid,
                    channel_id: message.channel_id,
                  },
                );
              }
            }
          }
        }
      }

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.delete(
  '/:memberid',
  guildPermissionsMiddleware('BAN_MEMBERS'),
  rateLimitMiddleware(
    global.config.ratelimit_config.bans.maxPerTimeFrame,
    global.config.ratelimit_config.bans.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.bans.maxPerTimeFrame,
    global.config.ratelimit_config.bans.timeFrame,
    0.75,
  ),
  async (req: any, res: Response) => {
    try {
      const sender = req.account;

      if (sender.id == req.params.memberid) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      const bans = await prisma.ban.findMany({
        where: {
          guild_id: req.params.guildid as string
        },
        include: {
          user: true
        }
      });

      const ban = bans.find((x) => x.user.id == req.params.memberid);

      if (!ban) {
        return res.status(404).json(errors.response_404.UNKNOWN_BAN);
      } //figure out the correct response here

      const deletedBan = await prisma.ban.delete({
        where: {
          guild_id_user_id: {
            guild_id: req.params.guildid as string,
            user_id: req.params.memberid as string,
          },
        },
        include: {
          user: true
        }
      });

      await dispatcher.dispatchEventTo(sender.id, 'GUILD_BAN_REMOVE', {
        guild_id: req.params.guildid,
        user: globalUtils.miniUserObject(deletedBan.user),
        roles: [],
      });

      return res.status(204).send();
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json(errors.response_404.UNKNOWN_BAN); 
      }
  
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

export default router;
