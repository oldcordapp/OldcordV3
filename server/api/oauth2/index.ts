import { Router } from 'express';
import type { Response } from "express";

import dispatcher from '../../helpers/dispatcher.js';
import errors from '../../helpers/errors.js';
import globalUtils from '../../helpers/globalutils.ts';
import lazyRequest from '../../helpers/lazyRequest.js';
import { logText } from '../../helpers/logger.ts';
import applications from './applications.js';
import tokens from './tokens.ts';
import { prisma } from '../../prisma.ts';

const router = Router({ mergeParams: true });

router.use('/applications', applications);
router.use('/tokens', tokens);
router.get('/authorize', async (req: any, res: Response) => {
  try {
    const account = req.account;

    if (account.bot) {
      return res.status(401).json(errors.response_401.UNAUTHORIZED);
    }

    const client_id = req.query.client_id;
    const scope = req.query.scope;

    if (!client_id) {
      return res.status(400).json({
        code: 400,
        client_id: 'This parameter is required',
      }); //figure this error response out
    }

    if (!scope) {
      return res.status(400).json({
        code: 400,
        scope: 'This parameter is required',
      }); // citation 2
    }

    let return_obj: any = {
      authorized: false,
    };

    const dbApplications = await prisma.application.findMany({
      where: { id: client_id }
    });

    if (dbApplications.length === 0) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    }

    const { ...appData } = dbApplications[0];
    const application: any = { 
      ...appData,
      redirect_uris: [],
      rpc_application_state: 0,
      rpc_origins: []
    };

    if (scope.includes('bot')) {
      const bots = await prisma.bot.findMany({
        where: { application_id: application.id }
      });

      if (bots.length === 0) {
        return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
      }

      const rawBot = bots[0];

      if (!rawBot.public && application.owner_id != account.id) {
        return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
      }

      const { public: is_public, require_code_grant: requires_code_grant, token, ...botData } = rawBot;

      application.bot = botData; 
      application.bot_public = is_public;
      application.bot_require_code_grant = requires_code_grant;
    }

    return_obj.application = application;

    if (application.bot) {
      return_obj.bot = application.bot;
    }

    return_obj.redirect_uri = null;
    return_obj.user = globalUtils.miniUserObject(account);

    const guilds = await global.database.getUsersGuilds(account.id);

    const guilds_array: any = [];

    if (guilds.length > 0) {
      for (var guild of guilds) {
        const isOwner = guild.owner_id === account.id;
        const isStaffOverride = req.is_staff && req.staff_details.privilege >= 3;
        const hasPermission =
          isOwner ||
          isStaffOverride ||
          global.permissions.hasGuildPermissionTo(guild, account.id, 'ADMINISTRATOR', null) ||
          global.permissions.hasGuildPermissionTo(guild, account.id, 'MANAGE_GUILD', null);

        if (hasPermission) {
          guilds_array.push({
            id: guild.id,
            icon: guild.icon,
            name: guild.name,
            permissions: 2146958719, //we'll need to fetch this again from somewhere
            region: null,
          });
        }
      }
    }

    return_obj.guilds = guilds_array;

    return res.status(200).json(return_obj);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/authorize', async (req: any, res: any) => {
  try {
    const account = req.account;

    if (account.bot) {
      return res.status(401).json(errors.response_401.UNAUTHORIZED);
    }

    const client_id = req.query.client_id as string;
    const scope = req.query.scope as string;

    let permissions = parseInt(String(req.query.permissions || '0'));

    if (!client_id) {
      return res.status(400).json({
        code: 400,
        client_id: 'This parameter is required',
      });
    }

    if (!scope) {
      return res.status(400).json({
        code: 400,
        scope: 'This parameter is required',
      });
    }

    if (!permissions || isNaN(permissions)) {
      permissions = 0;
    }

    const dbApplications = await prisma.application.findMany({
      where: {
        id: client_id
      }
    });

    if (dbApplications.length == 0) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    }

    let application: any = dbApplications[0];
    let guild_id = null;

    if (scope === 'bot') {
      guild_id = req.body.bot_guild_id || req.body.guild_id;

      const bots = await prisma.bot.findMany({
        where: { application_id: application.id }
      });

      if (bots.length === 0) {
        return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
      }

      const bot = bots[0];

      if (!bot.public && application.owner_id != account.id) {
        return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
      }

      application.bot = bot;
    }

    const guilds = await prisma.guild.findMany({
      where: {
        id: guild_id!
      }
    });

    if (guilds.length == 0) {
      return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
    }

    const guild: any = guilds.find((x) => x.id === guild_id);

    if (!guild) {
      return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
    }

    const member = guild.members.find((x) => x.id === account.id);

    if (!member) {
      return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
    }

    const botAlrThere = guild.members.find((x) => x.id === application.bot.id);

    if (botAlrThere) {
      return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
    }

    const isOwner = guild.owner_id === account.id;
    const isStaffOverride = req.is_staff && req.staff_details.privilege >= 3;
    const hasPermission =
      isOwner ||
      isStaffOverride ||
      global.permissions.hasGuildPermissionTo(guild, account.id, 'ADMINISTRATOR', null) ||
      global.permissions.hasGuildPermissionTo(guild, account.id, 'MANAGE_GUILD', null);

    if (hasPermission) {
      const banRows: any[] = await prisma.$queryRaw`
        SELECT user_id 
        FROM bans 
        WHERE user_id = ${application.bot.id} 
          AND guild_id = ${guild.id} 
        LIMIT 1
      `;

      if (banRows.length > 0) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
      }

      try {
        await prisma.member.create({
          data: {
            user_id: application.bot.id,
            guild_id: guild.id,
            joined_at: new Date().toISOString(),
            roles: [],
            nick: null,
            deaf: false,
            mute: false
          }
        });

        await dispatcher.dispatchEventTo(application.bot.id, 'GUILD_CREATE', guild);
        await dispatcher.dispatchEventInGuild(guild, 'GUILD_MEMBER_ADD', {
          roles: [],
          user: globalUtils.miniBotObject(application.bot),
          guild_id: guild.id,
          joined_at: new Date().toISOString(),
          deaf: false,
          mute: false,
          nick: null,
        });

        const activeSessions = dispatcher.getAllActiveSessions();

        for (const session of activeSessions) {
          if (session.subscriptions && session.subscriptions[guild.id]) {
            //if (session.user.id === application.bot.id) continue;

            await lazyRequest.handleMemberAdd(session, guild, {
              user: globalUtils.miniBotObject(application.bot),
              roles: [],
              joined_at: new Date().toISOString(),
              deaf: false,
              mute: false,
              nick: null,
            });
          }

          await dispatcher.dispatchEventInGuild(guild, 'PRESENCE_UPDATE', {
            ...globalUtils.getUserPresence({
              user: globalUtils.miniUserObject(application.bot),
            }),
            roles: [],
            guild_id: guild.id,
          });
        }
      } catch {}

      return res.json({ location: `${req.protocol}://${req.get('host')}/oauth2/authorized` });
    } else {
      return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
    }
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
