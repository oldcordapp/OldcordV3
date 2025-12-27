const express = require('express');
const globalUtils = require('../helpers/globalutils');
const { logText } = require('../helpers/logger');
const roles = require('./roles');
const members = require('./members');
const bans = require('./bans');
const emojis = require('./emojis');
const quickcache = require('../helpers/quickcache');
const Watchdog = require('../helpers/watchdog');

const { instanceMiddleware, rateLimitMiddleware, guildMiddleware, guildPermissionsMiddleware } = require('../helpers/middlewares');
const Snowflake = require('../helpers/snowflake');

const router = express.Router();

router.param('guildid', async (req, _, next, guildid) => {
    req.guild = await global.database.getGuildById(guildid);

    next();
});

router.param('subscriptionid', async (req, _, next, subscriptionid) => {
    req.subscription = await global.database.getSubscription(subscriptionid);

    next();
});

router.get("/:guildid", guildMiddleware, quickcache.cacheFor(60 * 10, true), async (req, res) => {
    return res.status(200).json(req.guild);
});

router.post("/", instanceMiddleware("NO_GUILD_CREATION"), rateLimitMiddleware(global.config.ratelimit_config.createGuild.maxPerTimeFrame, global.config.ratelimit_config.createGuild.timeFrame), Watchdog.middleware(global.config.ratelimit_config.createGuild.maxPerTimeFrame, global.config.ratelimit_config.createGuild.timeFrame, 1), async (req, res) => {
    try {
        if (!req.body.name || req.body.name == "") {
            return res.status(400).json({
                name: "This field is required."
            })
        }

        if (req.body.name.length < global.config.limits['guild_name'].min || req.body.name.length >= global.config.limits['guild_name'].max) {
            return res.status(400).json({
                name: `Must be between ${global.config.limits['guild_name'].min} and ${global.config.limits['guild_name'].max} in length.`
            })
        }

        const creator = req.account;

        if (!req.body.region) {
            req.body.region = "everything"; // default to everything bc of third party clients / mobile
        }

        if (req.body.region != "everything" && !globalUtils.canUseServer(req.client_build_date.getFullYear(), req.body.region)) {
            return res.status(400).json({
                name: "Year must be your current client build year or pick everything."
            });
        }

        let client_date = req.client_build_date;
        let selected_region = req.body.region;
        let exclusions = [];

        let month = client_date.getMonth();
        let year = client_date.getFullYear();

        if (selected_region == "2016") {
            if (month > 3 && month <= 10 && year == 2016) {
                exclusions.push(...[
                    "system_messages",
                    "custom_emoji",
                    "mention_indicators",
                    "reactions",
                    "categories"
                ]) // 10 = september, 11 = october, 12 = november, 13 = december
            } else if (month > 9 && month <= 13 && year == 2016) {
                exclusions.push(...[
                    "reactions",
                    "categories"
                ]);
            } else if (year != 2016) selected_region = "everything";
        }

        const guild = await global.database.createGuild(creator, req.body.icon, req.body.name, req.body.region, exclusions, client_date);

        if (guild == null) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        } else {
            if (!req.channel_types_are_ints) {
                guild.channels[0].type = "text";
            }

            await global.dispatcher.dispatchEventTo(creator.id, "GUILD_CREATE", guild);

            return res.status(200).json(guild);
        }
      } catch (error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

async function guildDeleteRequest(req, res) {
    try {
        const user = req.account;
        const guild = req.guild;

        if (guild.owner_id == user.id) {
            let code = req.body.code;

            if (code) {
                let valid = await global.database.validateTotpCode(req.account.id, code);

                if (!valid) {
                    return res.status(400).json({
                        code: 400,
                        message: "Invalid TOTP Code"
                    });
                }
            }
            
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
    } catch(error) {
        logText(error, "error");
 
        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
}

//later 2016 guild deletion support - why the fuck do they do it like this?
router.post("/:guildid/delete", guildMiddleware, rateLimitMiddleware(global.config.ratelimit_config.leaveGuild.maxPerTimeFrame, global.config.ratelimit_config.leaveGuild.maxPerTimeFrame), Watchdog.middleware(global.config.ratelimit_config.leaveGuild.maxPerTimeFrame, global.config.ratelimit_config.leaveGuild.timeFrame, 1), guildDeleteRequest);

router.delete("/:guildid", guildMiddleware, rateLimitMiddleware(global.config.ratelimit_config.deleteGuild.maxPerTimeFrame, global.config.ratelimit_config.deleteGuild.timeFrame), Watchdog.middleware(global.config.ratelimit_config.deleteGuild.maxPerTimeFrame, global.config.ratelimit_config.deleteGuild.timeFrame, 0.5), guildDeleteRequest);

// UNFORTUNAAAATELY to keep the data fresh it is best advised that we dont cache the response at all.

router.get("/:guildid/messages/search", guildMiddleware, guildPermissionsMiddleware("READ_MESSAGE_HISTORY"), rateLimitMiddleware(global.config.ratelimit_config.messageSearching.maxPerTimeFrame, global.config.ratelimit_config.messageSearching.timeFrame), Watchdog.middleware(global.config.ratelimit_config.messageSearching.maxPerTimeFrame, global.config.ratelimit_config.messageSearching.timeFrame, 1), async (req, res) => {
    try {
        const account = req.account;
        
        let guild = req.guild;
        let channelsMap = new Map();
        
        for (let channel of guild.channels) {
            channelsMap.set(channel.id, channel);
        }

        let content = req.query.content;
        let channel_id = req.query.channel_id;

        if (channel_id && !channelsMap.get(channel_id)) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Channel"
            });
        }

        let offset = parseInt(req.query.offset) || 0;
        let limit = (req.query.limit && req.query.limit > 0 && req.query.limit <= 50) ? req.query.limit : 50;
        let author_id = req.query.author_id;
        let before_id = req.query.max_id;
        let after_id = req.query.min_id;
        let mentions = req.query.mentions; //user_id
        let include_nsfw = req.query.include_nsfw === "true" ?? false;
        let has = req.query.has; //fuck this i cant be fucked today
        //need to do during too

        let results = await global.database.getGuildMessages(
            guild.id,
            author_id,
            content,
            channel_id,
            mentions,
            include_nsfw,
            before_id,
            after_id,
            limit,
            offset
        );

        let ret_results = [];
        let minus = 0;
        
        for (var result of results.messages) {
            let chan_id = result.channel_id;
            let channel = channelsMap.get(chan_id);

            if (!channel) {
                continue;
            }

            let canReadChannel = global.permissions.hasChannelPermissionTo(channel, guild, account.id, "READ_MESSAGES");

            if (canReadChannel) {
                delete result.reactions;
                
                result.hit = true;

                ret_results.push([
                    result
                ]);
            } else minus++;
        }

        return res.status(200).json({
            messages: ret_results,
            analytics_id: null,
            total_results: results.totalCount - minus,
            doing_deep_historical_index: false,
            documents_indexed: true
        });
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.patch("/:guildid", guildMiddleware, guildPermissionsMiddleware("MANAGE_GUILD"), rateLimitMiddleware(global.config.ratelimit_config.updateGuild.maxPerTimeFrame, global.config.ratelimit_config.updateGuild.timeFrame), Watchdog.middleware(global.config.ratelimit_config.updateGuild.maxPerTimeFrame, global.config.ratelimit_config.updateGuild.timeFrame, 1), async (req, res) => {
    try {
        const sender = req.account;

        let what = req.guild;

        if (req.body.name && (req.body.name.length < global.config.limits['guild_name'].min || req.body.name.length >= global.config.limits['guild_name'].max)) {
            return res.status(400).json({
                name: `Must be between ${global.config.limits['guild_name'].min} and ${global.config.limits['guild_name'].max} in length.`
            })
        }

        if (req.body.region && req.body.region != what.region && req.body.region != "everything") {
            return res.status(400).json({
                region: "Cannot change the oldcord year region for this server at this time. Try again later."
            });
        }

        if (req.body.default_message_notifications && (req.body.default_message_notifications < 0 || req.body.default_message_notifications > 3)) {
            return res.status(400).json({
                code: 400,
                message: "Default Message Notifications must be less or equal than 3 but greater than 0."
            }); 
        }

        if (req.body.verification_level && (req.body.verification_level < 0 || req.body.verification_level > 4)) {
            return res.status(400).json({
                code: 400,
                message: "Verification level must be less or equal to 4 but greater than 0."
            }); 
        }

        if (req.body.explicit_content_filter && (req.body.explicit_content_filter < 0 || req.body.explicit_content_filter > 2)) {
            return res.status(400).json({
                code: 400,
                message: "Explicit content filter must be less or equal to 2 but greater than 0."
            }); 
        }

        if (req.body.owner_id) {
            if (req.body.owner_id == sender.id) {
                return res.status(400).json({
                    code: 400,
                    message: "Cannot change the new owner to the current owner"
                });
            }

            let new_owner = what.members.find(x => x.id == req.body.owner_id);

            if (!new_owner) {
                return res.status(404).json({
                    code: 404,
                    message: "Unknown Member"
                });
            }

            let tryTransferOwner = await global.database.transferGuildOwnership(what.id, req.body.owner_id);
            
            if (!tryTransferOwner) {
                return res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                }); 
            }

            what = await global.database.getGuildById(req.params.guildid);

            if (what == null) {
                return res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                }); 
            }
    
            await global.dispatcher.dispatchEventInGuild(req.guild, "GUILD_UPDATE", what);
    
            return res.status(200).json(what);
        }

        const update = await global.database.updateGuild(req.params.guildid, req.body.afk_channel_id, req.body.afk_timeout, req.body.icon, req.body.splash, req.body.banner, req.body.name, req.body.default_message_notifications, req.body.verification_level, req.body.explicit_content_filter, req.body.system_channel_id);

        if (!update) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        what = await global.database.getGuildById(req.params.guildid);

        if (what == null) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            }); 
        }

        await global.dispatcher.dispatchEventInGuild(req.guild, "GUILD_UPDATE", what);

        return res.status(200).json(what);
      } catch (error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.get("/:guildid/prune", guildMiddleware, guildPermissionsMiddleware("MANAGE_GUILD"), async (_, res) => {
    return res.status(200).json([]);
});

router.post("/:guildid/prune", guildMiddleware, guildPermissionsMiddleware("MANAGE_GUILD"), async (_, res) => {
    return res.status(204).send();
});

router.put("/:guildid/premium/subscriptions", guildMiddleware, rateLimitMiddleware(global.config.ratelimit_config.subscriptions.maxPerTimeFrame, global.config.ratelimit_config.subscriptions.timeFrame), Watchdog.middleware(global.config.ratelimit_config.subscriptions.maxPerTimeFrame, global.config.ratelimit_config.subscriptions.timeFrame, 1), async (req, res) => {
    let tryBoostServer = await global.database.createGuildSubscription(req.account, req.guild);

    if (!tryBoostServer) {
        return res.status(400).json({
            code: 404,
            message: "Failed to boost. Please try again." //find the actual fail msg??
        });
    }

    return res.status(200).json(tryBoostServer);
});

router.delete("/:guildid/premium/subscriptions/:subscriptionid", guildMiddleware, rateLimitMiddleware(global.config.ratelimit_config.subscriptions.maxPerTimeFrame, global.config.ratelimit_config.subscriptions.timeFrame), Watchdog.middleware(global.config.ratelimit_config.subscriptions.maxPerTimeFrame, global.config.ratelimit_config.subscriptions.timeFrame, 1), async (req, res) => {
    try {
        if (!req.subscription) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Subscription"
            })
        }

        await global.database.removeSubscription(req.subscription);

        return res.status(204).send();
    }
    catch (error) {
        console.error(error);

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        })
    }
});

router.get("/:guildid/premium/subscriptions", guildMiddleware, quickcache.cacheFor(60 * 5, true), async (req, res) => {
  let guild_subscriptions = await global.database.getGuildSubscriptions(req.guild);

  return res.status(200).json(guild_subscriptions);
});

router.get("/:guildid/embed", guildMiddleware, quickcache.cacheFor(60 * 30, true), async (req, res) => {
    try {
        const widget = await global.database.getGuildWidget(req.params.guildid);

        if (widget == null) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }
        
        return res.status(200).json(widget);
      } catch (error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.patch("/:guildid/embed", guildMiddleware, guildPermissionsMiddleware("MANAGE_GUILD"), async (req, res) => {
    try {
        const update = await global.database.updateGuildWidget(req.params.guildid, req.body.channel_id, req.body.enabled);

        if (!update) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        const widget = await global.database.getGuildWidget(req.params.guildid);

        if (widget == null) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            }); 
        }

        return res.status(200).json(widget);
      } catch (error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.get("/:guildid/audit-logs", guildMiddleware, guildPermissionsMiddleware("MAANGE_GUILD"), quickcache.cacheFor(60 * 5), async (req, res) => {
    try {
        /*
        ALL: null,
            GUILD_UPDATE: 1,
            CHANNEL_CREATE: 10,
            CHANNEL_UPDATE: 11,
            CHANNEL_DELETE: 12,
            CHANNEL_OVERWRITE_CREATE: 13,
            CHANNEL_OVERWRITE_UPDATE: 14,
            CHANNEL_OVERWRITE_DELETE: 15,
            MEMBER_KICK: 20,
            MEMBER_PRUNE: 21,
            MEMBER_BAN_ADD: 22,
            MEMBER_BAN_REMOVE: 23,
            MEMBER_UPDATE: 24,
            MEMBER_ROLE_UPDATE: 25,
            ROLE_CREATE: 30,
            ROLE_UPDATE: 31,
            ROLE_DELETE: 32,
            INVITE_CREATE: 40,
            INVITE_UPDATE: 41,
            INVITE_DELETE: 42,
            WEBHOOK_CREATE: 50,
            WEBHOOK_UPDATE: 51,
            WEBHOOK_DELETE: 52,
            EMOJI_CREATE: 60,
            EMOJI_UPDATE: 61,
            EMOJI_DELETE: 62,
            MESSAGE_DELETE: 72
        */ //action_type for audit log

        let limit = (req.query.limit > 50 ? 50 : req.query.limit) || 50;

        let audit_log_entries = req.guild.audit_logs;
        let audit_log_user_ids = [...new Set(audit_log_entries.map(entry => entry.user_id).filter(id => id))];
        let audit_log_users = await global.database.getAccountsByIds(audit_log_user_ids);

        audit_log_users = audit_log_users.map(user => globalUtils.miniUserObject(user));

        return res.status(200).json({
            audit_log_entries: audit_log_entries,
            users: audit_log_users,
            webhooks: []
        })
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.get("/:guildid/invites", guildMiddleware, guildPermissionsMiddleware("MANAGE_GUILD"), quickcache.cacheFor(60 * 5), async (req, res) => {
    try {
        const invites = await global.database.getGuildInvites(req.params.guildid);

        return res.status(200).json(invites);
      } catch (error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.post("/:guildid/channels", guildMiddleware, guildPermissionsMiddleware("MANAGE_CHANNELS"), rateLimitMiddleware(global.config.ratelimit_config.createChannel.maxPerTimeFrame, global.config.ratelimit_config.createChannel.timeFrame), Watchdog.middleware(global.config.ratelimit_config.createChannel.maxPerTimeFrame, global.config.ratelimit_config.createChannel.timeFrame, 0.5), async (req, res) => {
    try {
        const sender = req.account;

        if (req.guild.channels.length >= global.config.limits['channels_per_guild'].max) {
            return res.status(400).json({
                code: 400,
                message: `Maximum number of channels per guild exceeded (${global.config.limits['channels_per_guild'].max})`
            });
        }

        if (!req.body.name) {
            return res.status(400).json({
                code: 400,
                message: `This field is required.`
            });
        }

        if (req.body.name.length < global.config.limits['channel_name'].min || req.body.name.length >= global.config.limits['channel_name'].max) {
            return res.status(400).json({
                code: 400,
                name: `Must be between ${global.config.limits['channel_name'].min} and ${global.config.limits['channel_name'].max} characters.`
            });
        }

        req.body.name = req.body.name.replace(/ /g, "-");

        const member = req.guild.members.find(x => x.id === sender.id);

        if (!member) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Member"
            });
        }

        let number_type = 0;

        if (typeof req.body.type === 'string') {
            number_type = req.body.type == "text" ? 0 : 1;
        } else number_type = req.body.type;

        let send_parent_id = null;

        if (req.body.parent_id) {
            if (!req.guild.channels.find(x => x.id === req.body.parent_id && x.type === 4)) {
                return res.status(404).json({
                    code: 404,
                    message: "Unknown Category"
                });
            }

            if (number_type !== 0 && number_type !== 2 && number_type != 5) {
                return res.status(400).json({
                    code: 400,
                    message: "You're a wizard harry, how the bloody hell did you manage to do that?"
                });
            }

            send_parent_id = req.body.parent_id;
        }

        const channel = await global.database.createChannel(req.params.guildid, req.body.name, number_type, req.guild.channels.length + 1, [], null, send_parent_id);

        if (channel == null) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        channel.type = typeof req.body.type === 'string' ? req.body.type : number_type;

        await global.dispatcher.dispatchEventInGuild(req.guild, "CHANNEL_CREATE", function() {
            return globalUtils.personalizeChannelObject(this.socket, channel);
        });

        return res.status(200).json(channel);
    } catch(error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.patch("/:guildid/channels", guildMiddleware, guildPermissionsMiddleware("MANAGE_CHANNELS"), rateLimitMiddleware(global.config.ratelimit_config.updateChannel.maxPerTimeFrame, global.config.ratelimit_config.updateChannel.timeFrame), Watchdog.middleware(global.config.ratelimit_config.updateChannel.maxPerTimeFrame, global.config.ratelimit_config.updateChannel.timeFrame, 0.5), async (req, res) => {
    try {
        let ret = [];

        for(var shit of req.body) {
            var channel_id = shit.id;
            var position = shit.position;
            var parent_id = shit.parent_id;

            const channel = req.guild.channels.find(x => x.id === channel_id);

            if (channel == null) {
                return res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                });
            }

            channel.position = position;

            if (parent_id) {
                if (parent_id === null) channel.parent_id = null;

                if (req.guild.channels.find(x => x.id === parent_id && x.type === 4)) channel.parent_id = parent_id;
            }

            const outcome = await global.database.updateChannel(channel_id, channel);

            if (!outcome) {

                return res.status(500).json({
                    code: 500,
                    message: "Internal Server Error"
                });
            }

            if (!req.channel_types_are_ints) {
                channel.type = channel.type == 2 ? "voice" : "text";
            }

            ret.push(channel);

            await global.dispatcher.dispatchEventToAllPerms(channel.guild_id, channel.id, "READ_MESSAGES", "CHANNEL_UPDATE", channel);
        }

        return res.status(200).json(ret);
    } catch(error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.post("/:guildid/ack", async (req, res) => {
    return res.status(204).send(); //to-do
});

router.use("/:guildid/roles", roles);
router.use("/:guildid/members", members);
router.use("/:guildid/bans", bans);
router.use("/:guildid/emojis", emojis);

//too little to make a route for it,

router.get("/:guildid/webhooks", guildMiddleware, quickcache.cacheFor(60 * 5, true), async (req, res) => {
    try {
        let guild = req.guild;
        let webhooks = guild.webhooks;

        return res.status(200).json(webhooks);
    } catch (error) {
        logText(error, "error");
   
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.get("/:guildid/regions", guildMiddleware, quickcache.cacheFor(60 * 60 * 5, true), (_, res) => {
    return res.status(200).json(globalUtils.getRegions());
});

router.get("/:guildid/integrations", guildMiddleware, guildPermissionsMiddleware("MANAGE_GUILD"), async (_, res) => {
    return res.status(200).json([]);
}); //Stubbed for now

router.get("/:guildid/vanity-url", guildMiddleware, guildPermissionsMiddleware("ADMINISTRATOR"), quickcache.cacheFor(60 * 10), async (req, res) => {
    try {
        return res.status(200).json({
            code: req.guild.vanity_url_code
        });
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.patch("/:guildid/vanity-url", guildMiddleware, guildPermissionsMiddleware("ADMINISTRATOR"), async (req, res) => {
    try {
        let code = req.body.code;

        if (!code || code === "") {
            code = null;
        }

        let tryUpdate = await global.database.updateGuildVanity(req.guild.id, code);

        if (tryUpdate === 0) {
            return res.status(400).json({
                code: 400,
                code: "Vanity URL is taken or invalid."
            });
        } else if (tryUpdate === -1) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        } else {
            req.guild.vanity_url_code = code;

            return res.status(200).json({
                code: code
            })
        }
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.get("/:guildid/application-command-index", guildMiddleware, async (req, res) => {
    return res.status(403).json({
      code: 403,
      message: "This is a v9 endpoint, we will not implement the full set of v9. Do not make an issue about this."
    });
})

module.exports = router;