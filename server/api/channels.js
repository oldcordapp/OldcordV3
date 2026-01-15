import { Router } from 'express';

import dispatcher from '../helpers/dispatcher.js';
import errors from '../helpers/errors.js';
import globalUtils from '../helpers/globalutils.js';
import { logText } from '../helpers/logger.js';
import {
  channelMiddleware,
  channelPermissionsMiddleware,
  guildPermissionsMiddleware,
  instanceMiddleware,
  rateLimitMiddleware,
} from '../helpers/middlewares.js';
import quickcache from '../helpers/quickcache.js';
import Watchdog from '../helpers/watchdog.js';
import messages from './messages.js';
import pins from './pins.js';

const router = Router({ mergeParams: true });
const config = globalUtils.config;

router.param('channelid', async (req, res, next, channelid) => {
  let guild = req.guild;

  if (!guild) {
    //fallback for dm channels & group dms & legacy clients

    req.channel = await global.database.getChannelById(channelid);

    //req.guild = await global.database.getGuildById(channelid);

    /*
        if (req.guild === null) {
            req.channel = await global.database.getChannelById(channelid); 
        } else {
            let found_channel = req.guild.channels.filter(y => y.type === 0 && y.id === channelid && global.permissions.hasChannelPermissionTo(y, req.guild, req.account.id, "READ_MESSAGES"));

            if (found_channel) {
                req.channel = found_channel;
                return next();
            }

            let text_channels = req.guild.channels.filter(x => x.type === 0 && global.permissions.hasChannelPermissionTo(x, req.guild, req.account.id, "READ_MESSAGES"));

            req.channel = text_channels.length > 0 ? text_channels[0] : null;
        } //So this is a bug with older clients where it wants the first text channel using the guild id as the channel id
         */

    return next();
  }

  req.member = req.guild.members.find((y) => y.id === req.account.id);

  const channel = req.guild.channels.find((y) => y.id === channelid);

  if (channel == null) {
    req.channel = null;

    return next(); //no channel let's wrap it up - try not to use getChannelById when not necessary
  }

  if (req.channel_types_are_ints) {
    channel.type = parseInt(channel.type);
  } else channel.type = parseInt(channel.type) == 2 ? 'voice' : 'text';

  req.channel = channel;

  if (!req.guild && req.channel.guild_id != null) {
    req.guild = await global.database.getGuildById(req.channel.guild_id);
  } //just in case there is a guild and it's not resolved yet - for future use

  next();
});

router.param('recipientid', async (req, res, next, recipientid) => {
  req.recipient = await global.database.getAccountByUserId(recipientid);

  next();
});

router.get(
  '/:channelid',
  channelMiddleware,
  channelPermissionsMiddleware('READ_MESSAGES'),
  quickcache.cacheFor(60 * 5, true),
  async (req, res) => {
    return res
      .status(200)
      .json(globalUtils.personalizeChannelObject(req, req.channel, req.account)); //req.account is a dirty hack ok
  },
);

router.post(
  '/:channelid/typing',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  channelPermissionsMiddleware('SEND_MESSAGES'),
  rateLimitMiddleware(
    global.config.ratelimit_config.typing.maxPerTimeFrame,
    global.config.ratelimit_config.typing.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.typing.maxPerTimeFrame,
    global.config.ratelimit_config.typing.timeFrame,
    0.4,
  ),
  async (req, res) => {
    try {
      var payload = {
        channel_id: req.params.channelid,
        guild_id: req.channel.guild_id,
        user_id: req.account.id,
        timestamp: new Date().toISOString(),
        member: req.member,
      };

      if (!req.guild) {
        if (!req.channel.recipients) {
          return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
        }

        payload.member = globalUtils.miniUserObject(req.account);

        await dispatcher.dispatchEventInPrivateChannel(req.channel, 'TYPING_START', payload);
      } else {
        await dispatcher.dispatchEventInChannel(req.guild, req.channel.id, 'TYPING_START', payload);
      }

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.patch(
  '/:channelid',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  channelPermissionsMiddleware('MANAGE_CHANNELS'),
  rateLimitMiddleware(
    global.config.ratelimit_config.updateChannel.maxPerTimeFrame,
    global.config.ratelimit_config.updateChannel.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.updateChannel.maxPerTimeFrame,
    global.config.ratelimit_config.updateChannel.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      let channel = req.channel;

      if (!channel.guild_id && channel.type !== 3) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL); //Can only modify guild channels lol -- okay update, they can modify group channels too
      }

      if (req.body.icon) {
        channel.icon = req.body.icon;
      }

      if (req.body.icon === null) {
        channel.icon = null;
      }

      if (
        req.body.name &&
        (req.body.name.length < global.config.limits['channel_name'].min ||
          req.body.name.length >= global.config.limits['channel_name'].max)
      ) {
        return res.status(400).json({
          code: 400,
          name: `Must be between ${global.config.limits['channel_name'].min} and ${global.config.limits['channel_name'].max} characters.`,
        });
      }

      if (req.body.name) {
        req.body.name = req.body.name.replace(/ /g, '-');
      } //For when you just update group icons

      channel.name = req.body.name ?? channel.name;

      if (channel.type !== 3 && channel.type !== 1) {
        channel.position = req.body.position ?? channel.position;

        if (channel.type === 0) {
          channel.topic = req.body.topic ?? channel.topic;
          channel.nsfw = req.body.nsfw ?? channel.nsfw;

          let rateLimit = req.body.rate_limit_per_user ?? channel.rate_limit_per_user;

          channel.rate_limit_per_user = Math.min(Math.max(rateLimit, 0), 120);
        }

        if (channel.type === 2) {
          let userLimit = req.body.user_limit ?? channel.user_limit;
          channel.user_limit = Math.min(Math.max(userLimit, 0), 99);

          let bitrate = req.body.bitrate ?? channel.bitrate;
          channel.bitrate = Math.min(Math.max(bitrate, 8000), 96000);
        }
      } //do this for only guild channels

      const outcome = await global.database.updateChannel(channel.id, channel);

      if (!outcome) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      if (channel.type === 3) {
        channel = outcome;

        if (!channel) {
          return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }

        await dispatcher.dispatchEventInPrivateChannel(channel, 'CHANNEL_UPDATE', function () {
          return globalUtils.personalizeChannelObject(this.socket, channel);
        });

        return res.status(200).json(channel);
      }

      if (!req.channel_types_are_ints) {
        channel.type = channel.type == 2 ? 'voice' : 'text';
      }

      await dispatcher.dispatchEventToAllPerms(
        channel.guild_id,
        channel.id,
        'READ_MESSAGES',
        'CHANNEL_UPDATE',
        channel,
      );

      return res.status(200).json(channel);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.get(
  '/:channelid/invites',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  channelPermissionsMiddleware('MANAGE_CHANNELS'),
  quickcache.cacheFor(60 * 5, true),
  async (req, res) => {
    try {
      const invites = await global.database.getChannelInvites(req.params.channelid);

      return res.status(200).json(invites);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.get(
  '/:channelid/call',
  channelMiddleware,
  quickcache.cacheFor(60 * 5, false),
  async (req, res) => {
    try {
      if (!req.channel.recipients) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      return res.status(200).json({
        ringable: true,
      });
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
); //to-do figure out why this never gets to /ring

router.post(
  '/:channelid/call/ring',
  channelMiddleware,
  quickcache.cacheFor(60 * 5, false),
  async (req, res) => {
    try {
      if (!req.channel.recipients) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      let call_msg = await global.database.createSystemMessage(null, req.channel.id, 3, [
        req.account,
      ]);

      await dispatcher.dispatchEventInPrivateChannel(req.channel, 'MESSAGE_CREATE', call_msg);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post(
  '/:channelid/invites',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  channelPermissionsMiddleware('CREATE_INSTANT_INVITE'),
  async (req, res) => {
    try {
      const sender = req.account;

      if (config.instance.flags.includes('NO_INVITE_CREATION')) {
        return res.status(400).json({
          code: 400,
          message: 'Creating invites is not allowed.',
        });
      } //make an error code

      let invites = await global.database.getChannelInvites(req.params.channelid);

      if (invites.length >= global.config.limits['invites_per_guild'].max) {
        return res.status(400).json({
          code: 400,
          message: `Maximum number of invites per guild exceeded (${global.config.limits['invites_per_guild'].max})`,
        });
      }

      let max_age = 0;
      let max_uses = 0;
      let temporary = false;
      let xkcdpass = false;
      let regenerate = false;

      if (req.body.max_age) {
        max_age = req.body.max_age;
      }

      if (req.body.max_uses) {
        max_uses = req.body.max_uses;
      }

      if (req.body.xkcdpass) {
        xkcdpass = req.body.xkcdpass;
      }

      if (req.body.temporary) {
        temporary = req.body.temporary;
      }

      if (req.body.regenerate) {
        regenerate = true;
      }

      const invite = await global.database.createInvite(
        req.guild,
        req.channel,
        sender,
        temporary,
        max_uses,
        max_age,
        xkcdpass,
        regenerate,
      );

      if (invite == null) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      return res.status(200).json(invite);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.use('/:channelid/messages', channelMiddleware, messages);

router.get(
  '/:channelid/webhooks',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  channelPermissionsMiddleware('MANAGE_WEBHOOKS'),
  quickcache.cacheFor(60 * 5, true),
  async (req, res) => {
    try {
      let guild = req.guild;

      if (!guild) {
        return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
      }

      let webhooks = guild.webhooks.filter((x) => x.channel_id === req.channel.id);

      return res.status(200).json(webhooks);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post(
  '/:channelid/webhooks',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  channelPermissionsMiddleware('MANAGE_WEBHOOKS'),
  async (req, res) => {
    try {
      let account = req.account;
      let guild = req.guild;

      if (!guild) {
        return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
      }

      if (!req.body.name) {
        req.body.name = 'Captain Hook';
      }

      let name = req.body.name;

      let webhook = await global.database.createWebhook(guild, account, req.channel.id, name, null);

      if (!webhook) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      return res.status(200).json(webhook);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.put(
  '/:channelid/permissions/:id',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  guildPermissionsMiddleware('MANAGE_ROLES'),
  async (req, res) => {
    try {
      let id = req.params.id;
      let type = req.body.type;

      if (!type) {
        type = 'role';
      }

      if (type != 'member' && type != 'role') {
        return res.status(404).json({
          code: 404,
          message: 'Unknown Type',
        });
      } //figure out this response

      let channel = req.channel;
      let channel_overwrites = await global.database.getChannelPermissionOverwrites(
        req.guild,
        channel.id,
      );
      let overwrites = channel_overwrites;
      let overwriteIndex = channel_overwrites.findIndex((x) => x.id == id);
      let allow = 0;
      let deny = 0;

      let permissionValuesObject = global.permissions.toObject();
      let permissionKeys = Object.keys(permissionValuesObject);
      let keys = permissionKeys.map((key) => permissionValuesObject[key]);

      for (let permValue of keys) {
        if (req.body.allow & permValue) {
          allow |= permValue;
        }

        if (req.body.deny & permValue) {
          deny |= permValue;
        }
      }

      if (overwriteIndex === -1) {
        overwrites.push({
          id: id,
          allow: allow,
          deny: deny,
          type: type,
        });
      } else {
        overwrites[overwriteIndex] = {
          id: id,
          allow: allow,
          deny: deny,
          type: type,
        };
      }

      if (type == 'member') {
        let member = req.guild.members.find((x) => x.id === id);

        if (member == null) {
          return res.status(404).json(errors.response_404.UNKNOWN_MEMBER);
        }
      } else if (type == 'role') {
        let role = req.guild.roles.find((x) => x.id === id);

        if (role == null) {
          return res.status(404).json(errors.response_404.UNKNOWN_ROLE);
        }
      }

      await global.database.updateChannelPermissionOverwrites(req.guild, channel.id, overwrites);

      channel = await global.database.getChannelById(channel.id); //do this better

      if (!req.channel_types_are_ints) {
        channel.type = channel.type == 2 ? 'voice' : 'text';
      }

      await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'CHANNEL_UPDATE', channel);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.delete(
  '/:channelid/permissions/:id',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  guildPermissionsMiddleware('MANAGE_ROLES'),
  async (req, res) => {
    try {
      let id = req.params.id;
      let channel_id = req.params.channelid;

      let channel = req.channel;
      let channel_overwrites = await global.database.getChannelPermissionOverwrites(
        req.guild,
        channel.id,
      );
      let overwriteIndex = channel_overwrites.findIndex((x) => x.id == id);

      if (!req.channel_types_are_ints) {
        channel.type = channel.type == 2 ? 'voice' : 'text';
      }

      if (overwriteIndex === -1) {
        await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'CHANNEL_UPDATE', channel);

        return res.status(204).send();
      }

      await global.database.deleteChannelPermissionOverwrite(
        req.guild,
        channel_id,
        channel_overwrites[overwriteIndex],
      );

      channel = await global.database.getChannelById(channel.id); //do this better

      if (!channel?.guild_id) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      if (!req.channel_types_are_ints) {
        channel.type = channel.type == 2 ? 'voice' : 'text';
      }

      await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'CHANNEL_UPDATE', channel);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

//TODO: should have its own rate limit
router.put(
  '/:channelid/recipients/:recipientid',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  rateLimitMiddleware(
    global.config.ratelimit_config.updateMember.maxPerTimeFrame,
    global.config.ratelimit_config.updateMember.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.updateMember.maxPerTimeFrame,
    global.config.ratelimit_config.updateMember.timeFrame,
    0.75,
  ),
  async (req, res) => {
    try {
      const sender = req.account;

      let channel = req.channel;

      if (channel.type !== 3) {
        return res.status(403).json({
          code: 403,
          message: 'Cannot add members to this type of channel.',
        });
      } //find the error

      if (!channel.recipients.find((x) => x.id === sender.id)) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      if (channel.recipients.length > 9) {
        return res.status(403).json({
          code: 403,
          message: 'Maximum number of members for group reached (10).',
        });
      }

      const recipient = req.recipient;

      if (recipient == null) {
        return res.status(404).json(errors.response_404.UNKNWON_USER);
      }

      if (!globalUtils.areWeFriends(sender, recipient)) {
        return res.status(403).json({
          code: 403,
          message: 'You are not friends with the recipient.',
        }); //figure this one out
      }

      //Add recipient
      channel.recipients.push(recipient);

      if (!(await global.database.updateChannelRecipients(channel.id, channel.recipients)))
        throw 'Failed to update recipients list in channel';

      //Notify everyone else
      await dispatcher.dispatchEventInPrivateChannel(channel, 'CHANNEL_UPDATE', function () {
        return globalUtils.personalizeChannelObject(this.socket, channel);
      });

      //Notify new recipient
      await globalUtils.pingPrivateChannelUser(channel, recipient.id);

      let add_msg = await global.database.createSystemMessage(null, channel.id, 1, [
        sender,
        recipient,
      ]);

      await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_CREATE', add_msg);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.delete(
  '/:channelid/recipients/:recipientid',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  rateLimitMiddleware(
    global.config.ratelimit_config.updateMember.maxPerTimeFrame,
    global.config.ratelimit_config.updateMember.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.updateMember.maxPerTimeFrame,
    global.config.ratelimit_config.updateMember.timeFrame,
    0.75,
  ),
  async (req, res) => {
    try {
      const sender = req.account;

      let channel = req.channel;

      if (channel.type !== 3) {
        return res.status(403).json({
          code: 403,
          message: 'Cannot remove members from this type of channel.',
        });
      }

      if (channel.owner_id !== sender.id) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      const recipient = req.recipient;

      if (recipient == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_USER);
      }

      //Remove recipient
      channel.recipients = channel.recipients.filter((recip) => recip.id !== recipient.id);

      if (!(await global.database.updateChannelRecipients(channel.id, channel.recipients)))
        throw 'Failed to update recipients list in channel';

      //Notify everyone else
      await dispatcher.dispatchEventInPrivateChannel(channel, 'CHANNEL_UPDATE', function () {
        return globalUtils.personalizeChannelObject(this.socket, channel);
      });

      let remove_msg = await global.database.createSystemMessage(null, channel.id, 2, [recipient]);

      await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_CREATE', remove_msg);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.delete(
  '/:channelid',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelMiddleware,
  guildPermissionsMiddleware('MANAGE_CHANNELS'),
  rateLimitMiddleware(
    global.config.ratelimit_config.deleteChannel.maxPerTimeFrame,
    global.config.ratelimit_config.deleteChannel.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.deleteChannel.maxPerTimeFrame,
    global.config.ratelimit_config.deleteChannel.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      const sender = req.account;

      let channel = req.channel;

      if (channel.type !== 3 && channel.type !== 1) {
        if (req.guild && req.guild.channels.length === 1) {
          return res.status(400).json({
            code: 400,
            message: 'You cannot delete all channels in this server',
          });
        }
      } //Should we let them delete all channels in the server?

      if (channel.type == 1 || channel.type == 3) {
        //Leaving a private channel
        let userPrivateChannels = await global.database.getPrivateChannels(sender.id);

        if (!userPrivateChannels) {
          return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
        }

        //TODO: Elegant but inefficient
        let newUserPrivateChannels = userPrivateChannels.filter((id) => id != channel.id);

        if (newUserPrivateChannels.length == userPrivateChannels.length) {
          return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
        }

        let tryUpdate = await global.database.setPrivateChannels(sender.id, newUserPrivateChannels);

        if (!tryUpdate) {
          return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }

        await dispatcher.dispatchEventTo(sender.id, 'CHANNEL_DELETE', {
          id: channel.id,
          guild_id: null,
        });

        if (channel.type == 3) {
          let newRecipientsList = channel.recipients.filter(
            (recipientObject) => recipientObject.id !== sender.id,
          );

          channel.recipients = newRecipientsList;

          //handover logic
          if (channel.owner_id === sender.id && newRecipientsList.length > 0) {
            let newOwnerId = newRecipientsList[0].id;

            channel.owner_id = newOwnerId;

            if (!(await global.database.updateChannel(channel.id, channel, true))) {
              throw 'Failed to transfer ownership of group channel';
            }
          } else if (newRecipientsList.length === 0) {
            await global.database.deleteChannel(channel.id);
            return res.status(204).send(); //delete group channel to free up the db
          }

          if (!(await global.database.updateChannelRecipients(channel.id, newRecipientsList)))
            throw 'Failed to update recipients list in channel';

          await dispatcher.dispatchEventInPrivateChannel(channel, 'CHANNEL_UPDATE', function () {
            return globalUtils.personalizeChannelObject(this.socket, channel);
          });
        }
      } else {
        //Deleting a guild channel
        if (req.params.channelid == req.params.guildid) {
          //TODO: Allow on 2018+ guilds
          return res.status(403).json({
            code: 403,
            message: 'The main channel cannot be deleted.',
          });
        }

        await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'CHANNEL_DELETE', {
          id: channel.id,
          guild_id: channel.guild_id,
        });

        if (!(await global.database.deleteChannel(channel.id))) {
          return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }
      }

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.use(
  '/:channelid/pins',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  rateLimitMiddleware(
    global.config.ratelimit_config.pins.maxPerTimeFrame,
    global.config.ratelimit_config.pins.timeFrame,
  ),
  pins,
  Watchdog.middleware(
    global.config.ratelimit_config.pins.maxPerTimeFrame,
    global.config.ratelimit_config.pins.timeFrame,
    0.2,
  ),
);

export default router;
