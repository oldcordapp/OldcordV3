import { Router, type NextFunction } from 'express';
import type { Prisma } from '../generated/prisma/client/client.ts';

import { logText } from '../helpers/logger.ts';
import { staffAccessMiddleware } from '../helpers/middlewares.ts';
const router = Router({ mergeParams: true });
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import dispatcher from '../helpers/dispatcher.ts';
import errors from '../helpers/errors.ts';
import globalUtils from '../helpers/globalutils.ts';
import { prisma } from '../prisma.ts';
import { deconstruct, generate } from '../helpers/snowflake.ts';
//PRIVILEGE: 1 - (JANITOR) [Can only flag things for review], 2 - (MODERATOR) [Can only delete messages, mute users, and flag things for review], 3 - (ADMIN) [Free reign, can review flags, disable users, delete servers, etc], 4 - (INSTANCE OWNER) - [Can add new admins, manage staff, etc]

interface PublicAccount {
  id: string;
  username: string;
  email: string;

  staff_details?: unknown;
  needs_mfa: boolean;
}

router.param('userid', async (req: any, _res: any, next: NextFunction, userid: string) => {
  req.user = await prisma.user.findUnique({
    where: {
      id: userid,
    },
    include: {
      staff: true,
    },
  } as any);

  req.is_user_staff = req.user && (req.user.flags & (1 << 0)) === 1 << 0;

  if (req.user != null && req.is_user_staff)
    req.user_staff_details = req.user.staff;

  next();
});

router.get('/users/:userid', staffAccessMiddleware(3), async (req: any, res: any) => {
  try {
    const userid = req.params.userid;

    if (!userid) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    const [userRet, guilds] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userid },
        select: {
            id: true,
            username: true,
            discriminator: true,
            email: true,
            verified: true,
            claimed: true,
            mfa_enabled: true,
            premium: true,
            created_at: true,
            avatar: true,
            bot: true,
            flags: true,
            registration_ip: true,
            last_login_ip: true,
            private_channels: true,
            guild_settings: true,
         }
      }),

      prisma.guild.findMany({
        where: {
          members: {
            some: { user_id: userid }
          }
        },
        select: {
          id: true,
          name: true,
          icon: true
        }
      } as any)
    ]); //guys. you wont believe what i just found out

    if (!userRet) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (userRet.bot) {
      return res.status(400).json(errors.response_400.ADMIN_USE_BOT_TAB);
    } //This is because it has application info, etc

    const bots = await prisma.bot.findMany({
      where: {
        application: {
          owner_id: userRet.id
        }
      },
      include: {
        application: {
          include: {
            owner: true
          }
        }
      }
    } as any);

    const formattedBots = bots.map((bot: any) => ({
      avatar: bot.avatar,
      discriminator: bot.discriminator,
      username: bot.username,
      id: bot.id,
      public: bot.public,
      require_code_grant: bot.require_code_grant,
      application: {
        id: bot.application?.id,
        name: bot.application?.name,
        icon: bot.application?.icon,
        description: bot.application?.description,
        redirect_uris: [],
        rpc_application_state: 0,
        rpc_origins: [],
        owner: bot.application?.owner?.toPublic()
      },
    }));


    const userRetTotal = {
      ...userRet,
      guilds,
      formattedBots,
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

type ApplicationWithOwner = Prisma.ApplicationGetPayload<{
  select: {
    id: true;
    owner_id: true;
    name: true;
    icon: true;
    description: true;
  };
  include: {
    owner: true;
  };
}>;

router.get('/bots/:userid', staffAccessMiddleware(3), async (req: any, res: any) => {
  try {
    const userid = req.params.userid;

    if (!userid) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    } // there is no point renaming this shit tbh

    const [userRet, guilds]: [ApplicationWithOwner | null, Prisma.GuildGetPayload<{
      select: {
        id: true;
        name: true;
        icon: true;
      }
    }>[]] = await Promise.all([
      prisma.application.findUnique({
        where: {
          id: userid
        },
        select: {
          id: true,
          owner_id: true,
          name: true,
          icon: true,
          description: true,
          botId: true,
        },
        include: {
          owner: true,
          bot: true,
        },
      }),

      prisma.guild.findMany({
        where: {
          members: {
            some: { user_id: userid }
          }
        },
        select: {
          id: true,
          name: true,
          icon: true
        }
      }),
    ]);

    if (!userRet) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    }

    if (userRet.owner != null) {
      userRet.owner = globalUtils.miniUserObject(userRet.owner);
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

router.get('/guilds/:guildid', staffAccessMiddleware(3), async (req: any, res: any) => {
  try {
    const guildid = req.params.guildid;

    if (!guildid) {
      return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
    }

    const guildRet = await prisma.guild.findUnique({
      where: {
        id: guildid
      }
    });

    if (!guildRet) {
      return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
    }

    const owner = await prisma.user.findUnique({
      where: {
        id: guildRet.owner_id
      }
    });

    let guildWithOwner: any = guildRet;
    if (owner != null) {
      guildWithOwner.owner = globalUtils.miniUserObject(owner);
    } //this fucking sucks ass and we need to fix this ASAP.

    return res.status(200).json(guildWithOwner);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

function toPublicAccount(account: PublicAccount, staffDetails: unknown, needsMfa: boolean): PublicAccount {
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    staff_details: staffDetails,
    needs_mfa: needsMfa,
  };
}

router.get('/@me', staffAccessMiddleware(1), async (req: any, res: any): Promise<Response> => {
  try {
    const publicAccount = toPublicAccount(
      req.account,
      req.staff_details,
      global.config.mfa_required_for_admin as boolean
    );

    return res.status(200).json(publicAccount);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/reports', staffAccessMiddleware(1), async (_req: any, res: any) => {
  try {
    const reports = await prisma.instanceReport.findMany({
      where: {
        action: 'PENDING'
      }
    });

    return res.status(200).json(reports);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.patch('/reports/:reportid', staffAccessMiddleware(1), async (req: any, res: any) => {
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

    const tryUpdateReport = await prisma.instanceReport.update({
      where: {
        id: reportid
      },
      data: {
        action: action.toUpperCase()
      }
    });

    if (!tryUpdateReport) {
      return res.status(404).json(errors.response_404.UNKNOWN_REPORT);
    }

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/guilds/:guildid', staffAccessMiddleware(3), async (req: any, res: any) => {
  try {
    const guildid = req.params.guildid;

    if (!guildid) {
      return res.status(400).json(errors.response_404.UNKNOWN_GUILD);
    }

    const guildRet = await prisma.guild.findUnique({
      where: {
        id: guildid
      }
    });

    if (!guildRet) {
      return res.status(400).json(errors.response_404.UNKNOWN_GUILD);
    }

    const deletedGuild = await prisma.guild.delete({
      where: { id: guildid },
      include: {
        members: true
      }
    } as any);

    await dispatcher.dispatchEventInGuild(deletedGuild, 'GUILD_DELETE', {
      id: guildid,
    });

    return res.status(204).send();
  } catch (error: any) {
    if (error.code && error.code === 'P2025') {
      return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
    }

    logText(error, 'error');
    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/users/:userid/moderate/disable', staffAccessMiddleware(3), async (req: any, res: any) => {
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

    try {
      if (user.id === req.staff_details.user_id || user.id === '643945264868098049') {
        return false;
      } // Safety net

      let disabled_until = until ?? 'FOREVER';
      let disabled_reason = req.body.disabled_reason || audit_log_reason;

      await prisma.user.update({
        where: {
          id: req.params.userid
        },
        data: {
          disabled_until: disabled_until,
          disabled_reason: disabled_reason
        }
      });  //to-do actually do this properly

      const audit_log = req.staff_details.audit_log;
      const moderation_id = generate();
      const deconstructed =  deconstruct(moderation_id);
      const timestamp = deconstructed.date.toISOString();

      const audit_entry = {
        moderation_id: moderation_id,
        timestamp: timestamp,
        action: 'disable_user',
        moderated: {
          id: req.params.userid,
          until_forever: disabled_until === 'FOREVER',
          until_when: disabled_until, // Storing the text 'FOREVER' or actual date in the audit log
        },
        reasoning: audit_log_reason,
      };

      audit_log.push(audit_entry);

      await prisma.staff.update({
        where: {
          user_id: req.staff_details.user_id
        },
        data: {
          audit_log: audit_log
        }
      })

      await dispatcher.dispatchLogoutTo(req.params.userid);

      return res.status(200).json(audit_entry);
    } catch (error) {
      logText(error, 'error');
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/staff', staffAccessMiddleware(4), async (_req: any, res: any) => {
  try {
    const staffMembers = await prisma.staff.findMany({
      select: {
        privilege: true,
        audit_log: true,
        user: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            avatar: true,
          }
        }
      }
    });

    return res.status(200).json(staffMembers.map(s => ({
      id: s.user.id,
      username: s.user.username,
      discriminator: s.user.discriminator,
      avatar: s.user.avatar,
      staff_details: {
        privilege: s.privilege,
        audit_log: s.audit_log ?? [],
      },
    })));
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/staff/audit-logs', staffAccessMiddleware(4), async (_req: any, res: any) => {
  try {
    const staffWithLogs = await prisma.staff.findMany({
      where: {
        audit_log: {
          not: {
            equals: []
          }
        }
      },
      select: {
        audit_log: true,
        user: {
          select: {
            id: true,
            username: true,
            discriminator: true,
          }
        }
      }
    });

    return res.status(200).json(staffWithLogs.flatMap((staff) => {
      const entries = (staff.audit_log as any[]) ?? [];

      return entries.map((logEntry) => ({
        ...logEntry,
        actioned_by: {
          id: staff.user.id,
          username: staff.user.username,
          discriminator: staff.user.discriminator,
        },
      }));
    }));
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/staff', staffAccessMiddleware(4), async (req: any, res: any) => {
  try {
    const { user_id, privilege } = req.body;

    if (!user_id || !privilege) {
      return res.status(400).json({
        ...errors.response_400.INVALID_FORM_BODY,
        missing_field: !user_id ? 'user_id' : 'privilege',
      });
    }

    if (privilege > 3 || privilege <= 0) {
      return res.status(400).json(errors.response_400.INVALID_PRIVILEGE);
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: user_id },
      select: { id: true, flags: true }
    });

    if (!targetUser) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    const isAlreadyStaff = (Number(targetUser.flags || 0) & 1) !== 0;

    if (isAlreadyStaff) {
      return res.status(400).json({
        code: 400,
        message: 'This user is already staff.',
      });
    }

    const newStaffEntry = await prisma.$transaction(async (tx) => {
      await tx.user.update({
          where: { id: user_id },
          data: {
            flags: (targetUser.flags || 0) | 1
          }
      });

      return await tx.staff.create({
          data: {
            user_id: user_id,
            privilege: privilege,
            audit_log: [],
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                discriminator: true,
                avatar: true
              }
            }
          }
        });
    });

    return res.status(200).json({
      id: newStaffEntry.user.id,
      username: newStaffEntry.user.username,
      discriminator: newStaffEntry.user.discriminator,
      avatar: newStaffEntry.user.avatar,
      staff_details: {
        privilege: newStaffEntry.privilege,
        audit_log: newStaffEntry.audit_log,
      }
    });
  } catch (error) {
    logText(error, 'error');
    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/staff/:userid', staffAccessMiddleware(4), async (req: any, res: any) => {
  try {
    const { user, account, is_user_staff } = req;
    const { privilege } = req.body;

    if (!user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (user.id === account.id || !is_user_staff) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (!privilege || privilege > 3 || privilege <= 0) {
      return res.status(400).json(errors.response_400.INVALID_PRIVILEGE);
    }

    const updatedStaff = await prisma.staff.update({
      where: {
        user_id: user.id
      },
      data: {
        privilege: privilege
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            discriminator: true,
            avatar: true
          }
        }
      }
    });

    return res.status(200).json({
      id: updatedStaff.user.id,
      username: updatedStaff.user.username,
      discriminator: updatedStaff.user.discriminator,
      avatar: updatedStaff.user.avatar,
      staff_details: {
        privilege: updatedStaff.privilege,
        audit_log: updatedStaff.audit_log,
      },
    });

  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    logText(error, 'error');
    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/staff/:userid', staffAccessMiddleware(4), async (req: any, res: any) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (user.id === req.account.id || !req.is_user_staff) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    await prisma.$transaction([
      prisma.staff.delete({
        where: { user_id: user.id }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          flags: (Number(user.flags || 0) & ~1)
        }
      })
    ]);

    return res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
       return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/staff/:userid/audit-logs', staffAccessMiddleware(4), async (req: any, res: any) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (user.id === req.account.id || !req.is_user_staff) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    await prisma.staff.update({
      where: {
        user_id: user.id
      },
      data: {
        audit_log: []
      }
    })

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/messages', staffAccessMiddleware(2), async (req: any, res: any) => {
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
      const message = await prisma.message.findFirst({
        where: {
          attachments: {
            some: {
              url: cdnLink
            }
          }
        },
        include: {
          attachments: true
        }
      });

      if (message == null) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      messageId = message.message_id;
      channelId = message.channel_id;
    }

    if (messageId) {
      message = await prisma.message.findUnique({
        where: {
          message_id: messageId
        }
      });

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

    const channel = await prisma.channel.findUnique({
      where: {
        id: channelId
      }
    });

    if (!channel) {
      return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
    }

    const retMessages: any = [];
    const targetMessageId = messageId || null;
    const messagesBefore = await globalUtils.getChannelMessages(
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

    const messagesAfter = await globalUtils.getChannelMessages(
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

router.delete('/messages/:messageid', staffAccessMiddleware(2), async (req: any, res: any) => {
  try {
    const messageid = req.params.messageid;

    if (!messageid) {
      return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
    }

    const deletedMsg = await prisma.message.delete({
      where: { message_id: messageid },
      select: {
        message_id: true,
        guild_id: true,
        channel_id: true
      },
    });

    const guildRet = await prisma.guild.findUnique({
      where: {
        id: deletedMsg.guild_id!
      },
      include: {
        members: true
      }
    } as any);

    if (!guildRet) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    await dispatcher.dispatchEventInGuild(guildRet, 'MESSAGE_DELETE', {
      id: deletedMsg.message_id,
      guild_id: deletedMsg.guild_id,
      channel_id: deletedMsg.channel_id,
    });

    return res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
    }

    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/users/:userid/moderate/delete', staffAccessMiddleware(3), async (req: any, res: any) => {
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
      await prisma.$transaction([
        prisma.bot.delete({ where: { id: req.params.userid } }),
        prisma.application.delete({ where: { id: req.params.userid } })
      ]);

      await dispatcher.dispatchLogoutTo(req.params.userid);

      return res.status(204).send();
    }

    try {
      if (req.params.userid === req.staff_details.user_id || req.params.userid === '643945264868098049') {
        return false;
      } // Safety net

      await prisma.user.delete({
        where: {
          id: req.params.userid
        }
      }); //figure out messages

      const audit_log = req.staff_details.audit_log;
      const moderation_id = generate();
      const deconstructed = deconstruct(moderation_id);
      const timestamp = deconstructed.date.toISOString();

      const audit_entry = {
        moderation_id: moderation_id,
        timestamp: timestamp,
        action: 'delete_user',
        moderated: {
          id: req.params.userid,
        },
        reasoning: audit_log_reason,
      };

      audit_log.push(audit_entry);

      await prisma.staff.update({
        where: {
          user_id: req.staff_details.user_id
        },
        data: {
          audit_log: audit_log
        }
      })

      await dispatcher.dispatchLogoutTo(req.params.userid);

      return res.status(200).json(audit_entry);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/settings', staffAccessMiddleware(4), async (_req: any, res: any) => {
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

router.post('/settings', staffAccessMiddleware(4), async (req: any, res: any) => {
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
