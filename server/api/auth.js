const express = require('express');
const router = express.Router();
const globalUtils = require('../helpers/globalutils');
const Watchdog = require('../helpers/watchdog');
const instanceMiddleware = require('../helpers/middlewares').instanceMiddleware;
const rateLimitMiddleware = require("../helpers/middlewares").rateLimitMiddleware;
const { logText } = require('../helpers/logger');
const recaptcha = require('../helpers/recaptcha');
const errors = require('../helpers/errors');
const lazyRequest = require('../helpers/lazyRequest');

global.config = globalUtils.config;

router.post("/register", instanceMiddleware("NO_REGISTRATION"), rateLimitMiddleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame), Watchdog.middleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame, 2),  async (req, res) => {
    try {
        let release_date = req.client_build;

        if (req.header("referer").includes("/invite/")) {
            req.body.email = null
            req.body.password = null
        } else {
            if (!req.body.email) {
                if (release_date == "june_12_2015") {
                    req.body.email = `june_12_2015_app${globalUtils.generateString(10)}@oldcordapp.com`
                } else {
                    return res.status(400).json({
                        code: 400,
                        email: "This field is required",
                    });
                }
            }

            if (!req.body.email.includes("@")) {
                return res.status(400).json({
                    code: 400,
                    email: "This field is required",
                });
            }

            let emailAddr = req.body.email.split('@')[0];

            if (emailAddr.length < global.config.limits['email'].min || emailAddr.length >= global.config.limits['email'].max) {
                return res.status(400).json({
                    code: 400,
                    email: `Must be between ${global.config.limits['email'].min} and ${global.config.limits['email'].max} characters.`,
                });
            }

            let badEmail = await globalUtils.badEmail(req.body.email); //WHO THE FUCK MOVED THIS??

            if (badEmail) {
                return res.status(400).json({
                    code: 400,
                    email: "That email address is not allowed. Try another.",
                });
            }

            if (!req.body.password) {
                if (release_date == "june_12_2015") {
                    req.body.password = globalUtils.generateString(20);
                } else {
                    return res.status(400).json({
                        code: 400,
                        password: "This field is required",
                    });
                }
            } else {
                if (release_date != "june_12_2015" && (req.body.password.length < global.config.limits['password'].min || req.body.password.length >= global.config.limits['password'].max)) {
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
                username: "This field is required",
            });
        }

        if (req.body.username.length < global.config.limits['username'].min || req.body.username.length >= global.config.limits['username'].max) {
            return res.status(400).json({
                code: 400,
                username: `Must be between ${global.config.limits['username'].min} and ${global.config.limits['username'].max} characters.`
            });
        }

        let goodUsername = globalUtils.checkUsername(req.body.username);

        if (goodUsername.code !== 200) {
            return res.status(goodUsername.code).json(goodUsername);
        }

        //Before July 2016 Discord had no support for Recaptcha.
        //We get around this by redirecting clients on 2015/2016 who wish to make an account to a working 2018 client then back to their original clients after they make their account/whatever.

        if (global.config.captcha_config.enabled) {
            if (req.body.captcha_key === undefined || req.body.captcha_key === null) {
                return res.status(400).json({
                    captcha_key: "Captcha is required."
                });
            }

            let verifyAnswer = await recaptcha.verify(req.body.captcha_key);

            if (!verifyAnswer) {
                return res.status(400).json({
                    captcha_key: "Invalid captcha response."
                });
            }
        }

        let emailToken = globalUtils.generateString(60);

        if (!global.config.email_config.enabled) {
            emailToken = null;
        }

        const registrationAttempt = await global.database.createAccount(req.body.username, req.body.email, req.body.password, req.ip ?? null, emailToken);

        if ('reason' in registrationAttempt) {
            return res.status(400).json({
                code: 400,
                email: registrationAttempt.reason
            });
        }

        let account = await global.database.getAccountByToken(registrationAttempt.token);

        if (account == null) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED);
        }

        if (emailToken != null) {
            await global.emailer.sendRegistrationEmail(req.body.email, emailToken, account);
        }

        if (req.body.invite) {
            let code = req.body.invite;

            let invite = await global.database.getInvite(code);

            if (invite) {
                let guild = await global.database.getGuildById(invite.guild.id);

                if (guild) {
                    await global.database.joinGuild(account.id, guild);

                    await global.dispatcher.dispatchEventTo(account.id, "GUILD_CREATE", guild);

                    await global.dispatcher.dispatchEventInGuild(guild, "GUILD_MEMBER_ADD", {
                        roles: [],
                        user: globalUtils.miniUserObject(account),
                        guild_id: invite.guild.id,
                        joined_at: new Date().toISOString(),
                        deaf: false,
                        mute: false,
                        nick: null
                    });

                    let activeSessions = global.dispatcher.getAllActiveSessions();

                    for (let session of activeSessions) {
                        if (session.subscriptions && session.subscriptions[guild.id]) {
                            //if (session.user.id === account.id) continue;

                            await lazyRequest.handleMemberAdd(session, guild, {
                                user: globalUtils.miniUserObject(account),
                                roles: [],
                                joined_at: new Date().toISOString(),
                                deaf: false,
                                mute: false,
                                nick: null
                            });
                        }
                    }

                    await global.dispatcher.dispatchEventInGuild(guild, "PRESENCE_UPDATE", {
                        game_id: null,
                        status: "online",
                        activities: [],
                        roles: [],
                        user: globalUtils.miniUserObject(account),
                        guild_id: invite.guild.id
                    });

                    if (guild.system_channel_id != null) {
                        let join_msg = await global.database.createSystemMessage(guild.id, guild.system_channel_id, 7, [account]);

                        await global.dispatcher.dispatchEventInChannel(guild, guild.system_channel_id, "MESSAGE_CREATE", join_msg);
                    }
                }
            }
        }

        const autoJoinGuild = config.instance.flags.filter(x => x.toLowerCase().includes("autojoin:"));

        if (autoJoinGuild.length > 0) {
            let guildId = autoJoinGuild[0].split(':')[1];

            let guild = await global.database.getGuildById(guildId);

            if (guild != null) {
                await global.database.joinGuild(account.id, guild);

                await global.dispatcher.dispatchEventTo(account.id, "GUILD_CREATE", guild);

                await global.dispatcher.dispatchEventInGuild(guild, "GUILD_MEMBER_ADD", {
                    roles: [],
                    user: globalUtils.miniUserObject(account),
                    guild_id: guildId,
                    joined_at: new Date().toISOString(),
                    deaf: false,
                    mute: false,
                    nick: null
                });

                let activeSessions = global.dispatcher.getAllActiveSessions();

                for (let session of activeSessions) {
                    if (session.subscriptions && session.subscriptions[guild.id]) {
                        //if (session.user.id === account.id) continue;

                        await lazyRequest.handleMemberAdd(session, guild, {
                            user: globalUtils.miniUserObject(account),
                            roles: [],
                            joined_at: new Date().toISOString(),
                            deaf: false,
                            mute: false,
                            nick: null
                        });
                    }
                }

                await global.dispatcher.dispatchEventInGuild(guild, "PRESENCE_UPDATE", {
                    game_id: null,
                    status: "online",
                    activities: [],
                    roles: [],
                    user: globalUtils.miniUserObject(account),
                    guild_id: guildId
                });

                if (guild.system_channel_id != null) {
                    let join_msg = await global.database.createSystemMessage(guild.id, guild.system_channel_id, 7, [account]);

                    await global.dispatcher.dispatchEventInChannel(guild, guild.system_channel_id, "MESSAGE_CREATE", join_msg);
                }
            }
        }

        return res.status(200).json({
            token: registrationAttempt.token,
        });
    }
    catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

router.post("/login", rateLimitMiddleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame), Watchdog.middleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame, 0.75), async (req, res) => {
    try {
        if (req.body.login) {
            req.body.email = req.body.login
        }

        if (!req.body.email) {
            return res.status(400).json({
                code: 400,
                email: "This field is required",
            });
        }

        if (!req.body.password) {
            return res.status(400).json({
                code: 400,
                password: "This field is required",
            });
        }

        const loginAttempt = await global.database.checkAccount(req.body.email, req.body.password, req.ip ?? null);

        if ('disabled_until' in loginAttempt) {
            return res.status(400).json({
                code: 400,
                email: "This account has been disabled.",
            });
        }

        if ('reason' in loginAttempt) {
            return res.status(400).json({
                code: 400,
                email: loginAttempt.reason,
                password: loginAttempt.reason
            });
        }

        if (req.headers['referer'] && req.headers['referer'].includes("redirect_to=%2Fadmin")) {
            let tryGetAcc = await global.database.getAccountByToken(loginAttempt.token);

            if (!tryGetAcc) {
                return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
            }

            let tryGetStaffDetails = await global.database.getStaffDetails(tryGetAcc.id);

            if (tryGetStaffDetails === null) {
                console.log(`[${tryGetAcc.id}] ${tryGetAcc.username}#${tryGetAcc.discriminator} just tried to login to the Oldcord instance staff admin panel without permission. Further investigation necessary.`);
                return res.status(400).json({
                    code: 400,
                    email: "This account is not instance staff. This incident has been logged.",
                });
            }

            req.is_staff = true;
            req.staff_details = tryGetStaffDetails;
        }

        let mfa_status = await global.database.getUserMfaByToken(loginAttempt.token);

        if (mfa_status.mfa_enabled) {
            let tryGetAcc = await global.database.getAccountByToken(loginAttempt.token);

            if (!tryGetAcc) {
                return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
            } //fuck? how do we make this work better?

            let ticket = await global.database.generateMfaTicket(tryGetAcc.id);

            if (!ticket) {
                return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
            }

            return res.status(200).json({
                mfa: true,
                ticket: ticket,
                sms: false
            });
        }

        return res.status(200).json({
            token: loginAttempt.token,
            settings: {}
        });
    } catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

router.post("/mfa/totp", rateLimitMiddleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame), Watchdog.middleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame, 0.2), async (req, res) => {
    try {
        let ticket = req.body.ticket;
        let code = req.body.code;

        if (!code || !ticket) {
            return res.status(400).json({
                code: 400,
                message: "Invalid TOTP code",
            });
        }

        let user_mfa = await global.database.getUserMfaByTicket(ticket);

        if (!user_mfa.mfa_secret || !user_mfa.mfa_enabled) {
            return res.status(400).json({
                code: 400,
                message: "Invalid TOTP code",
            });
        }

        let token = await global.database.getLoginTokenByMfaTicket(ticket);

        if (!token) {
            return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        } //???

        let account = await global.database.getAccountByToken(token);

        if (!account) {
            return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        } // ihate this so fucking much

        let valid = await global.database.validateTotpCode(account.id, code);

        if (!valid) {
            return res.status(400).json({
                code: 400,
                message: "Invalid TOTP code"
            }); //to-do find the actual error msgs
        }

        await global.database.invalidateMfaTicket(ticket);

        return res.status(200).json({
            token: token
        })
    } catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

router.post("/logout", rateLimitMiddleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame), Watchdog.middleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame, 0.4), async (req, res) => {
    return res.status(204).send();
});

router.post("/forgot", rateLimitMiddleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame), Watchdog.middleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame, 0.4), async (req, res) => {
    try {
        let email = req.body.email;

        if (!email) {
            return res.status(400).json({
                code: 400,
                email: "This field is required.",
            });
        }

        let account = await global.database.getAccountByEmail(email);

        if (!account) {
            return res.status(400).json({
                code: 400,
                email: "Email does not exist.",
            });
        }

        if (account.disabled_until) {
            return res.status(400).json({
                code: 400,
                email: "This account has been disabled.",
            });
        } //figure this original one out from 2017

        //let emailToken = globalUtils.generateString(60);
        //to-do: but basically, handle the case if the user is unverified - then verify them aswell as reset pw

        return res.status(204).send();
    }
    catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

router.post("/fingerprint", (_, res) => {
    let fingerprint = Watchdog.getFingerprint(req.originalUrl, req.baseUrl, req.headers['x-forwarded-proto'] || req.protocol, req.headers, req.account, null);

    return res.status(200).json({
        fingerprint: fingerprint.fingeprint
    })
});

router.post("/verify", rateLimitMiddleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame), Watchdog.middleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame, 0.5), async (req, res) => {
    try {
        let auth_token = req.headers['authorization'];

        if (!auth_token) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED)
        }

        let account = await global.database.getAccountByToken(auth_token);

        if (!account) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED)
        }

        let token = req.body.token;

        if (!token) {
            return res.status(400).json({
                code: 400,
                token: "This field is required."
            });
        }

        if (global.config.captcha_config.enabled) {
            if (req.body.captcha_key === undefined || req.body.captcha_key === null) {
                return res.status(400).json({
                    captcha_key: "Captcha is required."
                });
            }

            let verifyAnswer = await recaptcha.verify(req.body.captcha_key);

            if (!verifyAnswer) {
                return res.status(400).json({
                    captcha_key: "Invalid captcha response."
                });
            }
        }

        let tryUseEmailToken = await global.database.useEmailToken(account.id, token);

        if (!tryUseEmailToken) {
            return res.status(400).json({
                token: "Invalid email verification token."
            });
        }

        return res.status(200).json({
            token: req.headers['authorization']
        });
    }
    catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

router.post("/verify/resend", rateLimitMiddleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame), Watchdog.middleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame, 1), async (req, res) => {
    try {
        let auth_token = req.headers['authorization'];

        if (!auth_token) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED)
        }

        let account = await global.database.getAccountByToken(auth_token);

        if (!account) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED)
        }

        if (account.verified) {
            return res.status(204).send();
        }

        if (!global.config.email_config.enabled) {
            return res.status(204).send();
        }

        let emailToken = await global.database.getEmailToken(account.id);
        let newEmailToken = false;

        if (!emailToken) {
            emailToken = globalUtils.generateString(60);
            newEmailToken = true;
        }

        let trySendRegEmail = await global.emailer.sendRegistrationEmail(account.email, emailToken, account);

        if (!trySendRegEmail) {
            return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }

        if (newEmailToken) {
            let tryUpdate = await global.database.updateEmailToken(account.id, emailToken);

            if (!tryUpdate) {
                return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
            }
        }

        return res.status(204).send();
    }
    catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

module.exports = router;