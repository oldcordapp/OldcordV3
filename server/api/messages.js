const express = require('express');
const globalUtils = require('../helpers/globalutils');
const { logText } = require('../helpers/logger');
const {
  channelPermissionsMiddleware,
  rateLimitMiddleware,
  instanceMiddleware,
} = require('../helpers/middlewares');
const fs = require('fs');
const multer = require('multer');
const { Jimp } = require('jimp');
const Snowflake = require('../helpers/snowflake');
const reactions = require('./reactions');
const path = require('path');
const quickcache = require('../helpers/quickcache');
const Watchdog = require('../helpers/watchdog');
const ffmpeg = require('fluent-ffmpeg');
const errors = require('../helpers/errors');
const dispatcher = require('../helpers/dispatcher');

const upload = multer();
const router = express.Router({ mergeParams: true });

router.param('messageid', async (req, res, next, messageid) => {
  req.message = await global.database.getMessageById(messageid);
  next();
});

router.use('/:messageid/reactions', instanceMiddleware('VERIFIED_EMAIL_REQUIRED'), reactions);

function handleJsonAndMultipart(req, res, next) {
  const contentType = req.headers['content-type'];
  if (contentType && contentType.startsWith('multipart/form-data')) {
    upload.any()(req, res, next);
  } else {
    express.json()(req, res, next);
  }
}

router.get(
  '/',
  channelPermissionsMiddleware('READ_MESSAGES'),
  quickcache.cacheFor(15, false),
  async (req, res) => {
    try {
      const creator = req.account;
      const channel = req.channel;

      if (channel.type === 2) {
        return res.status(400).json({
          code: 400,
          message: 'Cannot get text messages from a voice channel.', //I mean we're cool with you doing that and everything but realistically, who is going to read these messages?
        }); //whats the proper response here?
      }

      let limit = parseInt(req.query.limit) || 200;

      if (limit > 200) {
        limit = 200;
      }

      let includeReactions =
        (req.guild && !req.guild.exclusions.includes('reactions')) ||
        channel.type === 1 ||
        channel.type === 3; //to-do get rid of magic numbers
      let around = req.query.around;
      let messages = [];

      if (around) {
        messages = await global.database.getMessagesAround(channel.id, around, limit);
      } else {
        messages = await global.database.getChannelMessages(
          channel.id,
          creator.id,
          limit,
          req.query.before,
          req.query.after,
          includeReactions,
        );
      }

      messages = messages.map((message) => {
        return globalUtils.personalizeMessageObject(message, req.guild, req.client_build_date);
      });

      return res.status(200).json(messages);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post(
  '/',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  handleJsonAndMultipart,
  channelPermissionsMiddleware('SEND_MESSAGES'),
  rateLimitMiddleware(
    global.config.ratelimit_config.sendMessage.maxPerTimeFrame,
    global.config.ratelimit_config.sendMessage.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.sendMessage.maxPerTimeFrame,
    global.config.ratelimit_config.sendMessage.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      const account = req.account;
      const author = account;

      if (req.channel.type === 2) {
        return res.status(400).json({
          code: 400,
          message: 'Cannot send a text message in a voice channel.', //I mean we're cool with you doing that and everything but realistically, who is going to read these messages?
        });
      }

      if (req.body.payload_json) {
        const originalJson = req.body.payload_json;

        req.body = JSON.parse(originalJson);
      }

      if (req.body.content && typeof req.body.content === 'string') {
        req.body.content = req.body.content.trim();
      }

      if (
        !req.body.embeds &&
        !req.files &&
        (!req.body.content || typeof req.body.content !== 'string' || req.body.content === '')
      ) {
        return res.status(400).json(errors.response_400.CANNOT_SEND_EMPTY_MESSAGE);
      } //this aswell

      if (req.body.content && !req.body.embeds) {
        const min = global.config.limits['messages'].min;
        const max = global.config.limits['messages'].max;

        if (req.body.content.length < min || req.body.content.length > max) {
          return res.status(400).json({
            code: 400,
            content: `Must be between ${min} and ${max} characters.`,
          });
        }
      }

      let embeds = []; //So... discord removed the ability for users to create embeds in their messages way back in like 2020, killing the whole motive of self bots, but here at Oldcord, we don't care - just don't abuse our API.

      if (req.body.embeds && (!Array.isArray(req.body.embeds) || req.body.embeds.length === 0)) {
        return res.status(400).json(errors.response_400.CANNOT_SEND_EMPTY_MESSAGE);
      }

      let MAX_EMBEDS = 10; //to-do make this configurable
      let proxyUrl = (url) => {
        return url ? `/proxy/${encodeURIComponent(url)}` : null;
      };

      if (Array.isArray(req.body.embeds)) {
        embeds = req.body.embeds.slice(0, MAX_EMBEDS).map((embed) => {
          let embedObj = {
            type: 'rich',
            color: embed.color ?? 7506394,
          };

          if (embed.title) embedObj.title = embed.title;
          if (embed.description) embedObj.description = embed.description;
          if (embed.url) embedObj.url = embed.url;
          if (embed.timestamp) embedObj.timestamp = embed.timestamp;

          if (embed.author) {
            let icon = proxyUrl(embed.author.icon_url);

            embedObj.author = {
              name: embed.author.name ?? null,
              url: embed.author.url ?? null,
              icon_url: icon,
              proxy_icon_url: icon,
            };
          }

          if (embed.thumbnail?.url) {
            let thumb = proxyUrl(embed.thumbnail.url);

            let raw_width = embed.thumbnail.width ?? 400;
            let raw_height = embed.thumbnail.height ?? 400;

            embedObj.thumbnail = {
              url: thumb,
              proxy_url: thumb,
              width: Math.min(Math.max(raw_width, 400), 800),
              height: Math.min(Math.max(raw_height, 400), 800),
            };
          }

          if (embed.image?.url) {
            let img = proxyUrl(embed.image.url);

            let raw_width = embed.image.width ?? 400;
            let raw_height = embed.image.height ?? 400;

            embedObj.image = {
              url: img,
              proxy_url: img,
              width: Math.min(Math.max(raw_width, 400), 800),
              height: Math.min(Math.max(raw_height, 400), 800),
            };
          }

          if (embed.footer) {
            let footerIcon = proxyUrl(embed.footer.icon_url);

            embedObj.footer = {
              text: embed.footer.text ?? null,
              icon_url: footerIcon,
              proxy_icon_url: footerIcon,
            };
          }

          if (Array.isArray(embed.fields) && embed.fields.length > 0) {
            embedObj.fields = embed.fields.map((f) => ({
              name: f.name ?? '',
              value: f.value ?? '',
              inline: !!f.inline,
            }));
          }

          return embedObj;
        });
      }

      const mentions_data = globalUtils.parseMentions(req.body.content);

      if (
        (mentions_data.mention_everyone || mentions_data.mention_here) &&
        !global.permissions.hasChannelPermissionTo(
          req.channel,
          req.guild,
          author.id,
          'MENTION_EVERYONE',
        )
      ) {
        mentions_data.mention_everyone = false;
        mentions_data.mention_here = false;
      }

      if (mentions_data.mention_here) {
        mentions_data.mention_everyone = true;
      } //just make sure both are set to true

      //Coerce tts field to boolean
      req.body.tts = req.body.tts === true || req.body.tts === 'true';

      if (!req.channel.recipients) {
        if (!req.guild) {
          return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
        }

        if (!req.channel.guild_id) {
          return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
        }
      }

      if (req.channel.recipients) {
        //DM/Group channel rules

        //Disable @everyone and @here for DMs and groups
        mentions_data.mention_everyone = false;
        mentions_data.mention_here = false;

        if (req.channel.type !== 1 && req.channel.type !== 3) {
          //Not a DM channel or group channel
          return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
        }

        if (req.channel.type == 1) {
          //DM channel

          //Need a complete user object for the relationships
          let recipientID =
            req.channel.recipients[req.channel.recipients[0].id == author.id ? 1 : 0].id;
          let recipient = await global.database.getAccountByUserId(recipientID);

          if (!recipient) {
            return res.status(404).json(errors.response_404.UNKNOWN_USER);
          }

          let ourFriends = account.relationships;
          let theirFriends = recipient.relationships;
          let ourRelationshipState = ourFriends?.find((x) => x.user.id == recipient.id);
          let theirRelationshipState = theirFriends?.find((x) => x.user.id == account.id);

          if (!account.bot && !ourRelationshipState) {
            ourFriends.push({
              id: recipient.id,
              type: 0,
              user: globalUtils.miniUserObject(recipient),
            });

            ourRelationshipState = ourFriends.find((x) => x.user.id == recipient.id);
          }

          if (!recipient.bot && !theirRelationshipState) {
            theirFriends.push({
              id: account.id,
              type: 0,
              user: globalUtils.miniUserObject(account),
            });

            theirRelationshipState = theirFriends.find((x) => x.user.id == account.id);
          }

          if (ourRelationshipState?.type === 2 || theirRelationshipState?.type === 2) {
            return res.status(403).json(errors.response_403.CANNOT_SEND_MESSAGES_TO_THIS_USER);
          }

          let guilds = await global.database.getUsersGuilds(recipient.id);
          let ourGuilds = await global.database.getUsersGuilds(account.id);

          let dmsOff = [];

          for (var guild of guilds) {
            if (!recipient.bot && recipient.settings.restricted_guilds.includes(guild.id)) {
              dmsOff.push(guild.id);
            }
          }

          if (dmsOff.length === guilds.length && !globalUtils.areWeFriends(account, recipient)) {
            return res.status(403).json(errors.response_403.CANNOT_SEND_MESSAGES_TO_THIS_USER);
          }

          let shareMutualGuilds = false;

          for (var guild of guilds) {
            if (ourGuilds.find((x) => x.id === guild.id)) {
              shareMutualGuilds = true;
              break;
            }
          }

          if (!shareMutualGuilds && !globalUtils.areWeFriends(account, recipient)) {
            return res.status(403).json(errors.response_403.CANNOT_SEND_MESSAGES_TO_THIS_USER);
          }
        }
      } else {
        //Guild rules
        let canUseEmojis = !req.guild.exclusions.includes('custom_emoji');

        const emojiPattern = /<:[\w-]+:\d+>/g;

        const hasEmojiFormat = emojiPattern.test(req.body.content);

        if (hasEmojiFormat && !canUseEmojis) {
          return res.status(400).json({
            code: 400,
            message: 'Custom emojis are disabled in this server due to its maximum support',
          });
        }

        if (
          req.body.tts &&
          !global.permissions.hasChannelPermissionTo(
            req.channel,
            req.guild,
            author.id,
            'SEND_TTS_MESSAGES',
          )
        ) {
          //Not allowed
          req.body.tts = false;
        }

        if (
          req.channel.rate_limit_per_user > 0 &&
          !global.permissions.hasChannelPermissionTo(
            req.channel,
            req.guild,
            author.id,
            'MANAGE_CHANNELS',
          ) &&
          !global.permissions.hasChannelPermissionTo(
            req.channel,
            req.guild,
            author.id,
            'MANAGE_MESSAGES',
          )
        ) {
          let key = `${author.id}-${req.channel.id}`;
          let ratelimit = req.channel.rate_limit_per_user * 1000;
          let currentTime = Date.now();
          let lastMessageTimestamp = global.slowmodeCache.get(key) || 0;
          let difference = currentTime - lastMessageTimestamp;

          if (difference < ratelimit) {
            let waitTime = ratelimit - difference;

            return res.status(429).json({
              ...errors.response_429.SLOWMODE_RATE_LIMIT,
              retry_after: waitTime,
            });
          }

          global.slowmodeCache.set(key, currentTime);
        } //Slowmode implementation
      }

      let file_details = null;

      if (req.files) {
        req.file = req.files[0];
      }

      if (req.file) {
        if (req.file.size >= global.config.limits['attachments'].max_size) {
          return res.status(400).json({
            code: 400,
            message: `Message attachments cannot be larger than ${global.config.limits['attachments'].max_size} bytes.`,
          });
        }

        file_details = [
          {
            id: Snowflake.generate(),
            size: req.file.size,
          },
        ];

        file_details[0].name = globalUtils
          .replaceAll(req.file.originalname, ' ', '_')
          .replace(/[^A-Za-z0-9_\-.()\[\]]/g, '');
        file_details[0].filename = file_details[0].name;

        if (!file_details[0].name || file_details[0].name == '') {
          return res.status(403).json({
            code: 403,
            message: 'Invalid filename',
          });
        }

        const channelDir = path.join('.', 'www_dynamic', 'attachments', req.channel.id);
        const attachmentDir = path.join(channelDir, file_details[0].id);
        const file_path = path.join(attachmentDir, file_details[0].name);

        file_details[0].url = `${globalUtils.config.secure ? 'https' : 'http'}://${globalUtils.config.base_url}${globalUtils.nonStandardPort ? `:${globalUtils.config.port}` : ''}/attachments/${req.channel.id}/${file_details[0].id}/${file_details[0].name}`;

        if (!fs.existsSync(attachmentDir)) {
          fs.mkdirSync(attachmentDir, { recursive: true });
        }

        fs.writeFileSync(file_path, req.file.buffer);

        const isVideo = file_path.endsWith('.mp4') || file_path.endsWith('.webm');

        if (isVideo) {
          try {
            await new Promise((resolve, reject) => {
              ffmpeg(file_path)
                .on('end', () => {
                  ffmpeg.ffprobe(file_path, (err, metadata) => {
                    let vid_metadata = metadata.streams.find((x) => x.codec_type === 'video');

                    if (!err && vid_metadata) {
                      file_details[0].width = vid_metadata.width;
                      file_details[0].height = vid_metadata.height;
                    }

                    resolve();
                  });
                })
                .on('error', (err) => {
                  logText(err, 'error');
                  reject(err);
                })
                .screenshots({
                  count: 1,
                  timemarks: ['1'],
                  filename: 'thumbnail.png',
                  folder: attachmentDir,
                });
            });
          } catch (error) {
            file_details[0].width = 500;
            file_details[0].height = 500;
          }
        } else {
          const imageExtensions = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.gif'];
          const fileExt = path.extname(file_details[0].name).toLowerCase();

          if (imageExtensions.includes(fileExt)) {
            try {
              const image = await Jimp.read(req.file.buffer);
              if (image) {
                file_details[0].width = image.bitmap.width;
                file_details[0].height = image.bitmap.height;
              }
            } catch (error) {
              file_details[0].width = 500;
              file_details[0].height = 500;

              logText('Failed to parse image dimension - possible vulnerability attempt?', 'warn');
            }
          } else {
            file_details[0].width = 0;
            file_details[0].height = 0;
          }
        }
      }

      //Write message
      const message = await global.database.createMessage(
        req.guild ? req.guild.id : null,
        req.channel.id,
        author.id,
        req.body.content,
        req.body.nonce,
        file_details,
        req.body.tts,
        mentions_data,
        embeds,
      );

      if (!message) throw 'Message creation failed';

      if (mentions_data.mention_everyone || mentions_data.mention_here) {
        global.database
          .incrementMentions(
            req.channel.id,
            req.guild.id,
            mentions_data.mention_here ? 'here' : 'everyone',
          )
          .catch((err) => logText(err, 'error'));
      }

      //Dispatch to correct recipients(s) in DM, group, or guild
      if (req.channel.recipients) {
        await globalUtils.pingPrivateChannel(req.channel);
        await dispatcher.dispatchEventInPrivateChannel(req.channel, 'MESSAGE_CREATE', message);
      } else {
        await dispatcher.dispatchEventInChannel(
          req.guild,
          req.channel.id,
          'MESSAGE_CREATE',
          message,
        );
      }

      //Acknowledge immediately to author
      const tryAck = await global.database.acknowledgeMessage(
        author.id,
        req.channel.id,
        message.id,
        0,
      );

      if (!tryAck) throw 'Message acknowledgement failed';

      await dispatcher.dispatchEventTo(author.id, 'MESSAGE_ACK', {
        channel_id: req.channel.id,
        message_id: message.id,
        manual: false, //This is for if someone clicks mark as read
      });

      return res.status(200).json(message);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.delete(
  '/:messageid',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  channelPermissionsMiddleware('MANAGE_MESSAGES'),
  rateLimitMiddleware(
    global.config.ratelimit_config.deleteMessage.maxPerTimeFrame,
    global.config.ratelimit_config.deleteMessage.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.deleteMessage.maxPerTimeFrame,
    global.config.ratelimit_config.deleteMessage.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      const guy = req.account;
      const message = req.message;

      if (message == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      const channel = req.channel;

      if (!channel.recipients && !channel.guild_id) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      if (channel.recipients && message.author.id != guy.id) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      if (!(await global.database.deleteMessage(req.params.messageid)))
        throw 'Message deletion failed';

      const payload = {
        id: req.params.messageid,
        guild_id: channel.guild_id,
        channel_id: req.params.channelid,
      };

      if (channel.recipients)
        await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_DELETE', payload);
      else
        await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'MESSAGE_DELETE', payload);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.patch(
  '/:messageid',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  rateLimitMiddleware(
    global.config.ratelimit_config.updateMessage.maxPerTimeFrame,
    global.config.ratelimit_config.updateMessage.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.updateMessage.maxPerTimeFrame,
    global.config.ratelimit_config.updateMessage.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      if (req.body.content && req.body.content == '') {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      const caller = req.account;

      let message = req.message;

      if (message == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      const channel = req.channel;

      if (!channel.recipients && !channel.guild_id) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      if (message.author.id != caller.id) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      //TODO:
      //FIXME: this needs to use globalUtils.parseMentions
      if (req.body.content && req.body.content.includes('@everyone')) {
        let pCheck = global.permissions.hasChannelPermissionTo(
          req.channel,
          req.guild,
          message.author.id,
          'MENTION_EVERYONE',
        );

        if (!pCheck) {
          req.body.content = req.body.content.replace(/@everyone/g, '');
        }
      }

      const update = await global.database.updateMessage(message.id, req.body.content);

      if (!update) throw 'Message update failed';

      message = await global.database.getMessageById(req.params.messageid);

      if (message == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      if (channel.recipients)
        await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_UPDATE', message);
      else
        await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'MESSAGE_UPDATE', message);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post(
  '/:messageid/ack',
  instanceMiddleware('VERIFIED_EMAIL_REQUIRED'),
  rateLimitMiddleware(
    global.config.ratelimit_config.ackMessage.maxPerTimeFrame,
    global.config.ratelimit_config.ackMessage.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.ackMessage.maxPerTimeFrame,
    global.config.ratelimit_config.ackMessage.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      const guy = req.account;
      const message = req.message;

      if (message == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      const channel = req.channel;

      let msgAlreadyAcked = await global.database.isMessageAcked(guy.id, channel.id, message.id);

      if (msgAlreadyAcked) {
        return res.status(200).json({
          token: globalUtils.generateToken(guy.id, globalUtils.generateString(20)),
        });
      }

      let tryAck = await global.database.acknowledgeMessage(guy.id, channel.id, message.id, 0);

      if (!tryAck) throw 'Message acknowledgement failed';

      await dispatcher.dispatchEventTo(guy.id, 'MESSAGE_ACK', {
        channel_id: channel.id,
        message_id: message.id,
        manual: false, //This is for if someone clicks mark as read
      });

      return res.status(200).json({
        token: globalUtils.generateToken(guy.id, globalUtils.generateString(20)),
      });
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

module.exports = router;
