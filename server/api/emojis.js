const express = require('express');
const { logText } = require('../helpers/logger');
const { guildPermissionsMiddleware, guildMiddleware } = require('../helpers/middlewares');
const globalUtils = require('../helpers/globalutils');
const Snowflake = require('../helpers/snowflake');
const fs = require('fs');
const router = express.Router({ mergeParams: true });
const quickcache = require('../helpers/quickcache');
const errors = require('../helpers/errors');

router.get("/", guildMiddleware, guildPermissionsMiddleware("MANAGE_EMOJIS"), quickcache.cacheFor(60 * 5, true), async (req, res) => {
    try {
        let guild = req.guild;
        let emojis = guild.emojis;

        return res.status(200).json(emojis);
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

router.post("/", guildMiddleware, guildPermissionsMiddleware("MANAGE_EMOJIS"), async (req, res) => {
    try {
        let account = req.account;
        let guild = req.guild;

        if (guild.emojis.length >= global.config.limits['emojis_per_guild'].max) {
            return res.status(404).json({
                code: 404,
                message: `Maximum emojis per guild exceeded (${global.config.limits['emojis_per_guild'].max})`
            });  
        }

        if (!req.body.name) {
            return res.status(400).json({
                code: 400,
                name: "This field is required."
            });  
        }

        if (req.body.name.length < global.config.limits['emoji_name'].min || req.body.name.length >= global.config.limits['emoji_name'].max) {
            return res.status(400).json({
                code: 400,
                name: `Must be between ${global.config.limits['emoji_name'].min} and ${global.config.limits['emoji_name'].max} characters.`
            });  
        }

        const base64Data = req.body.image.split(';base64,').pop();
        const mimeType = req.body.image.split(';')[0].split(':')[1];
        const extension = mimeType.split('/')[1];

        let emoji_id = Snowflake.generate();

        if (!fs.existsSync(`./www_dynamic/emojis`)) {
            fs.mkdirSync(`./www_dynamic/emojis`, { recursive: true });
        }

        const filePath = `./www_dynamic/emojis/${emoji_id}.${extension}`;

        const imageBuffer = Buffer.from(base64Data, 'base64');

        fs.writeFileSync(filePath, imageBuffer);

        let tryCreateEmoji = await global.database.createCustomEmoji(guild, account, emoji_id, req.body.name);

        if (!tryCreateEmoji) {
            return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }

        let currentEmojis = guild.emojis;

        for(var emoji of currentEmojis) {
            emoji.roles = [];
            emoji.require_colons = true;
            emoji.managed = false;
            emoji.allNamesString = `:${emoji.name}:`
        }

        await global.dispatcher.dispatchEventInGuild(guild, "GUILD_EMOJIS_UPDATE", {
            guild_id: guild.id,
            emojis: currentEmojis,
            guild_hashes: {
                version: 1,
                roles: {
                    hash: "placeholder",
                    omitted: false
                },
                metadata: {
                    hash: "placeholder2",
                    omitted: false
                },
                channels: {
                    hash: "placeholder3",
                    omitted: false
                }
            }
        });

        return res.status(201).json({
            allNamesString: `:${req.body.name}:`,
            guild_id: guild.id,
            id: emoji_id,
            managed: false,
            name: req.body.name,
            require_colons: true,
            roles: [],
            user: globalUtils.miniUserObject(account)
        })
    } catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

router.patch("/:emoji", guildMiddleware, guildPermissionsMiddleware("MANAGE_EMOJIS"), async (req, res) => {
    try {
        let guild = req.guild;
        let emoji_id = req.params.emoji;
        let emoji = req.guild.emojis.find(x => x.id === emoji_id);

        if (emoji == null) {
            return res.status(404).json(errors.response_404.UNKNOWN_EMOJI);  
        }

        if (!req.body.name) {
            return res.status(400).json({
                code: 400,
                name: "This field is required"
            });   
        }

        if (req.body.name.length < global.config.limits['emoji_name'].min || req.body.name.length >= global.config.limits['emoji_name'].max) {
            return res.status(400).json({
                code: 400,
                name: `Must be between ${global.config.limits['emoji_name'].min} and ${global.config.limits['emoji_name'].max} characters.`
            });  
        }

        let tryUpdate = await global.database.updateCustomEmoji(guild, emoji_id, req.body.name);

        if (!tryUpdate) {
            return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }

        let currentEmojis = guild.emojis;

        for(var emoji2 of currentEmojis) {
            emoji2.roles = [];
            emoji2.require_colons = true;
            emoji2.managed = false;
            emoji2.allNamesString = `:${emoji.name}:`
        }

        await global.dispatcher.dispatchEventInGuild(guild, "GUILD_EMOJIS_UPDATE", {
            guild_id: guild.id,
            emojis: currentEmojis,
            guild_hashes: {
                version: 1,
                roles: {
                    hash: "placeholder",
                    omitted: false
                },
                metadata: {
                    hash: "placeholder2",
                    omitted: false
                },
                channels: {
                    hash: "placeholder3",
                    omitted: false
                }
            }
        });

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

router.delete("/:emoji", guildMiddleware, guildPermissionsMiddleware("MANAGE_EMOJIS"), async (req, res) => {
    try {
        let guild = req.guild;
        let emoji_id = req.params.emoji;
        let emoji = req.guild.emojis.find(x => x.id === emoji_id);

        if (emoji == null) {
            return res.status(404).json(errors.response_404.UNKNOWN_EMOJI);  
        }

        let tryDelete = await global.database.deleteCustomEmoji(guild, emoji_id);

        if (!tryDelete) {
            return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }

        let currentEmojis = guild.emojis;

        for(var emoji2 of currentEmojis) {
            emoji2.roles = [];
            emoji2.require_colons = true;
            emoji2.managed = false;
            emoji2.allNamesString = `:${emoji.name}:`
        }

        await global.dispatcher.dispatchEventInGuild(guild, "GUILD_EMOJIS_UPDATE", {
            guild_id: guild.id,
            emojis: currentEmojis,
            guild_hashes: {
                version: 1,
                roles: {
                    hash: "placeholder",
                    omitted: false
                },
                metadata: {
                    hash: "placeholder2",
                    omitted: false
                },
                channels: {
                    hash: "placeholder3",
                    omitted: false
                }
            }
        });

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");
        
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

module.exports = router;