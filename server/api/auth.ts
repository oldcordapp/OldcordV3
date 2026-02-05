import { Router } from 'express';
const router = Router();
import dispatcher from '../helpers/dispatcher.js';
import errors from '../helpers/errors.js';
import globalUtils, { config } from '../helpers/globalutils.js';
import lazyRequest from '../helpers/lazyRequest.js';
import { logText } from '../helpers/logger.ts';
import { instanceMiddleware, rateLimitMiddleware } from '../helpers/middlewares.js';
import { verify } from '../helpers/recaptcha.js';
import Watchdog from '../helpers/watchdog.ts';

import { totp } from 'speakeasy';

import { prisma } from '../prisma.ts';
import { hash, genSalt, compareSync } from 'bcrypt';
import { generate } from '../helpers/snowflake.js';
import { generateToken, generateString } from '../helpers/globalutils.js';

global.config = globalUtils.config;

router.post(
  '/register',
  instanceMiddleware('NO_REGISTRATION'),
  rateLimitMiddleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
    2,
  ),
  async (req: any, res: any) => {
    try {
      const release_date = req.client_build;

      if (req.header('referer').includes('/invite/')) {
        req.body.email = null;
        req.body.password = null;
      } else {
        if (!req.body.email) {
          if (release_date == 'june_12_2015') {
            req.body.email = `june_12_2015_app${globalUtils.generateString(10)}@oldcordapp.com`;
          } else {
            return res.status(400).json({
              code: 400,
              email: 'This field is required',
            });
          }
        }

        if (!req.body.email.includes('@')) {
          return res.status(400).json({
            code: 400,
            email: 'This field is required',
          });
        }

        const emailAddr = req.body.email.split('@')[0];

        if (
          emailAddr.length < global.config.limits['email'].min ||
          emailAddr.length >= global.config.limits['email'].max
        ) {
          return res.status(400).json({
            code: 400,
            email: `Must be between ${global.config.limits['email'].min} and ${global.config.limits['email'].max} characters.`,
          });
        }

        const badEmail = await globalUtils.badEmail(req.body.email); //WHO THE FUCK MOVED THIS??

        if (badEmail) {
          return res.status(400).json({
            code: 400,
            email: 'That email address is not allowed. Try another.',
          });
        }

        if (!req.body.password) {
          if (release_date == 'june_12_2015') {
            req.body.password = globalUtils.generateString(20);
          } else {
            return res.status(400).json({
              code: 400,
              password: 'This field is required',
            });
          }
        } else {
          if (
            release_date != 'june_12_2015' &&
            (req.body.password.length < global.config.limits['password'].min ||
              req.body.password.length >= global.config.limits['password'].max)
          ) {
            return res.status(400).json({
              code: 400,
              password: `Must be between ${global.config.limits['password'].min} and ${global.config.limits['password'].max} characters.`,
            });
          }
        }
      }

      if (!req.body.username) {
        return res.status(400).json({
          code: 400,
          username: 'This field is required',
        });
      }

      if (
        req.body.username.length < global.config.limits['username'].min ||
        req.body.username.length >= global.config.limits['username'].max
      ) {
        return res.status(400).json({
          code: 400,
          username: `Must be between ${global.config.limits['username'].min} and ${global.config.limits['username'].max} characters.`,
        });
      }

      const goodUsername = globalUtils.checkUsername(req.body.username);

      if (goodUsername.code !== 200) {
        return res.status(goodUsername.code).json(goodUsername);
      }

      //Before July 2016 Discord had no support for Recaptcha.
      //We get around this by redirecting clients on 2015/2016 who wish to make an account to a working 2018 client then back to their original clients after they make their account/whatever.

      if (global.config.captcha_config.enabled) {
        if (req.body.captcha_key === undefined || req.body.captcha_key === null) {
          return res.status(400).json({
            captcha_key: 'Captcha is required.',
          });
        }

        const verifyAnswer = await verify(req.body.captcha_key);

        if (!verifyAnswer) {
          return res.status(400).json({
            captcha_key: 'Invalid captcha response.',
          });
        }
      }

      let emailToken: string | null = globalUtils.generateString(60);

      if (!global.config.email_config.enabled) {
        emailToken = null;
      }

      const userCount = await prisma.user.count({
        where: { username: req.body.username }
      });

      if (userCount >= 9999) {
        return res.status(400).json({
          code: 400,
          username: 'Too many people have this username.',
        });
      }

      const salt = await genSalt(10);
      const pwHash = await hash(req.body.password || generateString(20), salt);
      const id = generate(); // Snowflake ID
      const date = new Date().toISOString();
      const token = generateToken(id, pwHash);

      let discriminator = Math.floor(Math.random() * 9999);

      while (discriminator < 1000) {
        discriminator = Math.floor(Math.random() * 9999);
      }

      let newUser;

      try {
        newUser = await prisma.user.create({
          data: {
            id: id,
            username: req.body.username,
            discriminator: discriminator.toString(),
            email: req.body.email,
            password: req.body.password ? pwHash : null,
            token: token,
            created_at: date,
            registration_ip: req.ip ?? null,
            verified: config.email_config.enabled ? false : true,
            email_token: emailToken ?? null,
            settings: {
              show_current_game: false,
              inline_attachment_media: true,
              inline_embed_media: true,
              render_embeds: true,
              render_reactions: true,
              sync: true,
              theme: "dark",
              enable_tts_command: true,
              message_display_compact: false,
              locale: "en-US",
              convert_emoticons: true,
              restricted_guilds: [],
              allow_email_friend_request: false,
              friend_source_flags: { all: true },
              developer_mode: true,
              guild_positions: [],
              detect_platform_accounts: false,
              status: "online"
            }
          }
        });
      } catch (error: any) {
        if (error.code === 'P2002') {
          return res.status(400).json({ code: 400, email: 'Email is already registered.' });
        }

        throw error;
      }

      if (newUser == null) {
        return res.status(401).json(errors.response_401.UNAUTHORIZED);
      }

      if (emailToken != null) {
        await global.emailer.sendRegistrationEmail(req.body.email, emailToken, newUser);
      }

      if (req.body.invite) {
        const invite = await prisma.invite.findUnique({
          where: {
            code: req.body.invite
          },
          include: {
            guild: {
              include: { 
                channels: true, 
                roles: true,
                members: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        });

        if (invite && invite.guild) {
          await prisma.member.create({
            data: {
              user_id: newUser.id,
              guild_id: invite.guild_id!,
              joined_at: new Date().toISOString(),
              roles: [],
              nick: null,
              deaf: false,
              mute: false
            }
          });

          await prisma.invite.update({
            where: { code: req.body.invite },
            data: {
              uses: { increment: 1 }
            }
          });

          await dispatcher.dispatchEventTo(newUser.id, 'GUILD_CREATE', invite.guild);

          await dispatcher.dispatchEventInGuild(invite.guild, 'GUILD_MEMBER_ADD', {
            roles: [],
            user: globalUtils.miniUserObject(newUser),
            guild_id: invite.guild.id,
            joined_at: new Date().toISOString(),
            deaf: false,
            mute: false,
            nick: null,
          });

          const activeSessions = dispatcher.getAllActiveSessions();

          for (const session of activeSessions) {
            if (session.subscriptions && session.subscriptions[invite.guild.id]) {
              //if (session.user.id === account.id) continue;

              await lazyRequest.handleMemberAdd(session, invite.guild, {
                user: globalUtils.miniUserObject(newUser),
                roles: [],
                joined_at: new Date().toISOString(),
                deaf: false,
                mute: false,
                nick: null,
              });
            }

            await dispatcher.dispatchEventInGuild(invite.guild, 'PRESENCE_UPDATE', {
              game_id: null,
              status: 'online',
              activities: [],
              roles: [],
              user: globalUtils.miniUserObject(newUser),
              guild_id: invite.guild.id,
            });

            if (invite.guild.system_channel_id != null) {
              const join_msg = await globalUtils.createSystemMessage(
                invite.guild.id,
                invite.guild.system_channel_id,
                7,
                [newUser],
              );

              await dispatcher.dispatchEventInChannel(
                invite.guild,
                invite.guild.system_channel_id,
                'MESSAGE_CREATE',
                join_msg,
              );
            }
          }
        }
      }

      const autoJoinGuild = config.instance.flags.filter((x) =>
        x.toLowerCase().includes('autojoin:'),
      );

      if (autoJoinGuild.length > 0) {
        const guildId = autoJoinGuild[0].split(':')[1];
        const guild = await prisma.guild.findUnique({
          where: {
            id: guildId
          },
          include: {
            channels: true,
            roles: true,
            members: {
              include: {
                user: true
              }
            }
          }
        });

        if (guild) {
          await prisma.member.create({
            data: {
              user_id: newUser.id,
              guild_id: guild.id,
              joined_at: new Date().toISOString(),
              roles: [],
              nick: null,
              deaf: false,
              mute: false
            }
          });

          await dispatcher.dispatchEventTo(newUser.id, 'GUILD_CREATE', guild);

          await dispatcher.dispatchEventInGuild(guild, 'GUILD_MEMBER_ADD', {
            roles: [],
            user: globalUtils.miniUserObject(newUser),
            guild_id: guildId,
            joined_at: new Date().toISOString(),
            deaf: false,
            mute: false,
            nick: null,
          });

          const activeSessions = dispatcher.getAllActiveSessions();

          for (const session of activeSessions) {
            if (session.subscriptions && session.subscriptions[guild.id]) {
              //if (session.user.id === account.id) continue;

              await lazyRequest.handleMemberAdd(session, guild, {
                user: globalUtils.miniUserObject(newUser),
                roles: [],
                joined_at: new Date().toISOString(),
                deaf: false,
                mute: false,
                nick: null,
              });
            }
          }

          await dispatcher.dispatchEventInGuild(guild, 'PRESENCE_UPDATE', {
            game_id: null,
            status: 'online',
            activities: [],
            roles: [],
            user: globalUtils.miniUserObject(newUser),
            guild_id: guildId,
          });

          if (guild.system_channel_id != null) {
            const join_msg = await globalUtils.createSystemMessage(
              guild.id,
              guild.system_channel_id,
              7,
              [newUser],
            );

            await dispatcher.dispatchEventInChannel(
              guild,
              guild.system_channel_id,
              'MESSAGE_CREATE',
              join_msg,
            );
          }
        }
      }

      return res.status(200).json({
        token: newUser.token,
      });
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post(
  '/login',
  rateLimitMiddleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
    0.75,
  ),
  async (req: any, res: any) => {
    try {
      if (req.body.login) {
        req.body.email = req.body.login;
      }

      if (!req.body.email) {
        return res.status(400).json({
          code: 400,
          email: 'This field is required',
        });
      }

      if (!req.body.password) {
        return res.status(400).json({
          code: 400,
          password: 'This field is required',
        });
      }

      const user = await prisma.user.findUnique({
        where: { email: req.body.email },
        include: { staff: true }
      });

      if (!user || !user.email || !user.password) {
        return res.status(400).json({
          code: 400,
          email: 'Email and/or password is invalid.',
          password: 'Email and/or password is invalid.',
        });
      }

      if (user.disabled_until != null) {
        return res.status(400).json({
          code: 400,
          email: 'This account has been disabled.',
        });
      }

      const isMatch = compareSync(req.body.password, user.password);

      if (!isMatch) {
        return res.status(400).json({
          code: 400,
          email: 'Email and/or password is invalid.',
          password: 'Email and/or password is invalid.',
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { last_login_ip: req.ip ?? null }
      });

      const loginAttempt = { token: user.token };

      if (req.headers['referer'] && req.headers['referer'].includes('redirect_to=%2Fadmin')) {
        const tryGetStaffDetails = user.staff;

        if (!tryGetStaffDetails) {
          console.log(
            `[${user.id}] ${user.username}#${user.discriminator} just tried to login to the Oldcord instance staff admin panel without permission. Further investigation necessary.`,
          );

          return res.status(400).json({
            code: 400,
            email: 'This account is not instance staff. This incident has been logged.',
          });
        }

        req.is_staff = true;
        req.staff_details = tryGetStaffDetails;
      }

      if (user.mfa_enabled && user.mfa_secret) {
        const mfaTicket = generateString(40);

        try {
          await prisma.mfaLoginTicket.create({
            data: {
              user_id: user.id,
              mfa_ticket: mfaTicket
            }
          });

          return res.status(200).json({
            mfa: true,
            ticket: mfaTicket,
            sms: false,
          });
        }
        catch (error) {
          logText(error, 'error');
          return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }
      }

      return res.status(200).json({
        token: loginAttempt.token,
        settings: {},
      });
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post(
  '/mfa/totp',
  rateLimitMiddleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
    0.2,
  ),
  async (req: any, res: any) => {
    try {
      const ticket = req.body.ticket;
      const code = req.body.code;

      if (!code || !ticket) {
        return res.status(400).json({
          code: 400,
          message: 'Invalid TOTP code',
        });
      }

      const ticketData = await prisma.mfaLoginTicket.findUnique({
        where: { mfa_ticket: ticket },
        include: { user: true }
      });

      if (!ticketData || !ticketData.user) {
        return res.status(400).json({ code: 400, message: 'Invalid ticket' });
      }

      const user = ticketData.user;

      if (!user.mfa_enabled || !user.mfa_secret) {
        return res.status(400).json({ code: 400, message: 'MFA not enabled' });
      }

      const valid = totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: code,
      });

      if (!valid) {
        return res.status(400).json({ code: 400, message: 'Invalid TOTP code' });
      }

      await prisma.mfaLoginTicket.delete({
        where: { mfa_ticket: ticket }
      });

      return res.status(200).json({
        token: user.token,
      });
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post(
  '/logout',
  rateLimitMiddleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
    0.4,
  ),
  async (_req: any, res: any) => {
    return res.status(204).send();
  },
);

router.post(
  '/forgot',
  rateLimitMiddleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
    0.4,
  ),
  async (req: any, res: any) => {
    try {
      const email = req.body.email;

      if (!email) {
        return res.status(400).json({
          code: 400,
          email: 'This field is required.',
        });
      }

      const account = await prisma.user.findUnique({
        where: {
          email: email
        }
      });

      if (!account) {
        return res.status(400).json({
          code: 400,
          email: 'Email does not exist.',
        });
      }

      if (account.disabled_until) {
        return res.status(400).json({
          code: 400,
          email: 'This account has been disabled.',
        });
      } //figure this original one out from 2017

      //let emailToken = globalUtils.generateString(60);
      //to-do: but basically, handle the case if the user is unverified - then verify them aswell as reset pw

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post('/fingerprint', (req: any, res: any) => {
  const fingerprint = Watchdog.getFingerprint(
    req.originalUrl,
    req.baseUrl,
    req.headers['x-forwarded-proto'] || req.protocol,
    req.headers
  );

  return res.status(200).json({
    fingerprint: fingerprint.fingerprint,
  });
});

router.post(
  '/verify',
  rateLimitMiddleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
    0.5,
  ),
  async (req: any, res: any) => {
    try {
      const auth_token = req.headers['authorization'];

      if (!auth_token) {
        return res.status(401).json(errors.response_401.UNAUTHORIZED);
      }

      const account = await prisma.user.findUnique({
        where: {
          token: auth_token
        }
      });

      if (!account) {
        return res.status(401).json(errors.response_401.UNAUTHORIZED);
      }

      const token = req.body.token;

      if (!token) {
        return res.status(400).json({
          code: 400,
          token: 'This field is required.',
        });
      }

      if (global.config.captcha_config.enabled) {
        if (req.body.captcha_key === undefined || req.body.captcha_key === null) {
          return res.status(400).json({
            captcha_key: 'Captcha is required.',
          });
        }

        const verifyAnswer = await verify(req.body.captcha_key);

        if (!verifyAnswer) {
          return res.status(400).json({
            captcha_key: 'Invalid captcha response.',
          });
        }
      }

      const tryUseEmailToken = await prisma.user.updateMany({
        where: {
          id: account.id,
          email_token: token
        },
        data: {
          email_token: null,
          verified: true
        }
      })

      if (tryUseEmailToken.count == 0) {
        return res.status(400).json({
          token: 'Invalid email verification token.',
        });
      }

      return res.status(200).json({
        token: req.headers['authorization'],
      });
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.post(
  '/verify/resend',
  rateLimitMiddleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.registration.maxPerTimeFrame,
    global.config.ratelimit_config.registration.timeFrame,
    1,
  ),
  async (req: any, res: any) => {
    try {
      const auth_token = req.headers['authorization'];

      if (!auth_token) {
        return res.status(401).json(errors.response_401.UNAUTHORIZED);
      }

      const account = await prisma.user.findUnique({
        where: {
          token: auth_token
        }
      })

      if (!account) {
        return res.status(401).json(errors.response_401.UNAUTHORIZED);
      }

      if (account.verified) {
        return res.status(204).send();
      }

      if (!global.config.email_config.enabled) {
        return res.status(204).send();
      }

      let emailToken = account.email_token;
      let newEmailToken = false;

      if (!emailToken) {
        emailToken = globalUtils.generateString(60);
        newEmailToken = true;
      }

      const trySendRegEmail = await global.emailer.sendRegistrationEmail(
        account.email,
        emailToken,
        account,
      );

      if (!trySendRegEmail) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      if (newEmailToken) {
        const tryUpdate = await prisma.user.updateMany({
          where: {
            id: account.id
          },
          data: {
            email_token: emailToken,
          }
        })

        if (tryUpdate.count == 0) {
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

export default router;
