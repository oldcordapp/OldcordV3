
const express = require('express');
const globalUtils = require('../../../helpers/globalutils');
const { logText } = require('../../../helpers/logger');
const router = express.Router();
const quickcache = require('../../../helpers/quickcache');
const { guildMiddleware, rateLimitMiddleware } = require('../../../helpers/middlewares');
const Watchdog = require('../../../helpers/watchdog');

router.param('guildid', async (req, _, next, guildid) => {
    req.guild = await global.database.getGuildById(guildid);

    next();
});

router.delete("/:guildid", guildMiddleware, rateLimitMiddleware(global.config.ratelimit_config.leaveGuild.maxPerTimeFrame, global.config.ratelimit_config.leaveGuild.timeFrame), Watchdog.middleware(global.config.ratelimit_config.leaveGuild.maxPerTimeFrame, global.config.ratelimit_config.leaveGuild.timeFrame, 0.5), async (req, res) => {
    try {
        try {
            const user = req.account;
            const guild = req.guild;

            if (guild.owner_id == user.id) {
                await global.dispatcher.dispatchEventInGuild(guild, "GUILD_DELETE", {
                    id: req.params.guildid
                });

                const del = await global.database.deleteGuild(guild.id);

                if (!del) {
                    return res.status(500).json({
                        code: 500,
                        message: "Internal Server Error"
                    });
                }

                return res.status(204).send();
            } else {
                const leave = await global.database.leaveGuild(user.id, guild.id);

                if (!leave) {
                    return res.status(500).json({
                        code: 500,
                        message: "Internal Server Error"
                    });
                }

                await global.dispatcher.dispatchEventTo(user.id, "GUILD_DELETE", {
                    id: req.params.guildid
                });

                await global.dispatcher.dispatchEventInGuild(req.guild, "GUILD_MEMBER_REMOVE", {
                    type: "leave",
                    roles: [],
                    user: globalUtils.miniUserObject(user),
                    guild_id: req.params.guildid
                })

                return res.status(204).send();
            }
        } catch (error) {
            logText(error, "error");

            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        })
    }
});

router.patch("/:guildid/settings", guildMiddleware, rateLimitMiddleware(global.config.ratelimit_config.updateUsersGuildSettings.maxPerTimeFrame, global.config.ratelimit_config.updateUsersGuildSettings.timeFrame), Watchdog.middleware(global.config.ratelimit_config.updateUsersGuildSettings.maxPerTimeFrame, global.config.ratelimit_config.updateUsersGuildSettings.timeFrame, 0.5), async (req, res) => {
    try {
        const user = req.account;
        const guild = req.guild;

        let usersGuildSettings = await global.database.getUsersGuildSettings(user.id);
        let guildSettings = usersGuildSettings.find(x => x.guild_id == guild.id);

        if (!guildSettings) {
            //New guild settings object
            guildSettings = {
                guild_id: guild.id,
                muted: false,
                message_notifications: 2, //2 = Nothing, 1 = Only @mentions, 3 = All Messages
                suppress_everyone: false,
                mobile_push: false,
                channel_overrides: [] //channelid: message_notifications: 0 - (0 = all, 1 = mentions, 2 = nothing), muted: false (or true)
            };
            usersGuildSettings.push(guildSettings);
        }

        //Update guild settings
        function copyIfSetGuild(name) {
            if (req.body[name] !== undefined)
                guildSettings[name] = req.body[name];
        }

        copyIfSetGuild("muted");
        copyIfSetGuild("suppress_everyone");
        copyIfSetGuild("message_notifications");
        copyIfSetGuild("mobile_push");

        //Update channel overrides
        if (req.body.channel_overrides) {
            if (!guildSettings.channel_overrides || !Array.isArray(guildSettings.channel_overrides)) {
                //New channel overrides array for the guild (or old was corrupt)
                guildSettings.channel_overrides = [];
            }

            for (let [id, newChannelOverride] of Object.entries(req.body.channel_overrides)) {
                let channelOverride = guildSettings.channel_overrides.find(x => x.channel_id == id || x.channel_id == newChannelOverride.channel_id);

                if (!channelOverride) {
                    //New channel override
                    channelOverride = {
                        channel_id: id ?? newChannelOverride.channel_id,
                    };
                    guildSettings.channel_overrides.push(channelOverride);
                }

                //Update channel override settings
                function copyIfSetChannel(name) {
                    if (newChannelOverride[name] !== undefined)
                        channelOverride[name] = newChannelOverride[name];
                }

                copyIfSetChannel("muted");
                copyIfSetChannel("message_notifications");
            }
        }

        let updateSettings = await global.database.setUsersGuildSettings(user.id, usersGuildSettings);

        if (!updateSettings) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.dispatcher.dispatchEventTo(user.id, "USER_GUILD_SETTINGS_UPDATE", guildSettings);

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        })
    }
});

router.get("/premium/subscriptions", async (req, res) => {
    if (global.config.infinite_boosts) {
        return res.status(200).json([]);
    }

    let subscriptions = await global.database.getUserSubscriptions(req.account.id);

    return res.status(200).json(subscriptions);
});

router.get("/premium/subscriptions/cooldown", async (req, res) => {
    return res.status(200).json({
        ends_at: null
    });
});

module.exports = router;