import { Router } from 'express';
import { logText } from '../helpers/logger';
import globalUtils from '../helpers/globalutils';
import dispatcher from '../helpers/dispatcher';
import { rateLimitMiddleware, guildPermissionsMiddleware } from '../helpers/middlewares';
const router = Router({ mergeParams: true });
import quickcache from '../helpers/quickcache';
import Watchdog from '../helpers/watchdog';
import errors from '../helpers/errors';
import lazyRequest from '../helpers/lazyRequest';

router.param('memberid', async (req, res, next, memberid) => {
  req.member = req.guild.members.find((x) => x.id === memberid);

  next();
});

router.get(
  '/',
  guildPermissionsMiddleware('BAN_MEMBERS'),
  quickcache.cacheFor(60 * 5, true),
  async (req, res) => {
    try {
      const bans = await global.database.getGuildBans(req.params.guildid);

      return res.status(200).json(bans);
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
  async (req, res) => {
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
        const attempt = await global.database.leaveGuild(member.id, req.params.guildid);

        if (!attempt) {
          return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }
      }

      const tryBan = await global.database.banMember(req.params.guildid, member.id);

      if (!tryBan) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      if (userInGuild) {
        await dispatcher.dispatchEventTo(member.id, 'GUILD_DELETE', {
          id: req.params.guildid,
        });

        let activeSessions = dispatcher.getAllActiveSessions();

        for (let session of activeSessions) {
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
          let messages = await global.database.getUsersMessagesInGuild(
            req.params.guildid,
            member.user.id,
          );

          const deletemessagedaysDate = new Date();

          deletemessagedaysDate.setDate(deletemessagedaysDate.getDate() - deleteMessageDays);

          messages = messages.filter((message) => {
            const messageTimestamp = new Date(message.timestamp);

            return messageTimestamp >= deletemessagedaysDate;
          });

          if (messages.length > 0) {
            for (var message of messages) {
              let tryDelete = await global.database.deleteMessage(message.id);

              if (tryDelete) {
                await dispatcher.dispatchEventInChannel(
                  req.guild,
                  message.channel_id,
                  'MESSAGE_DELETE',
                  {
                    id: message.id,
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
  async (req, res) => {
    try {
      const sender = req.account;

      if (sender.id == req.params.memberid) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      const bans = await global.database.getGuildBans(req.params.guildid);

      const ban = bans.find((x) => x.user.id == req.params.memberid);

      if (!ban) {
        return res.status(404).json(errors.response_404.UNKNOWN_USER);
      } //figure out the correct response here

      const attempt = await global.database.unbanMember(req.params.guildid, req.params.memberid);

      if (!attempt) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      await dispatcher.dispatchEventTo(sender.id, 'GUILD_BAN_REMOVE', {
        guild_id: req.params.guildid,
        user: globalUtils.miniUserObject(ban.user),
        roles: [],
      });

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

export default router;
