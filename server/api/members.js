import { Router } from 'express';

import dispatcher from '../helpers/dispatcher.js';
import errors from '../helpers/errors.js';
import globalUtils from '../helpers/globalutils.js';
import lazyRequest from '../helpers/lazyRequest.js';
import { logText } from '../helpers/logger.js';
import { guildPermissionsMiddleware, rateLimitMiddleware } from '../helpers/middlewares.js';
import quickcache from '../helpers/quickcache.js';
import Watchdog from '../helpers/watchdog.js';

const router = Router({ mergeParams: true });

router.param('memberid', async (req, res, next, memberid) => {
  req.member = req.guild.members.find((x) => x.id === memberid);

  next();
});

router.get('/:memberid', quickcache.cacheFor(60 * 30), async (req, res) => {
  return res.status(200).json(req.member);
});

router.delete(
  '/:memberid',
  guildPermissionsMiddleware('KICK_MEMBERS'),
  rateLimitMiddleware(
    global.config.ratelimit_config.kickMember.maxPerTimeFrame,
    global.config.ratelimit_config.kickMember.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.kickMember.maxPerTimeFrame,
    global.config.ratelimit_config.kickMember.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      const sender = req.account;
      const member = req.member;

      if (member == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_MEMBER);
      }

      const attempt = await global.database.leaveGuild(member.id, req.params.guildid);

      if (!attempt) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

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
        type: 'kick',
        moderator: globalUtils.miniUserObject(sender),
        user: globalUtils.miniUserObject(member.user),
        guild_id: String(req.params.guildid),
      });

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

async function updateMember(member, guild, roles, nick) {
  let rolesChanged = false;
  let nickChanged = false;
  const guild_id = guild.id;

  if (roles) {
    const newRoles = roles.map((r) => (typeof r === 'object' ? r.id : r));

    const currentRoles = [...member.roles].sort();
    const incomingRoles = [...newRoles].sort();

    if (JSON.stringify(currentRoles) !== JSON.stringify(incomingRoles)) {
      rolesChanged = true;

      if (!(await global.database.setRoles(guild, newRoles, member.id))) {
        return errors.response_500.INTERNAL_SERVER_ERROR;
      }

      member.roles = newRoles;
    }
  }

  if (nick !== undefined && nick !== member.nick) {
    if (nick === '' || nick === member.user.username) nick = null;
    if (
      nick &&
      (nick.length < global.config.limits['nickname'].min ||
        nick.length >= global.config.limits['nickname'].max)
    ) {
      return errors.response_400.INVALID_NICKNAME_LENGTH;
    }

    nickChanged = true;

    if (!(await global.database.updateGuildMemberNick(guild_id, member.user.id, nick))) {
      return errors.response_500.INTERNAL_SERVER_ERROR;
    }

    member.nick = nick;
  }

  if (rolesChanged || nickChanged) {
    const updatePayload = {
      roles: member.roles,
      user: globalUtils.miniUserObject(member.user),
      guild_id: guild_id,
      nick: member.nick,
    };

    await dispatcher.dispatchEventInGuild(guild, 'GUILD_MEMBER_UPDATE', updatePayload);
    await lazyRequest.syncMemberList(guild, member.id);
  }

  return {
    roles: member.roles,
    user: globalUtils.miniUserObject(member.user),
    guild_id: guild_id,
    nick: member.nick,
  };
}

router.patch(
  '/:memberid',
  guildPermissionsMiddleware('MANAGE_ROLES'),
  guildPermissionsMiddleware('MANAGE_NICKNAMES'),
  rateLimitMiddleware(
    global.config.ratelimit_config.updateMember.maxPerTimeFrame,
    global.config.ratelimit_config.updateMember.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.updateMember.maxPerTimeFrame,
    global.config.ratelimit_config.updateMember.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      if (req.member == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_MEMBER);
      }

      const newMember = await updateMember(req.member, req.guild, req.body.roles, req.body.nick);

      if (newMember.code) {
        return res.status(newMember.code).json(newMember);
      }

      return res.status(200).json({
        user: globalUtils.miniUserObject(newMember.user),
        nick: newMember.nick,
        guild_id: req.guild.id,
        roles: newMember.roles,
        joined_at: newMember.joined_at || new Date().toISOString(),
        deaf: false,
        mute: false,
      });
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.patch(
  '/@me/nick',
  guildPermissionsMiddleware('CHANGE_NICKNAME'),
  rateLimitMiddleware(
    global.config.ratelimit_config.updateNickname.maxPerTimeFrame,
    global.config.ratelimit_config.updateNickname.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.updateNickname.maxPerTimeFrame,
    global.config.ratelimit_config.updateNickname.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      const account = req.account;
      const member = req.guild.members.find((y) => y.id == account.id);

      if (!member) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      const newMember = await updateMember(member, req.guild, null, req.body.nick);

      if (newMember.code) {
        return res.status(newMember.code).json(newMember);
      }

      return res.status(200).json({
        nick: req.body.nick,
      });
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

export default router;
