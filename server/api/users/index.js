import { Router } from 'express';

import dispatcher from '../../helpers/dispatcher.js';
import errors from '../../helpers/consts/errors.js';
import globalUtils from '../../helpers/utils/globalutils.js';
import { logText } from '../../helpers/utils/logger.ts';
import { rateLimitMiddleware, userMiddleware } from '../../helpers/middlewares.js';
import quickcache from '../../helpers/quickcache.js';
import Watchdog from '../../helpers/watchdog.js';
import me from './me/index.js';

const router = Router();

router.param('userid', async (req, res, next, userid) => {
  if (userid === '@me') {
    userid = req.account.id;
  }
  req.user = await global.database.getAccountByUserId(userid);

  next();
});

router.use('/@me', me);

router.get('/:userid', userMiddleware, quickcache.cacheFor(60 * 5), async (req, res) => {
  return res.status(200).json(globalUtils.miniUserObject(req.user));
});

//new dm system / group dm system
router.post(
  '/:userid/channels',
  rateLimitMiddleware(
    global.config.ratelimit_config.createPrivateChannel.maxPerTimeFrame,
    global.config.ratelimit_config.createPrivateChannel.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.createPrivateChannel.maxPerTimeFrame,
    global.config.ratelimit_config.createPrivateChannel.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      let recipients = req.body.recipients;
      const account = req.account;

      if (req.body.recipient_id) {
        recipients = [req.body.recipient_id];
      } else if (req.body.recipient) {
        recipients = [req.body.recipient];
      }

      if (!recipients) {
        return res.status(400).json({
          code: 400,
          message: 'Valid recipients are required.',
        });
      }

      if (recipients.length > 9) {
        return res.status(400).json({
          code: 400,
          message: 'Too many recipients. (max: 10)',
        });
      }

      let validRecipientIDs = [];
      const map = {};

      validRecipientIDs.push(account.id);

      for (var recipient of recipients) {
        if (validRecipientIDs.includes(recipient)) continue;

        const userObject = await global.database.getAccountByUserId(recipient);

        if (!userObject) continue;

        map[recipient] = userObject;

        validRecipientIDs.push(recipient);
      }

      let channel = null;
      let type = validRecipientIDs.length > 2 ? 3 : 1;

      if (type == 1)
        channel = await global.database.findPrivateChannel(
          account.id,
          validRecipientIDs[validRecipientIDs[0] == account.id ? 1 : 0],
        );

      if (type === 3) {
        for (var validRecipientId of validRecipientIDs) {
          if (validRecipientId === account.id) {
            continue;
          }

          const userObject = map[validRecipientId];

          if (!globalUtils.areWeFriends(account, userObject)) {
            validRecipientIDs = validRecipientIDs.filter((x) => x !== validRecipientId);
            continue;
          }
        }

        type = validRecipientIDs.length > 2 ? 3 : 1;
      }

      channel ??= await global.database.createChannel(
        null,
        null,
        type,
        0,
        validRecipientIDs,
        account.id,
      );

      const pChannel = globalUtils.personalizeChannelObject(req, channel);

      if (type == 3) await globalUtils.pingPrivateChannel(channel);
      else await dispatcher.dispatchEventTo(account, 'CHANNEL_CREATE', pChannel);

      return res.status(200).json(pChannel);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.get('/:userid/profile', userMiddleware, quickcache.cacheFor(60 * 5), async (req, res) => {
  try {
    const account = req.account;
    const user = req.user;
    const ret = {};

    const guilds = await global.database.getUsersGuilds(user.id);

    const sharedGuilds = guilds.filter(
      (guild) =>
        guild.members != null &&
        guild.members.length > 0 &&
        guild.members.some((member) => member.id === account.id),
    );
    const mutualGuilds = [];

    for (var sharedGuild of sharedGuilds) {
      const id = sharedGuild.id;
      const member = sharedGuild.members.find((y) => y.id == user.id);

      if (!member) continue;

      const nick = member.nick;

      mutualGuilds.push({
        id: id,
        nick: nick,
        roles: member.roles,
      });
    }

    ret.mutual_guilds = req.query.with_mutual_guilds === 'false' ? undefined : mutualGuilds;

    const sharedFriends = [];

    if (!user.bot) {
      const ourFriends = account.relationships;
      const theirFriends = user.relationships;

      if (ourFriends.length > 0 && theirFriends.length > 0) {
        const theirFriendsSet = new Set(
          theirFriends.map((friend) => friend.user.id && friend.type == 1),
        );

        for (const ourFriend of ourFriends) {
          if (theirFriendsSet.has(ourFriend.user.id) && ourFriend.type == 1) {
            sharedFriends.push(globalUtils.miniUserObject(ourFriend.user));
          }
        }
      }
    }

    ret.mutual_friends = sharedFriends;

    let connectedAccounts = await global.database.getConnectedAccounts(user.id);

    connectedAccounts = connectedAccounts.filter((x) => x.visibility == 1);

    connectedAccounts.forEach(
      (x) => (x = globalUtils.sanitizeObject(x, ['integrations', 'revoked', 'visibility'])),
    );

    ret.user = globalUtils.miniUserObject(user);
    ret.connected_accounts = connectedAccounts;
    ret.premium_since = new Date().toISOString();

    // v9 responses
    ret.premium_type = 2;
    ret.user_profile = {
      accent_color: 0,
      banner: '',
      bio: '',
      emoji: null,
      popout_animation_particle_type: null,
      profile_effect: null,
      pronouns: '',
      theme_colors: [],
    };

    return res.status(200).json(ret);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

//Never share this cache because it's mutuals and whatnot, different for each requester
//We're gonna remove the userMiddleware from this since it needs to work on users we're friends with without any guilds in common
router.get('/:userid/relationships', quickcache.cacheFor(60 * 5), async (req, res) => {
  try {
    const account = req.account;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
    }

    if (req.params.userid === '456226577798135808') {
      return res.status(200).json([]);
    } //Return [] for the deleted user account

    const user = req.user;

    if (!user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (user.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
    } // I think this is more professional

    const ourFriends = account.relationships;
    const theirFriends = user.relationships;

    const sharedFriends = [];

    for (var ourFriend of ourFriends) {
      for (var theirFriend of theirFriends) {
        if (
          theirFriend.user.id === ourFriend.user.id &&
          theirFriend.type === 1 &&
          ourFriend.type === 1
        ) {
          sharedFriends.push(globalUtils.miniUserObject(theirFriend.user));
        }
      }
    }

    return res.status(200).json(sharedFriends);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
