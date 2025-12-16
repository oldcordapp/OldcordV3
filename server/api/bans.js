const express = require('express');
const { logText } = require('../helpers/logger');
const globalUtils = require('../helpers/globalutils');
const { rateLimitMiddleware, guildPermissionsMiddleware } = require('../helpers/middlewares');
const router = express.Router({ mergeParams: true });
const quickcache = require('../helpers/quickcache');
const Watchdog = require('../helpers/watchdog');

router.param('memberid', async (req, res, next, memberid) => {
    req.member = req.guild.members.find(x => x.id === memberid);
    
    next();
});

router.get("/", guildPermissionsMiddleware("BAN_MEMBERS"), quickcache.cacheFor(60 * 5, true), async (req, res) => {
    try {
        const bans = await global.database.getGuildBans(req.params.guildid);

        return res.status(200).json(bans);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.put("/:memberid", guildPermissionsMiddleware("BAN_MEMBERS"), rateLimitMiddleware(global.config.ratelimit_config.bans.maxPerTimeFrame, global.config.ratelimit_config.bans.timeFrame), Watchdog.middleware(global.config.ratelimit_config.bans.maxPerTimeFrame, global.config.ratelimit_config.bans.timeFrame, 0.75), async (req, res) => {
    try {
        const sender = req.account;

        if (sender.id == req.params.memberid) {
            return res.status(403).json({
                code: 403,
                message: "Missing Permissions"
            });
        }

        let member = req.member;

        const userInGuild = member != null;

        if (!userInGuild) {
            member = {
                id: req.params.memberid,
                user: {
                    id: req.params.memberid
                }
            }
        }

        if (userInGuild) {
            const attempt = await global.database.leaveGuild(member.id, req.params.guildid);

            if (!attempt) {
                return res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                });
            }
        }

        const tryBan = await global.database.banMember(req.params.guildid, member.id);

        if (!tryBan) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        if (userInGuild) {
            await global.dispatcher.dispatchEventTo(member.id, "GUILD_DELETE", {
                id: req.params.guildid
            });

            await global.dispatcher.dispatchEventInGuild(req.guild, "GUILD_MEMBER_REMOVE", {
                type: "ban",
                moderator: globalUtils.miniUserObject(sender),
                user: globalUtils.miniUserObject(member.user),
                roles: [],
                guild_id: req.params.guildid
            });
        }

        if (req.query['delete-message-days']) {
            let deleteMessageDays = parseInt(req.query['delete-message-days']);

            if (deleteMessageDays > 7) {
                deleteMessageDays = 7;
            }

            if (deleteMessageDays > 0) {
                let messages = await global.database.getUsersMessagesInGuild(req.params.guildid, member.user.id);

                const deletemessagedaysDate = new Date();
                
                deletemessagedaysDate.setDate(deletemessagedaysDate.getDate() - deleteMessageDays);

                messages = messages.filter(message => {
                    const messageTimestamp = new Date(message.timestamp);
                    
                    return messageTimestamp >= deletemessagedaysDate;
                });

                if (messages.length > 0) {
                    for(var message of messages) {
                        let tryDelete = await global.database.deleteMessage(message.id);

                        if (tryDelete) {
                            await global.dispatcher.dispatchEventInChannel(req.guild, message.channel_id, "MESSAGE_DELETE", {
                                id: message.id,
                                guild_id: req.params.guildid,
                                channel_id: message.channel_id
                            })
                        }
                    }
                }
            }
        }

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.delete("/:memberid", guildPermissionsMiddleware("BAN_MEMBERS"), rateLimitMiddleware(global.config.ratelimit_config.bans.maxPerTimeFrame, global.config.ratelimit_config.bans.timeFrame), Watchdog.middleware(global.config.ratelimit_config.bans.maxPerTimeFrame, global.config.ratelimit_config.bans.timeFrame, 0.75), async (req, res) => {
    try {
        const sender = req.account;

        if (sender.id == req.params.memberid) {
            return res.status(403).json({
                code: 403,
                message: "Missing Permissions"
            });
        }

        const bans = await global.database.getGuildBans(req.params.guildid);

        const ban = bans.find(x => x.user.id == req.params.memberid);

        if (!ban) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Ban"
            });
        }

        const attempt = await global.database.unbanMember(req.params.guildid, req.params.memberid);

        if (!attempt) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.dispatcher.dispatchEventTo(sender.id, "GUILD_BAN_REMOVE", {
            guild_id: req.params.guildid,
            user: globalUtils.miniUserObject(ban.user),
            roles: []
        });

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

module.exports = router;