import { Router } from 'express';
import { copyFileSync, existsSync, mkdirSync, promises } from 'fs';

import dispatcher from '../helpers/dispatcher.js';
import errors from '../helpers/errors.js';
import globalUtils from '../helpers/globalutils.js';
import { logText } from '../helpers/logger.js';
import md5 from '../helpers/md5.js';
import { authMiddleware, guildPermissionsMiddleware } from '../helpers/middlewares.js';
import Snowflake from '../helpers/snowflake.js';

const router = Router({ mergeParams: true });

router.param('webhookid', async (req, res, next, webhookid) => {
  req.webhook = await global.database.getWebhookById(webhookid);

  next();
});

router.patch(
  '/:webhookid',
  authMiddleware,
  guildPermissionsMiddleware('MANAGE_WEBHOOKS'),
  async (req, res) => {
    try {
      if (!req.body.channel_id) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      let channel = await global.database.getChannelById(req.body.channel_id);

      if (!channel) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      let webhook = req.webhook;

      if (!webhook) {
        return res.status(404).json(errors.response_404.UNKNOWN_WEBHOOK);
      }

      let guild = await global.database.getGuildById(webhook.guild_id);

      if (!guild) {
        return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
      }

      const newName = req.body.name;

      if (!newName) {
        return res.status(400).json({
          code: 400,
          name: 'Must be between 2 and 25 characters.',
        });
      } else if (newName.length < 2 || newName.length > 25) {
        return res.status(400).json({
          code: 400,
          name: 'Must be between 2 and 25 characters.',
        });
      }

      const finalName = newName ?? webhook.name ?? 'Captain Hook';
      const finalAvatar = req.body.avatar !== undefined ? req.body.avatar : webhook.avatar;

      let tryUpdate = await global.database.updateWebhook(webhook, channel, finalName, finalAvatar);

      if (!tryUpdate) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      return res.status(200).json(tryUpdate);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.delete(
  '/:webhookid',
  authMiddleware,
  guildPermissionsMiddleware('MANAGE_WEBHOOKS'),
  async (req, res) => {
    try {
      let webhook = req.webhook;

      if (!webhook) {
        return res.status(404).json(errors.response_404.UNKNOWN_WEBHOOK);
      }

      let guild = await global.database.getGuildById(webhook.guild_id);

      if (!guild) {
        return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
      }

      let tryDelete = await global.database.deleteWebhook(webhook.id);

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

router.post('/:webhookid/:webhooktoken', async (req, res) => {
  try {
    let webhook = req.webhook;

    if (!webhook) {
      return res.status(404).json(errors.response_404.UNKNOWN_WEBHOOK);
    }

    let guild = await global.database.getGuildById(webhook.guild_id);

    if (!guild) {
      return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
    }

    let channel = await global.database.getChannelById(webhook.channel_id);

    if (!channel) {
      return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
    } // I dont know if it should return these error messages so bluntly, but whatever

    let create_override = false;
    let override = {
      username: null,
      avatar_url: null,
    };

    if (req.body.username) {
      create_override = true;

      override.username = req.body.username;
    }

    if (req.body.avatar_url) {
      create_override = true;

      try {
        const response = await fetch(req.body.avatar_url);

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          let extension = contentType.split('/')[1]; // 'png', 'jpeg', etc.

          var name = globalUtils.generateString(30);
          var name_hash = md5(name);

          if (extension == 'jpeg') {
            extension = 'jpg';
          }

          if (!existsSync(`./www_dynamic/avatars/${webhook.id}`)) {
            mkdirSync(`./www_dynamic/avatars/${webhook.id}`, { recursive: true });
          }

          const arrayBuffer = await response.arrayBuffer();

          await promises.writeFile(
            `./www_dynamic/avatars/${webhook.id}/${name_hash}.${extension}`,
            Buffer.from(arrayBuffer),
          );

          override.avatar_url = name_hash;
        }
      } catch (error) {
        logText(error, 'error');
      }
    }

    let override_id = Snowflake.generate();

    let embeds = [];
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

          embedObj.thumbnail = { url: thumb, proxy_url: thumb };
        }

        if (embed.image?.url) {
          let img = proxyUrl(embed.image.url);

          embedObj.image = { url: img, proxy_url: img };
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

    let createMessage = await global.database.createMessage(
      !channel.guild_id ? null : channel.guild_id,
      channel.id,
      create_override ? `WEBHOOK_${webhook.id}_${override_id}` : `WEBHOOK_${webhook.id}`,
      req.body.content,
      req.body.nonce,
      null,
      req.body.tts,
      false,
      null,
      embeds,
      webhook,
    );

    if (!createMessage) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    if (create_override) {
      let tryCreateOverride = await global.database.createWebhookOverride(
        webhook.id,
        override_id,
        override.username,
        override.avatar_url,
      );

      if (!tryCreateOverride) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      createMessage.author.username = override.username ?? webhook.name;
      createMessage.author.avatar = override.avatar_url;
    }

    await dispatcher.dispatchEventInChannel(guild, channel.id, 'MESSAGE_CREATE', createMessage);

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/:webhookid/:webhooktoken/github', async (req, res) => {
  try {
    let webhook = req.webhook;

    if (!webhook) {
      return res.status(404).json(errors.response_404.UNKNOWN_WEBHOOK);
    }

    let guild = await global.database.getGuildById(webhook.guild_id);

    if (!guild) {
      return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
    }

    let channel = await global.database.getChannelById(webhook.channel_id);

    if (!channel) {
      return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
    }

    let override = {
      username: 'GitHub',
      avatar_url: 'github',
    };

    if (!existsSync(`./www_dynamic/avatars/${webhook.id}`)) {
      mkdirSync(`./www_dynamic/avatars/${webhook.id}`, { recursive: true });
    }

    if (!existsSync(`./www_dynamic/avatars/${webhook.id}/github.png`)) {
      copyFileSync(
        `./www_static/assets/misc/github.png`,
        `./www_dynamic/avatars/${webhook.id}/github.png`,
      );
    }

    let override_id = Snowflake.generate();

    let embeds = [];

    if (req.body.commits && req.body.commits.length > 0) {
      let commit_url = null;
      let description = null;

      if (req.body.commits.length == 1) {
        commit_url = `${req.body.repository.html_url}/commit/${req.body.commits[0].id}`;

        description =
          '[`' +
          req.body.commits[0].id.slice(0, 7) +
          '`]' +
          `(${commit_url}) ${req.body.commits[0].message.length > 50 ? req.body.commits[0].message.slice(0, 50) + '...' : req.body.commits[0].message} - ${req.body.commits[0].author.username}`;
      } else {
        commit_url = `${req.body.repository.html_url}/compare/${req.body.commits[0].id.slice(0, 7)}...${req.body.commits[req.body.commits.length - 1].id.slice(0, 7)}`;

        for (var commit of req.body.commits) {
          let c_url = `${req.body.repository.html_url}/commit/${commit.id}`;

          description +=
            `\n` +
            '[`' +
            commit.id.slice(0, 7) +
            '`]' +
            `(${c_url}) ${commit.message.length > 50 ? commit.message.slice(0, 50) + '...' : commit.message} - ${commit.author.username}`;
        }
      }

      embeds = [
        {
          type: 'rich',
          color: 7506394,
          title: `[${req.body.repository.name}:${req.body.ref.replace('refs/heads/', '')}] ${req.body.commits.length} new commit(s)`,
          url: commit_url,
          description: description,
          author: {
            icon_url: req.body.sender.avatar_url,
            name: req.body.sender.login,
            proxy_icon_url: req.body.sender.avatar_url,
            url: req.body.sender.url,
          },
        },
      ];
    }

    const createMessage = await global.database.createMessage(
      !channel.guild_id ? null : channel.guild_id,
      channel.id,
      'WEBHOOK_' + webhook.id + '_' + override_id,
      req.body.content,
      req.body.nonce,
      null,
      req.body.tts,
      false,
      embeds,
    );

    if (!createMessage) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    let tryCreateOverride = await global.database.createWebhookOverride(
      webhook.id,
      override_id,
      override.username,
      override.avatar_url,
    );

    if (!tryCreateOverride) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    createMessage.author.username = override.username;
    createMessage.author.avatar = override.avatar_url;

    await dispatcher.dispatchEventInChannel(guild, channel.id, 'MESSAGE_CREATE', createMessage);

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
