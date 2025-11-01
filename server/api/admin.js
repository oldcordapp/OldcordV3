const express = require('express');
const { logText } = require('../helpers/logger');
const { staffAccessMiddleware } = require('../helpers/middlewares');
const router = express.Router({ mergeParams: true });
const quickcache = require('../helpers/quickcache');
const globalUtils = require('../helpers/globalutils');

//PRIVILEGE: 1 - (JANITOR) [Can only flag things for review], 2 - (MODERATOR) [Can only delete messages, mute users, and flag things for review], 3 - (ADMIN) [Free reign, can review flags, disable users, delete servers, etc], 4 - (INSTANCE OWNER) - [Can add new admins, manage staff, etc]

router.param('userid', async (req, res, next, userid) => {
    req.user = await global.database.getAccountByUserId(userid);
    req.is_user_staff = req.user && (req.user.flags & 1 << 0) === 1 << 0;

    if (req.user != null && req.is_user_staff)
        req.user_staff_details = await global.database.getStaffDetails(req.user.id);

    next();
});

router.get("/users/:userid", staffAccessMiddleware(3), async (req, res) => {
    try {
        const userid = req.params.userid;

        if (!userid) {
            return res.status(404).json({
                code: 404,
                message: "Unknown User"
            });
        }

        const [userRet, guilds] = await Promise.all([
            global.database.getAccountByUserId(userid),
            global.database.getUsersGuilds(userid)
        ]); //to-do: make a lite function which just gets the name, id, icon from the database - makes no sense fetching the whole guild object then only using like 3 things from it to fetch it later

        if (!userRet) {
            return res.status(404).json({
                code: 404,
                message: "Unknown User"
            });
        }

        if (userRet.bot) {
            return res.status(404).json({
                code: 400,
                message: "Please use the \"Bots\" tab to lookup bots."
            });
        } //This is because it has application info, etc

        let bots = await global.database.getUsersBots(userRet);

        const userRetTotal = {
            ...userRet,
            guilds,
            bots
        };

        return res.status(200).json(globalUtils.sanitizeObject(userRetTotal,
            ['settings', 'token', 'password', 'disabled_until', 'disabled_reason']
        ));
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.get("/bots/:userid", staffAccessMiddleware(3), async (req, res) => {
    try {
        const userid = req.params.userid;

        if (!userid) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Bot"
            });
        } // there is no point renaming this shit tbh

        const [userRet, guilds] = await Promise.all([
            global.database.getBotByUserId(userid),
            global.database.getUsersGuilds(userid)
        ]);

        if (!userRet) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Bot"
            });
        }

        const userWithGuilds = {
            ...userRet,
            guilds,
        };

        return res.status(200).json(userWithGuilds);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.get("/guilds/:guildid", staffAccessMiddleware(3), async (req, res) => {
    try {
        const guildid = req.params.guildid;

        if (!guildid) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Guild"
            });
        }

        const guildRet = await global.database.getGuildById(guildid);

        if (!guildRet) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Guild"
            });
        }

        let owner = await global.database.getAccountByUserId(guildRet.owner_id);

        if (owner != null) {
            guildRet.owner = globalUtils.miniUserObject(owner);
        } //this fucking sucks ass and we need to fix this ASAP.

        return res.status(200).json(guildRet);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.get("/@me", staffAccessMiddleware(1), async (req, res) => {
    try {
        let ret = req.account;

        ret.staff_details = req.staff_details;

        return res.status(200).json(globalUtils.sanitizeObject(ret, ['settings', 'token', 'password', 'relationships', 'disabled_until', 'disabled_reason']));

    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.get("/reports", staffAccessMiddleware(1), async (req, res) => {
    try {
        let reports = await global.database.getInstanceReports();

        return res.status(200).json(reports);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.patch("/reports/:reportid", staffAccessMiddleware(1), async (req, res) => {
    try {
        let reportid = req.params.reportid;

        if (!reportid) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Report"
            });
        }

        let action = req.body.action;

        if (!action) {
            return res.status(400).json({
                code: 400,
                action: "This field is required"
            });
        }

        let valid_states = [
            'approved',
            'discarded'
        ]

        if (!valid_states.includes(action.toLowerCase())) {
            return res.status(400).json({
                code: 400,
                message: "Invalid action state"
            });
        }

        let tryUpdateReport = await global.database.updateReport(reportid, action.toUpperCase());

        if (!tryUpdateReport) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Report"
            });
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

router.delete("/guilds/:guildid", staffAccessMiddleware(3), async (req, res) => {
    try {
        let guildid = req.params.guildid;

        if (!guildid) {
            return res.status(400).json({
                code: 404,
                message: "Unknown Guild"
            });
        }

        let guildRet = await global.database.getGuildById(guildid);

        if (!guildRet) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Guild"
            });
        }

        await global.database.deleteGuild(guildid);

        await global.dispatcher.dispatchEventInGuild(guildRet, "GUILD_DELETE", {
            id: req.params.guildid
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

router.post("/users/:userid/moderate/disable", staffAccessMiddleware(3), async (req, res) => {
    try {
        let user = req.user;

        if (!user) {
            return res.status(404).json({
                code: 404,
                message: `Unknown ${user.bot ? 'Bot' : 'User'}`
            });
        }

        if (user.id === req.account.id || req.is_user_staff) { //Should we allow them to disable other staff members?
            return res.status(404).json({
                code: 404,
                message: `Unknown ${user.bot ? 'Bot' : 'User'}`
            });
        }

        if (user.disabled_until) {
            return res.status(400).json({
                code: 400,
                message: `${user.bot ? 'Bot' : 'User'} is already disabled.`
            });
        }

        let until = req.body.disabled_until;

        if (!until) {
            return res.status(400).json({
                code: 400,
                disabled_until: "This field is required."
            });
        }

        let audit_log_reason = req.body.internal_reason;

        if (!audit_log_reason) {
            return res.status(400).json({
                code: 400,
                internal_reason: "This field is required."
            });
        }

        let tryDisable = await global.database.internalDisableAccount(req.staff_details, req.params.userid, until ?? "FOREVER", audit_log_reason);

        if (!tryDisable) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.dispatcher.dispatchLogoutTo(req.params.userid);

        return res.status(200).json(tryDisable);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.get("/staff", staffAccessMiddleware(4), async (req, res) => {
    try {
        let staff = await global.database.getInstanceStaff();

        return res.status(200).json(staff);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.get("/staff/audit-logs", staffAccessMiddleware(4), async (req, res) => {
    try {
        let audit_logs = await global.database.getStaffAuditLogs();

        return res.status(200).json(audit_logs);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    } 
});

router.post("/staff", staffAccessMiddleware(4), async (req, res) => {
    try {
        let user_id = req.body.user_id;
        let privilege = req.body.privilege;

        if (!user_id) {
            return res.status(400).json({
                code: 400,
                user_id: "This field is required."
            });
        }

        if (!privilege) {
            return res.status(400).json({
                code: 400,
                privilege: "This field is required."
            });
        }

        if (privilege > 3 || privilege <= 0) {
            return res.status(400).json({
                code: 400,
                privilege: "Invalid Privilege"
            });
        }

        req.user = await global.database.getAccountByUserId(user_id);

        if (!req.user) {
            return res.status(404).json({
                "code": 404,
                "message": "Unknown User"
            })
        }

        req.is_user_staff = req.user && (req.user.flags & 1 << 0) === 1 << 0;

        if (req.is_user_staff) {
            return res.status(400).json({
                "code": 400,
                "message": "This user is already staff."
            })
        }

        let tryAddStaff = await global.database.addInstanceStaff(req.user, privilege);

        if (!tryAddStaff) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        let new_staff = await global.database.getInstanceStaff();

        return res.status(200).json(new_staff);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.delete("/staff/:userid", staffAccessMiddleware(4), async (req, res) => {
    try {
        let user = req.user;

        if (!user) {
            return res.status(404).json({
                code: 404,
                message: `Unknown User`
            });
        }

        if (user.id === req.account.id || !req.is_user_staff) {
            return res.status(404).json({
                code: 404,
                message: `Unknown User`
            });
        }

        await global.database.removeFromStaff(user);

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.delete("/staff/:userid/audit-logs", staffAccessMiddleware(4), async (req, res) => {
    try {
        let user = req.user;

        if (!user) {
            return res.status(404).json({
                code: 404,
                message: `Unknown User`
            });
        }

        if (user.id === req.account.id || !req.is_user_staff) {
            return res.status(404).json({
                code: 404,
                message: `Unknown User`
            });
        }

        await global.database.clearStaffAuditLogs(user.id);

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.get("/messages", staffAccessMiddleware(2), async (req, res) => {
    try {
        let channelId = req.query.channelId;
        let messageId = req.query.messageId;
        let context = req.query.context;
        let cdnLink = req.query.cdnLink;
        let message;

        let normalizeParam = (param) => {
            if (param === "null" || param === "undefined" || param === "") {
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
                code: 400,
                message: "channelId or messageId (or cdnLink) is required to search messages."
            });
        }

        if (cdnLink) {
            message = await global.database.getMessageByCdnLink(cdnLink);

            if (message == null) {
                return res.status(404).json({
                    code: 404,
                    message: "No Message found with that CDN Link"
                });
            }

            messageId = message.id;
            channelId = message.channel_id;
        }

        if (messageId) {
            message = await global.database.getMessageById(messageId);

            if (message == null) {
                return res.status(404).json({
                    code: 404,
                    message: "Unknown Message"
                });
            }

            if (!channelId) {
                channelId = message.channel_id;
            }
        }

        if (!channelId) {
            return res.status(400).json({
                code: 400,
                message: "A channelId is required."
            });
        }

        let channel = await global.database.getChannelById(channelId);

        if (!channel) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Channel"
            });
        }

        let retMessages = [];

        let targetMessageId = messageId || null;

        let messagesBefore = await global.database.getChannelMessages(channelId, "", 25, targetMessageId, null, false);

        retMessages.push(...messagesBefore);

        if (message != null) {
            retMessages.push(message);
        }

        let messagesAfter = await global.database.getChannelMessages(channelId, "", 25, null, targetMessageId, false);

        retMessages.push(...messagesAfter);

        let uniqueMessagesMap = new Map();

        for (const msg of retMessages) {
            uniqueMessagesMap.set(msg.id, msg);
        }

        let finalMessages = Array.from(uniqueMessagesMap.values());

        finalMessages.sort((a, b) => a.id.localeCompare(b.id));

        return res.status(200).json(finalMessages);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.delete("/messages/:messageid", staffAccessMiddleware(2), async (req, res) => {
    try {
        let messageid = req.params.messageid;

        if (!messageid) {
            return res.status(400).json({
                code: 404,
                message: "Unknown Message"
            });
        }

        let msgRet = await global.database.getMessageById(messageid);

        if (!msgRet) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Message"
            });
        }

        let guildRet = await global.database.getGuildById(msgRet.guild_id);

        if (!guildRet) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.database.deleteMessage(messageid);

        await global.dispatcher.dispatchEventInGuild(guildRet, "MESSAGE_DELETE", {
            id: msgRet.id,
            guild_id: msgRet.guild_id,
            channel_id: msgRet.channel_id
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

router.post("/users/:userid/moderate/delete", staffAccessMiddleware(3), async (req, res) => {
    try {
        let user = req.user;

        if (!user) {
            return res.status(404).json({
                code: 404,
                message: `Unknown ${user.bot ? 'Bot' : 'User'}`
            });
        }

        if (user.id === req.account.id || req.is_user_staff) {
            return res.status(404).json({
                code: 404,
                message: `Unknown ${user.bot ? 'Bot' : 'User'}`
            });
        }

        let audit_log_reason = req.body.internal_reason;

        if (!audit_log_reason) {
            return res.status(400).json({
                code: 400,
                internal_reason: "This field is required."
            });
        }

        if (user.bot) {
            await global.database.deleteBotById(req.params.userid);
            await global.dispatcher.dispatchLogoutTo(req.params.userid);

            return res.status(204).send();
        }

        let tryDisable = await global.database.internalDeleteAccount(req.staff_details, req.params.userid, audit_log_reason);

        if (!tryDisable) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.dispatcher.dispatchLogoutTo(req.params.userid);

        return res.status(200).json(tryDisable);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

module.exports = router;