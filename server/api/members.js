const express = require('express');
const globalUtils = require('../helpers/globalutils');
const { logText } = require('../helpers/logger');
const { rateLimitMiddleware, guildPermissionsMiddleware } = require('../helpers/middlewares');
const quickcache = require('../helpers/quickcache');
const Watchdog = require('../helpers/watchdog');

const router = express.Router({ mergeParams: true });

router.param('memberid', async (req, res, next, memberid) => {
    req.member = req.guild.members.find(x => x.id === memberid);

    next();
});

router.get("/:memberid", quickcache.cacheFor(60 * 30), async (req, res) => {
    return res.status(200).json(req.member);
});

router.delete("/:memberid", guildPermissionsMiddleware("KICK_MEMBERS"), rateLimitMiddleware(global.config.ratelimit_config.kickMember.maxPerTimeFrame, global.config.ratelimit_config.kickMember.timeFrame), Watchdog.middleware(global.config.ratelimit_config.kickMember.maxPerTimeFrame, global.config.ratelimit_config.kickMember.timeFrame, 0.5), async (req, res) => {
    try {
        const sender = req.account;
        const member = req.member;

        if (member == null) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Member"
            });
        }

        const attempt = await global.database.leaveGuild(member.id, req.params.guildid);

        if (!attempt) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.dispatcher.dispatchEventTo(member.id, "GUILD_DELETE", {
            id: req.params.guildid
        });

        await global.dispatcher.dispatchEventInGuild(req.guild, "GUILD_MEMBER_REMOVE", {
            type: "kick",
            moderator: globalUtils.miniUserObject(sender),
            roles: [],
            user: globalUtils.miniUserObject(member.user),
            guild_id: req.params.guildid
        })

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

async function updateMember(member, guild, roles, nick) {
    let rolesChanged = false;
    let nickChanged = false;
    let guild_id = guild.id;

    if (!roles) {
        roles = member.roles;
    } else {
        let newRoles = [];

        for (let role of roles) {
            if (typeof role === "object" && role.hasOwnProperty("id")) {
                newRoles.push(role.id);
            } else {
                newRoles.push(role);
            }
        }
        
        if (member.roles.length !== newRoles.length) {
            rolesChanged = true;
        } else {
            for (let i = 0; i < member.roles.length; i++) {
                if (member.roles[i] !== newRoles[i]) {
                    rolesChanged = true;
                    break;
                }
            }
        }

        if (rolesChanged) {
            roles = newRoles;
            
            if (!await global.database.setRoles(guild, roles, member.id)) {
                return {
                    code: 500,
                    message: "Internal Server Error"
                };
            }
        }
    }

    if (nick == null || nick === undefined) {
        nick = member.nick;
    } else {
        if (nick === "" || nick === member.user.username) {
            nick = null;
        } else {
            if (nick.length < global.config.limits['nickname'].min || nick.length >= global.config.limits['nickname'].max) {
                return {
                    code: 400,
                    nick: `Must be between ${global.config.limits['nickname'].min} and ${global.config.limits['nickname'].max} characters.`
                };
            }
        }

        if (nick !== member.nick) {
            nickChanged = true;

            if (!await global.database.updateGuildMemberNick(guild_id, member.user.id, nick)) {
                return {
                    code: 500,
                    message: "Internal Server Error"
                };
            }
        }
    }

    let newMember = {
        roles: roles,
        user: globalUtils.miniUserObject(member.user),
        guild_id: guild_id,
        nick: nick
    };

    if (rolesChanged || nickChanged) {
        await global.dispatcher.dispatchEventInGuild(guild, "GUILD_MEMBER_UPDATE", newMember);
    }

    member.roles = roles;
    member.nick = nick;

    return newMember;
}

router.patch("/:memberid", guildPermissionsMiddleware("MANAGE_ROLES"), guildPermissionsMiddleware("MANAGE_NICKNAMES"), rateLimitMiddleware(global.config.ratelimit_config.updateMember.maxPerTimeFrame, global.config.ratelimit_config.updateMember.timeFrame), Watchdog.middleware(global.config.ratelimit_config.updateMember.maxPerTimeFrame, global.config.ratelimit_config.updateMember.timeFrame, 0.5), async (req, res) => {
    try {
        if (req.member == null) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Member"
            });
        }

        let newMember = await updateMember(req.member, req.guild, req.body.roles, req.body.nick);

        if (newMember.code) {
            return res.status(newMember.code).json(newMember);
        }

        return res.status(200).json({
            user: globalUtils.miniUserObject(newMember.user),
            nick: newMember.nick,
            guild_id: req.guild.id,
            roles: newMember.roles,
            joined_at: new Date().toISOString(),
            deaf: false,
            mute: false
        });
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.patch("/@me/nick", guildPermissionsMiddleware("CHANGE_NICKNAME"), rateLimitMiddleware(global.config.ratelimit_config.updateNickname.maxPerTimeFrame, global.config.ratelimit_config.updateNickname.timeFrame), Watchdog.middleware(global.config.ratelimit_config.updateNickname.maxPerTimeFrame, global.config.ratelimit_config.updateNickname.timeFrame, 0.5), async (req, res) => {
    try {
        let account = req.account;
        let member = req.guild.members.find(y => y.id == account.id);

        if (!member) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }
        
        let newMember = await updateMember(member, req.guild, null, req.body.nick);

        if (newMember.code) {
            return res.status(newMember.code).json(newMember);
        }

        await global.dispatcher.dispatchEventInGuild(req.guild, "GUILD_MEMBER_UPDATE", {
            roles: newMember.roles,
            user: globalUtils.miniUserObject(newMember.user),
            guild_id: req.guild.id,
            nick: newMember.nick
        });

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");
 
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
    //updateGuildMemberNick
});

module.exports = router;