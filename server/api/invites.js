import { Router } from 'express';

import dispatcher from '../helpers/dispatcher.js';
import errors from '../helpers/errors.js';
import globalUtils from '../helpers/globalutils.js';
import lazyRequest from '../helpers/lazyRequest.js';
import { logText } from '../helpers/logger.ts';
import { instanceMiddleware, rateLimitMiddleware } from '../helpers/middlewares.js';
import quickcache from '../helpers/quickcache.js';
import Watchdog from '../helpers/watchdog.js';
const router = Router({ mergeParams: true });

router.param('code', async (req, res, next, memberid) => {
  req.invite = await global.database.getInvite(req.params.code);

  if (!req.guild && req.invite && req.invite.channel.guild_id) {
    req.guild = await global.database.getGuildById(req.invite.channel.guild_id);
  }

  next();
});

//We wont cache stuff like this for everyone because if theyre banned we want the invite to be invalid only for them.
router.get('/:code', quickcache.cacheFor(60 * 30), async (req, res) => {
  try {
    const invite = req.invite;

    if (!invite) {
      return res.status(404).json(errors.response_404.UNKNOWN_INVITE);
    }

    return res.status(200).json(invite);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete(
  '/:code',
  rateLimitMiddleware(
    global.config.ratelimit_config.deleteInvite.maxPerTimeFrame,
    global.config.ratelimit_config.deleteInvite.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.deleteInvite.maxPerTimeFrame,
    global.config.ratelimit_config.deleteInvite.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      const sender = req.account;
      const invite = req.invite;

      if (invite == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_INVITE);
      }

      const channel = req.guild.channels.find((x) => x.id === invite.channel.id);

      if (channel == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      const guild = req.guild;

      if (guild == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
      }

      const hasPermission = global.permissions.hasChannelPermissionTo(
        channel,
        guild,
        sender.id,
        'MANAGE_CHANNELS',
      );

      if (!hasPermission) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      const tryDelete = await global.database.deleteInvite(req.params.code);

      if (!tryDelete) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post(
  '/:code',
  instanceMiddleware('NO_INVITE_USE'),
  rateLimitMiddleware(
    global.config.ratelimit_config.useInvite.maxPerTimeFrame,
    global.config.ratelimit_config.useInvite.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.useInvite.maxPerTimeFrame,
    global.config.ratelimit_config.useInvite.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      const sender = req.account;

      if (sender.bot) {
        return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
      }

      const invite = req.invite;

      if (invite == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_INVITE);
      }

      let guild = req.guild;

      if (guild == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
      }

      const usersGuild = await global.database.getUsersGuilds(sender.id);

      if (usersGuild.length >= global.config.limits['guilds_per_account'].max) {
        return res.status(404).json({
          code: 404,
          message: `Maximum number of guilds exceeded for this instance (${global.config.limits['guilds_per_account'].max})`,
        });
      }

      const joinAttempt = await global.database.useInvite(req.invite, req.guild, sender.id);

      if (!joinAttempt) {
        return res.status(404).json(errors.response_404.UNKNOWN_INVITE);
      }

      guild = await global.database.getGuildById(guild.id); //update to keep in sync?

      await dispatcher.dispatchEventTo(sender.id, 'GUILD_CREATE', guild);

      await dispatcher.dispatchEventInGuild(guild, 'GUILD_MEMBER_ADD', {
        roles: [],
        user: globalUtils.miniUserObject(sender),
        guild_id: invite.guild.id,
        joined_at: new Date().toISOString(),
        deaf: false,
        mute: false,
        nick: null,
      });

      const activeSessions = dispatcher.getAllActiveSessions();

      for (const session of activeSessions) {
        if (session.subscriptions && session.subscriptions[guild.id]) {
          //if (session.user.id === sender.id) continue;

          await lazyRequest.handleMemberAdd(session, guild, {
            roles: [],
            user: globalUtils.miniUserObject(sender),
            joined_at: new Date().toISOString(),
            deaf: false,
            mute: false,
            nick: null,
          });
        }
      }

      await dispatcher.dispatchEventInGuild(guild, 'PRESENCE_UPDATE', {
        ...globalUtils.getUserPresence({
          user: globalUtils.miniUserObject(sender),
        }),
        roles: [],
        guild_id: invite.guild.id,
      });

      if (guild.system_channel_id != null) {
        const join_msg = await global.database.createSystemMessage(
          guild.id,
          guild.system_channel_id,
          7,
          [sender],
        );

        await dispatcher.dispatchEventInChannel(
          guild,
          guild.system_channel_id,
          'MESSAGE_CREATE',
          function () {
            return globalUtils.personalizeMessageObject(
              join_msg,
              guild,
              this.socket.client_build_date,
            );
          },
        );
      }

      return res.status(200).send(invite);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

export default router;
