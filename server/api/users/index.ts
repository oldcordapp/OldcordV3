import { Router } from 'express';

import dispatcher from '../../helpers/dispatcher.ts';
import errors from '../../helpers/errors.ts';
import globalUtils from '../../helpers/globalutils.ts';
import { logText } from '../../helpers/logger.ts';
import { rateLimitMiddleware, userMiddleware } from '../../helpers/middlewares.ts';
import quickcache from '../../helpers/quickcache.ts';
import Watchdog from '../../helpers/watchdog.ts';
import me from './me/index.js';
import type { NextFunction, Response } from "express";
import { prisma } from '../../prisma.ts';

const router = Router();

router.param('userid', async (req: any, _res: Response, next: NextFunction, userid: string) => {
  if (userid === '@me') {
    userid = req.account.id;
  }

  req.user = await prisma.user.findUnique({
    where: {
      id: userid,
    },
    include: {
      staff: true,
    }
  });

  next();
});

router.use('/@me', me);

router.get('/:userid', userMiddleware, quickcache.cacheFor(60 * 5), async (req: any, res: Response) => {
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
  async (req: any, res: Response) => {
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

      let validRecipientIDs: string[] = [];
      const map = {};

      validRecipientIDs.push(account.id);

      for (var recipient of recipients) {
        if (validRecipientIDs.includes(recipient)) continue;

        const userObject = await prisma.user.findUnique({
          where: {
            id: recipient,
          },
          select: {
            id: true,
            username: true,
            discriminator: true,
            avatar: true,
            bot: true,
            staff: true,
            settings: true,
            guild_settings: true
          }
        });

        if (!userObject) continue;

        map[recipient] = userObject;

        validRecipientIDs.push(recipient);
      }

      let channel: any = null;
      let type = validRecipientIDs.length > 2 ? 3 : 1;
      
      if (type == 1) {
        const otherUserId = validRecipientIDs.find(id => id !== account.id);

        if (otherUserId) {
          const dmRecord = await prisma.dmChannel.findFirst({
            where: {
              OR: [
                { user1: account.id, user2: otherUserId },
                { user1: otherUserId, user2: account.id },
              ],
            },
          });

          if (dmRecord) {
            channel = await prisma.channel.findUnique({
              where: { id: dmRecord.id },
              include: {
                recipients: true,
              },
            });
          }
        }
      }

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

      channel ??= await globalUtils.createChannel({
        guildId: null,
        name: null,
        type: type,
        position: 0,
        recipientIds: validRecipientIDs,
        ownerId: account.id
      });

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

router.get('/:userid/profile', userMiddleware, quickcache.cacheFor(60 * 5), async (req: any, res: Response) => {
  try {
    const account = req.account;
    const user = req.user;
    const ret: any = {};

    const guilds = await prisma.guild.findMany({
      where: {
        members: {
          some: {
            user_id: user.id
          }
        }
      },
      include: {
        members: true
      }
    });

    const sharedGuilds = guilds.filter(
      (guild) =>
        guild.members != null &&
        guild.members.length > 0 &&
        guild.members.some((member) => member.user_id === account.id),
    );
    const mutualGuilds: any = [];

    for (var sharedGuild of sharedGuilds) {
      const id = sharedGuild.id;
      const member = sharedGuild.members.find((y) => y.user_id == user.id);

      if (!member) continue;

      const nick = member.nick;

      mutualGuilds.push({
        id: id,
        nick: nick,
        roles: member.roles,
      });
    }

    ret.mutual_guilds = req.query.with_mutual_guilds === 'false' ? undefined : mutualGuilds;

    const sharedFriends: any = [];

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

    let connectedAccounts = await prisma.connectedAccount.findMany({
      where: {
        user_id: user.id
      }
    });

    connectedAccounts = connectedAccounts.filter((x) => x.visibility == true);

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
router.get('/:userid/relationships', quickcache.cacheFor(60 * 5), async (req: any, res: Response) => {
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

    const sharedFriends: any = [];

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
