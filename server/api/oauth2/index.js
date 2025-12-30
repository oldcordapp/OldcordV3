const express = require('express');
const { logText } = require('../../helpers/logger');
const router = express.Router({ mergeParams: true });
const applications = require('./applications');
const tokens = require('./tokens');
const globalUtils = require('../../helpers/globalutils');
const errors = require('../../helpers/errors');

router.use("/applications", applications);
router.use("/tokens", tokens);
router.get("/authorize", async (req, res) => {
    try {
        let account = req.account;

        if (account.bot) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED);  
        }

        let client_id = req.query.client_id;
        let scope = req.query.scope;

        if (!client_id) {
            return res.status(400).json({
                code: 400,
                client_id: "This parameter is required"
            }); //figure this error response out
        }

        if (!scope) {
            return res.status(400).json({
                code: 400,
                scope: "This parameter is required"
            }); // citation 2
        }

        let return_obj = {
            authorized: false
        };

        let application = await global.database.getApplicationById(client_id);

        if (!application) {
            return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
        }

        if (scope.includes('bot')) {
            let bot = await global.database.getBotByApplicationId(application.id);

            if (!bot) {
                return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
            }

            if (!bot.public && application.owner.id != account.id) {
                return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
            }
            
            let is_public = bot.public;
            let requires_code_grant = bot.require_code_grant;

            delete bot.public;
            delete bot.require_code_grant;
            delete bot.token;

            application.bot = bot;
            application.bot_public = is_public;
            application.bot_require_code_grant = requires_code_grant;
        }

        delete application.redirect_uris;
        delete application.rpc_application_state;
        delete application.rpc_origins;
        delete application.secret;
        delete application.owner; //to-do this somewhere else

        return_obj.application = application;

        if (application.bot) {
            return_obj.bot = application.bot;
        }

        return_obj.redirect_uri = null;

        return_obj.user = globalUtils.miniUserObject(account);

        let guilds = await global.database.getUsersGuilds(account.id);

        let guilds_array = [];

        if (guilds.length > 0) {
            for(var guild of guilds) {
                let isOwner = guild.owner_id === account.id;
                let isStaffOverride = req.is_staff && req.staff_details.privilege >= 3;
                let hasPermission = (isOwner || isStaffOverride) || global.permissions.hasGuildPermissionTo(guild, account.id, "ADMINISTRATOR", null) || global.permissions.hasGuildPermissionTo(guild, account.id, "MANAGE_GUILD", null);

                if (hasPermission) {
                    guilds_array.push({
                        id: guild.id,
                        icon: guild.icon,
                        name: guild.name,
                        permissions: 2146958719, //we'll need to fetch this again from somewhere
                        region: null
                    });
                }
            }
        }

        return_obj.guilds = guilds_array;

        return res.status(200).json(return_obj);
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

router.post("/authorize", async (req, res) => {
    try {
        let account = req.account;

        if (account.bot) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED);  
        }

        let client_id = req.query.client_id;
        let scope = req.query.scope;
        let permissions = parseInt(req.query.permissions);

        if (!client_id) {
            return res.status(400).json({
                code: 400,
                client_id: "This parameter is required"
            });
        }

        if (!scope) {
            return res.status(400).json({
                code: 400,
                scope: "This parameter is required"
            });
        }

        if (!permissions || isNaN(permissions)) {
            permissions = 0;
        }

        let application = await global.database.getApplicationById(client_id);

        if (!application) {
            return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
        }

        let guild_id = null;

        if (scope === 'bot') {
            guild_id = req.body.bot_guild_id || req.body.guild_id;

            let bot = await global.database.getBotByApplicationId(application.id);

            if (!bot) {
                return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
            }

            if (!bot.public && application.owner.id != account.id) {
                return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
            }
        
            application.bot = bot;
        }

        let guilds = await global.database.getUsersGuilds(account.id);

        if (!guilds || guild_id === null) {
            return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
        }

        let guild = guilds.find(x => x.id === guild_id);

        if (!guild) {
            return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
        }

        let member = guild.members.find(x => x.id === account.id);

        if (!member) {
            return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
        }

        let botAlrThere = guild.members.find(x => x.id === application.bot.id);

        if (botAlrThere) {
            return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
        }

        let isOwner = guild.owner_id === account.id;
        let isStaffOverride = req.is_staff && req.staff_details.privilege >= 3;
        let hasPermission = (isOwner || isStaffOverride) || global.permissions.hasGuildPermissionTo(guild, account.id, "ADMINISTRATOR", null) || global.permissions.hasGuildPermissionTo(guild, account.id, "MANAGE_GUILD", null);

        if (hasPermission) {
            let isBanned = await database.isBannedFromGuild(guild.id, application.bot.id);

            if (isBanned) {
                return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
            }

            let tryJoinBot = await global.database.joinGuild(application.bot.id, guild);

            if (!tryJoinBot) {
                return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
            }

            await global.dispatcher.dispatchEventTo(application.bot.id, "GUILD_CREATE", guild);

            await global.dispatcher.dispatchEventInGuild(guild, "GUILD_MEMBER_ADD", {
                roles: [],
                user: globalUtils.miniBotObject(application.bot),
                guild_id: guild.id
            });

            await global.dispatcher.dispatchEventInGuild(guild, "PRESENCE_UPDATE", {
                ...globalUtils.getUserPresence({
                    user: globalUtils.miniUserObject(application.bot)
                }),
                roles: [],
                guild_id: guild.id
            });

            return res.json({ location: `${req.protocol}://${req.get('host')}/oauth2/authorized` })
        } else {
            return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
        }
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

module.exports = router;