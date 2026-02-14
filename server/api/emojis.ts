import { Router } from 'express';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

import globalUtils from '../helpers/globalutils.ts';
import { logText } from '../helpers/logger.ts';
import { guildMiddleware, guildPermissionsMiddleware } from '../helpers/middlewares.ts';
import Snowflake from '../helpers/snowflake.ts';
const router = Router({ mergeParams: true });
import dispatcher from '../helpers/dispatcher.ts';
import errors from '../helpers/errors.ts';
import quickcache from '../helpers/quickcache.ts';
import type { Response } from "express";
import { prisma } from '../prisma.ts';

router.get(
  '/',
  guildMiddleware,
  guildPermissionsMiddleware('MANAGE_EMOJIS'),
  quickcache.cacheFor(60 * 5, true),
  async (req: any, res: Response) => {
    try {
      const guild = req.guild;
      const emojis = guild.emojis;

      return res.status(200).json(emojis);
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post('/', guildMiddleware, guildPermissionsMiddleware('MANAGE_EMOJIS'), async (req: any, res: Response) => {
  try {
    const account = req.account;
    const guild = req.guild;

    if (guild.emojis.length >= global.config.limits['emojis_per_guild'].max) {
      return res.status(404).json({
        code: 404,
        message: `Maximum emojis per guild exceeded (${global.config.limits['emojis_per_guild'].max})`,
      });
    }

    if (!req.body.name) {
      return res.status(400).json({
        code: 400,
        name: 'This field is required.',
      });
    }

    if (
      req.body.name.length < global.config.limits['emoji_name'].min ||
      req.body.name.length >= global.config.limits['emoji_name'].max
    ) {
      return res.status(400).json({
        code: 400,
        name: `Must be between ${global.config.limits['emoji_name'].min} and ${global.config.limits['emoji_name'].max} characters.`,
      });
    }

    const base64Data = req.body.image.split(';base64,').pop();
    const mimeType = req.body.image.split(';')[0].split(':')[1];
    const extension = mimeType.split('/')[1];

    const emoji_id = Snowflake.generate();

    if (!existsSync(`./www_dynamic/emojis`)) {
      mkdirSync(`./www_dynamic/emojis`, { recursive: true });
    }

    const filePath = `./www_dynamic/emojis/${emoji_id}.${extension}`;

    const imageBuffer = Buffer.from(base64Data, 'base64');

    writeFileSync(filePath, imageBuffer);

     const custom_emojis = guild.emojis;

    custom_emojis.push({
      id: emoji_id,
      name: req.body.name,
      user: globalUtils.miniUserObject(account),
    });
    
    const updatedGuild = await prisma.guild.update({
      where: { id: guild.id },
      data: { custom_emojis: custom_emojis }
    });

    const currentEmojis: any = updatedGuild.custom_emojis;

    for (var emoji of currentEmojis) {
      emoji.roles = [];
      emoji.require_colons = true;
      emoji.managed = false;
      emoji.allNamesString = `:${emoji.name}:`;
    }

    await dispatcher.dispatchEventInGuild(guild, 'GUILD_EMOJIS_UPDATE', {
      guild_id: guild.id,
      emojis: currentEmojis,
      guild_hashes: {
        version: 1,
        roles: {
          hash: 'placeholder',
          omitted: false,
        },
        metadata: {
          hash: 'placeholder2',
          omitted: false,
        },
        channels: {
          hash: 'placeholder3',
          omitted: false,
        },
      },
    });

    return res.status(201).json({
      allNamesString: `:${req.body.name}:`,
      guild_id: guild.id,
      id: emoji_id,
      managed: false,
      name: req.body.name,
      require_colons: true,
      roles: [],
      user: globalUtils.miniUserObject(account),
    });
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.patch(
  '/:emoji',
  guildMiddleware,
  guildPermissionsMiddleware('MANAGE_EMOJIS'),
  async (req: any, res: Response) => {
    try {
      const guild = req.guild;
      const emoji_id = req.params.emoji;
      const emoji = req.guild.emojis.find((x) => x.id === emoji_id);

      if (emoji == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_EMOJI);
      }

      if (!req.body.name) {
        return res.status(400).json({
          code: 400,
          name: 'This field is required',
        });
      }

      if (
        req.body.name.length < global.config.limits['emoji_name'].min ||
        req.body.name.length >= global.config.limits['emoji_name'].max
      ) {
        return res.status(400).json({
          code: 400,
          name: `Must be between ${global.config.limits['emoji_name'].min} and ${global.config.limits['emoji_name'].max} characters.`,
        });
      }

      const emojis = guild.custom_emojis as any[]; 
      const customEmoji = emojis.find((x) => x.id === emoji_id);

      if (!customEmoji) {
        return res.status(404).json(errors.response_404.UNKNOWN_EMOJI);
      }

      customEmoji.name = req.body.name;

      const updatedGuild = await prisma.guild.update({
        where: {
          id: guild.id
        },
        data: {
          custom_emojis: emojis
        }
      });

      const currentEmojis = (updatedGuild.custom_emojis as any[]).map((e) => ({
        ...e,
        roles: [],
        require_colons: true,
        managed: false,
        allNamesString: `:${e.name}:`,
      }));

      for (var emoji2 of currentEmojis) {
        emoji2.roles = [];
        emoji2.require_colons = true;
        emoji2.managed = false;
        emoji2.allNamesString = `:${emoji.name}:`;
      }

      await dispatcher.dispatchEventInGuild(guild, 'GUILD_EMOJIS_UPDATE', {
        guild_id: guild.id,
        emojis: currentEmojis,
        guild_hashes: {
          version: 1,
          roles: {
            hash: 'placeholder',
            omitted: false,
          },
          metadata: {
            hash: 'placeholder2',
            omitted: false,
          },
          channels: {
            hash: 'placeholder3',
            omitted: false,
          },
        },
      });

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.delete(
  '/:emoji',
  guildMiddleware,
  guildPermissionsMiddleware('MANAGE_EMOJIS'),
  async (req: any, res: Response) => {
    try {
      const guild = req.guild;
      const emoji_id = req.params.emoji;
      const emojis = (guild.custom_emojis as any[]) || [];
      const emojiExists = emojis.some((x) => x.id === emoji_id);

      if (!emojiExists) {
        return res.status(404).json(errors.response_404.UNKNOWN_EMOJI);
      }

      const filteredEmojis = emojis.filter((x) => x.id !== emoji_id);

      const updatedGuild = await prisma.guild.update({
        where: { id: guild.id },
        data: {
          custom_emojis: filteredEmojis
        }
      });

      const currentEmojis = (updatedGuild.custom_emojis as any[]).map((e) => ({
        ...e,
        roles: [],
        require_colons: true,
        managed: false,
        allNamesString: `:${e.name}:`,
      }));

      await dispatcher.dispatchEventInGuild(guild, 'GUILD_EMOJIS_UPDATE', {
        guild_id: guild.id,
        emojis: currentEmojis,
        guild_hashes: {
          version: 1,
          roles: {
            hash: 'placeholder',
            omitted: false,
          },
          metadata: {
            hash: 'placeholder2',
            omitted: false,
          },
          channels: {
            hash: 'placeholder3',
            omitted: false,
          },
        },
      });

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

export default router;
