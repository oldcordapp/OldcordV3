import { Router } from 'express';

import { logText } from '../helpers/utils/logger.ts';
import { staffAccessMiddleware } from '../helpers/middlewares.js';
const router = Router({ mergeParams: true });
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import dispatcher from '../helpers/dispatcher.js';
import errors from '../helpers/consts/errors.js';
import globalUtils from '../helpers/utils/globalutils.js';
/*
  PRIVILEGE:
    1 - (JANITOR) [Can only flag things for review],
    2 - (MODERATOR) [Can only delete messages, mute users, and flag things for review],
    3 - (ADMIN) [Free reign, can review flags, disable users, delete servers, etc],
    4 - (INSTANCE OWNER) - [Can add new admins, manage staff, etc]
*/

router.param('userid', async (req, res, next, userid) => {
  req.user = await global.database.getAccountByUserId(userid);
  req.is_user_staff = req.user && (req.user.flags & (1 << 0)) === 1 << 0;

  if (req.user != null && req.is_user_staff)
    req.user_staff_details = await global.database.getStaffDetails(req.user.id);

  next();
});

router.get('/users/:userid', staffAccessMiddleware(3), async (req, res) => {
  try {
    const userid = req.params.userid;

    if (!userid) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    const [userRet, guilds] = await Promise.all([
      global.database.getAccountByUserId(userid),
      global.database.getUsersGuilds(userid),
    ]); //to-do: make a lite function which just gets the name, id, icon from the database - makes no sense fetching the whole guild object then only using like 3 things from it to fetch it later

    if (!userRet) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (userRet.bot) {
      return res.status(400).json(errors.response_400.ADMIN_USE_BOT_TAB);
    } //This is because it has application info, etc

    const bots = await global.database.getUsersBots(userRet);

    const userRetTotal = {
      ...userRet,
      guilds,
      bots,
    };

    return res
      .status(200)
      .json(
        globalUtils.sanitizeObject(userRetTotal, [
          'settings',
          'token',
          'password',
          'disabled_until',
          'disabled_reason',
        ]),
      );
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/bots/:userid', staffAccessMiddleware(3), async (req, res) => {
  try {
    const userid = req.params.userid;

    if (!userid) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    } // there is no point renaming this shit tbh

    const [userRet, guilds] = await Promise.all([
      global.database.getBotByUserId(userid),
      global.database.getUsersGuilds(userid),
    ]);

    if (!userRet) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    }

    const userWithGuilds = {
      ...userRet,
      guilds,
    };

    return res.status(200).json(userWithGuilds);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/guilds/:guildid', staffAccessMiddleware(3), async (req, res) => {
  try {
    const guildid = req.params.guildid;

    if (!guildid) {
      return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
    }

    const guildRet = await global.database.getGuildById(guildid);

    if (!guildRet) {
      return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
    }

    const owner = await global.database.getAccountByUserId(guildRet.owner_id);

    if (owner != null) {
      guildRet.owner = globalUtils.miniUserObject(owner);
    } //this fucking sucks ass and we need to fix this ASAP.

    return res.status(200).json(guildRet);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/@me', staffAccessMiddleware(1), async (req, res) => {
  try {
    const ret = req.account;

    ret.staff_details = req.staff_details;
    ret.needs_mfa = global.config.mfa_required_for_admin;

    return res
      .status(200)
      .json(
        globalUtils.sanitizeObject(ret, [
          'settings',
          'token',
          'password',
          'relationships',
          'disabled_until',
          'disabled_reason',
        ]),
      );
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/reports', staffAccessMiddleware(1), async (req, res) => {
  try {
    const reports = await global.database.getInstanceReports();

    return res.status(200).json(reports);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.patch('/reports/:reportid', staffAccessMiddleware(1), async (req, res) => {
  try {
    const reportid = req.params.reportid;

    if (!reportid) {
      return res.status(404).json(errors.response_404.UNKNOWN_REPORT); // make our own error codes for these
    }

    const action = req.body.action;

    if (!action) {
      return res.status(400).json({
        ...errors.response_400.INVALID_FORM_BODY,
        missing_field: 'action',
      });
    }

    const valid_states = ['approved', 'discarded'];

    if (!valid_states.includes(action.toLowerCase())) {
      return res.status(400).json(errors.response_400.INVALID_ACTION_STATE);
    }

    const tryUpdateReport = await global.database.updateReport(reportid, action.toUpperCase());

    if (!tryUpdateReport) {
      return res.status(404).json(errors.response_404.UNKNOWN_REPORT);
    }

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/guilds/:guildid', staffAccessMiddleware(3), async (req, res) => {
  try {
    const guildid = req.params.guildid;

    if (!guildid) {
      return res.status(400).json(errors.response_404.UNKNOWN_GUILD);
    }

    const guildRet = await global.database.getGuildById(guildid);

    if (!guildRet) {
      return res.status(400).json(errors.response_404.UNKNOWN_GUILD);
    }

    await global.database.deleteGuild(guildid);

    await dispatcher.dispatchEventInGuild(guildRet, 'GUILD_DELETE', {
      id: req.params.guildid,
    });

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/users/:userid/moderate/disable', staffAccessMiddleware(3), async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res
        .status(404)
        .json(user.bot ? errors.response_404.UNKNOWN_BOT : errors.response_404.UNKNOWN_USER);
    } //yeah that is another problem to solve

    if (user.id === req.account.id || req.is_user_staff) {
      //Should we allow them to disable other staff members?
      return res
        .status(404)
        .json(user.bot ? errors.response_404.UNKNOWN_BOT : errors.response_404.UNKNOWN_USER);
    }

    if (user.disabled_until) {
      return res
        .status(403)
        .json(user.bot ? errors.response_403.BOT_DISABLED : errors.response_403.ACCOUNT_DISABLED);
    }

    const until = req.body.disabled_until;

    if (!until) {
      return res.status(400).json({
        ...errors.response_400.INVALID_FORM_BODY,
        missing_field: 'disabled_until',
      });
    }

    const audit_log_reason = req.body.internal_reason;

    if (!audit_log_reason) {
      return res.status(400).json({
        ...errors.response_400.INVALID_FORM_BODY,
        missing_field: 'internal_reason',
      });
    }

    const tryDisable = await global.database.internalDisableAccount(
      req.staff_details,
      req.params.userid,
      until ?? 'FOREVER',
      audit_log_reason,
    );

    if (!tryDisable) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    await dispatcher.dispatchLogoutTo(req.params.userid);

    return res.status(200).json(tryDisable);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/staff', staffAccessMiddleware(4), async (req, res) => {
  try {
    const staff = await global.database.getInstanceStaff();

    return res.status(200).json(staff);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/staff/audit-logs', staffAccessMiddleware(4), async (req, res) => {
  try {
    const audit_logs = await global.database.getStaffAuditLogs();

    return res.status(200).json(audit_logs);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/staff', staffAccessMiddleware(4), async (req, res) => {
  try {
    const user_id = req.body.user_id;
    const privilege = req.body.privilege;

    if (!user_id) {
      return res.status(400).json({
        ...errors.response_400.INVALID_FORM_BODY,
        missing_field: 'user_id',
      });
    }

    if (!privilege) {
      return res.status(400).json({
        ...errors.response_400.INVALID_FORM_BODY,
        missing_field: 'privilege',
      });
    }

    if (privilege > 3 || privilege <= 0) {
      return res.status(400).json(errors.response_400.INVALID_PRIVILEGE);
    }

    req.user = await global.database.getAccountByUserId(user_id);

    if (!req.user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    req.is_user_staff = req.user && (req.user.flags & (1 << 0)) === 1 << 0;

    if (req.is_user_staff) {
      return res.status(400).json({
        code: 400,
        message: 'This user is already staff.',
      });
    }

    const tryAddStaff = await global.database.addInstanceStaff(req.user, privilege);

    if (!tryAddStaff) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    const new_staff = await global.database.getInstanceStaff();

    return res.status(200).json(new_staff);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/staff/:userid', staffAccessMiddleware(4), async (req, res) => {
  try {
    const user = req.user;
    const privilege = req.body.privilege;

    if (!user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (user.id === req.account.id || !req.is_user_staff) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    const tryUpdateStaff = await global.database.updateInstanceStaff(user, privilege);

    if (!tryUpdateStaff) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    const new_staff = await global.database.getInstanceStaff();

    return res.status(200).json(new_staff);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/staff/:userid', staffAccessMiddleware(4), async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (user.id === req.account.id || !req.is_user_staff) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    await global.database.removeFromStaff(user);

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/staff/:userid/audit-logs', staffAccessMiddleware(4), async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (user.id === req.account.id || !req.is_user_staff) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    await global.database.clearStaffAuditLogs(user.id);

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/messages', staffAccessMiddleware(2), async (req, res) => {
  try {
    let channelId = req.query.channelId;
    let messageId = req.query.messageId;
    let context = req.query.context;
    let cdnLink = req.query.cdnLink;
    let message;

    const normalizeParam = (param) => {
      if (param === 'null' || param === 'undefined' || param === '') {
        return null;
      }
      return param;
    };

    channelId = normalizeParam(channelId);
    messageId = normalizeParam(messageId);
    context = normalizeParam(context);
    cdnLink = normalizeParam(cdnLink);

    if (!channelId && !messageId && !cdnLink) {
      return res.status(400).json({
        ...errors.response_400.PARAM_MISSING,
        missing_params: ['channelId', 'messageId', 'cdnLink'],
      });
    }

    if (cdnLink) {
      message = await global.database.getMessageByCdnLink(cdnLink);

      if (message == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      messageId = message.id;
      channelId = message.channel_id;
    }

    if (messageId) {
      message = await global.database.getMessageById(messageId);

      if (message == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      if (!channelId) {
        channelId = message.channel_id;
      }
    }

    if (!channelId) {
      return res.status(400).json({
        ...errors.response_400.PARAM_MISSING,
        missing_param: 'channelId',
      });
    }

    const channel = await global.database.getChannelById(channelId);

    if (!channel) {
      return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
    }

    const retMessages = [];

    const targetMessageId = messageId || null;

    const messagesBefore = await global.database.getChannelMessages(
      channelId,
      '',
      25,
      targetMessageId,
      null,
      false,
    );

    retMessages.push(...messagesBefore);

    if (message != null) {
      retMessages.push(message);
    }

    const messagesAfter = await global.database.getChannelMessages(
      channelId,
      '',
      25,
      null,
      targetMessageId,
      false,
    );

    retMessages.push(...messagesAfter);

    const uniqueMessagesMap = new Map();

    for (const msg of retMessages) {
      uniqueMessagesMap.set(msg.id, msg);
    }

    const finalMessages = Array.from(uniqueMessagesMap.values());

    finalMessages.sort((a, b) => a.id.localeCompare(b.id));

    return res.status(200).json(finalMessages);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/messages/:messageid', staffAccessMiddleware(2), async (req, res) => {
  try {
    const messageid = req.params.messageid;

    if (!messageid) {
      return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
    }

    const msgRet = await global.database.getMessageById(messageid);

    if (!msgRet) {
      return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
    }

    const guildRet = await global.database.getGuildById(msgRet.guild_id);

    if (!guildRet) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    await global.database.deleteMessage(messageid);

    await dispatcher.dispatchEventInGuild(guildRet, 'MESSAGE_DELETE', {
      id: msgRet.id,
      guild_id: msgRet.guild_id,
      channel_id: msgRet.channel_id,
    });

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/users/:userid/moderate/delete', staffAccessMiddleware(3), async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res
        .status(404)
        .json(user.bot ? errors.response_404.UNKNOWN_BOT : errors.response_404.UNKNOWN_USER);
    }

    if (user.id === req.account.id || req.is_user_staff) {
      return res
        .status(404)
        .json(user.bot ? errors.response_404.UNKNOWN_BOT : errors.response_404.UNKNOWN_USER);
    }

    const audit_log_reason = req.body.internal_reason;

    if (!audit_log_reason) {
      return res
        .status(400)
        .json(user.bot ? errors.response_404.UNKNOWN_BOT : errors.response_404.UNKNOWN_USER);
    }

    if (user.bot) {
      await global.database.deleteBotById(req.params.userid);
      await dispatcher.dispatchLogoutTo(req.params.userid);

      return res.status(204).send();
    }

    const tryDisable = await global.database.internalDeleteAccount(
      req.staff_details,
      req.params.userid,
      audit_log_reason,
    );

    if (!tryDisable) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    await dispatcher.dispatchLogoutTo(req.params.userid);

    return res.status(200).json(tryDisable);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/settings', staffAccessMiddleware(4), async (req, res) => {
  try {
    const configFile = readFileSync(join(process.cwd(), 'config.json'), {
      encoding: 'utf-8',
    });

    const configJson = JSON.parse(configFile);

    return res.status(200).json(configJson);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/settings', staffAccessMiddleware(4), async (req, res) => {
  try {
    const settingsToChange = req.body;

    const configFile = join(process.cwd(), 'config.json');

    const configJson = JSON.parse(readFileSync(configFile, { encoding: 'utf-8' }));

    for (const key in settingsToChange) {
      if (settingsToChange.hasOwnProperty(key)) {
        configJson[key] = settingsToChange[key];
      }
    }

    writeFileSync(configFile, JSON.stringify(configJson, null, 2), {
      encoding: 'utf-8',
      flag: 'w',
    });

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
