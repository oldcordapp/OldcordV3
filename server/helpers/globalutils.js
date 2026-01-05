const crypto = require('crypto');
const encode = require('./base64url');
const fs = require('fs');
const { logText } = require('./logger');

const configPath = "./config.json";

if (!fs.existsSync(configPath)) {
    console.error("No config.json file exists: Please create one using config.example.json as a template.");
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const globalUtils = {
    config: config,
    badEmails: null,
    nonStandardPort: config.includePortInUrl ? (config.secure ? config.port != 443 : config.port != 80) : false,
    generateSsrc() {
        return crypto.randomBytes(4).readUInt32BE(0);
    },
    generateGatewayURL: (req) => {
        let host = req.headers['host'];
        if (host) host = host.split(':', 2)[0];
        let baseUrl = config.gateway_url == "" ? (host ?? config.base_url) : config.gateway_url;
        return `${config.secure ? 'wss' : 'ws'}://${baseUrl}${(config.includePortInWsUrl && (config.secure ? config.ws_port != 443 : config.ws_port != 80)) ? `:${config.ws_port}` : ""}`;
    },
    generateRTCServerURL: () => {
        return config.signaling_server_url == "" ? (config.base_url + ":" + config.signaling_server_port) : config.signaling_server_url;
    },
    unavailableGuildsStore: [],
    generateString: (length) => {
        let result = '';
        let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let charactersLength = characters.length;
    
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
    
        return result;
    },
    getUserPresence: (member) => {
        const userId = String(member.id || member.user?.id);
        const uSessions = global.userSessions.get(userId);
        const activeSessions = uSessions ? Array.from(uSessions).filter(s => !s.dead && s.presence) : [];

        if (activeSessions.length > 0) {
            const statuses = activeSessions.map(s => s.presence.status);

            let finalStatus = "offline";

            if (statuses.includes("online")) {
                finalStatus = "online";
            } else if (statuses.includes("dnd")) {
                finalStatus = "dnd";
            } else if (statuses.includes("idle")) {
                finalStatus = "idle";
            }

            let primarySession = activeSessions.find(s => s.presence.activities?.length > 0) || activeSessions[0];

            return {
                status: finalStatus,
                game_id: primarySession.presence.game_id || null,
                activities: primarySession.presence.activities || [],
                user: globalUtils.miniUserObject(member.user || primarySession.user)
            };
        }

        return {
            status: "offline",
            game_id: null,
            activities: [],
            user: globalUtils.miniUserObject(member.user)
        };
    },
    getGuildPresences: (guild) => {
        let presences = [];

        for(var member of guild.members) {
            let presence = globalUtils.getUserPresence(member);

            presences.push(presence);
        }

        return presences;
    },
    getGuildOnlineUserIds: (guild_id) => {
        let user_ids = new Set();

        for (let [userId, sessions] of global.userSessions) {
            let isOnlineAndVisible = sessions.some(s => {
                return !s.dead && s.presence?.status !== 'offline' && s.presence?.status !== 'invisible';
            });

            if (isOnlineAndVisible) {
                if (sessions[0].guilds?.some(g => g.id === guild_id)) {
                    user_ids.add(userId);
                }
            }
        }

        return Array.from(user_ids);
    },
    generateMemorableInviteCode: () => {
        let code = "";

        var words = [
            "karthus",
            "terrorblade",
            "remora",
            "archon",
            "phantom",
            "charmander",
            "azmodan",
            "landslide",
            "anivia",
            "biggs",
            "rosalina",
            "overlord",
            "sephiroth",
            "cloud",
            "tifa",
            "illidan",
            "jaina",
            "arthas",
            "sylvanas",
            "thrall",
            "invoker",
            "pudge",
            "crystal",
            "anti",
            "jinx",
            "lux",
            "zed",
            "yasuo",
            "ahri"
        ];

        for(var i = 0; i < 3; i++) {
            code += words[Math.floor(Math.random() * words.length)] + '-'
        };

        code = code.substring(code.lastIndexOf('-'), -1);

        return code;
    },
    addClientCapabilities: (client_build, obj) => {
        if (client_build === "thirdPartyOrMobile") {
            const now = new Date();
            const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
            client_build = `${months[now.getMonth()]}_${now.getDate()}_${now.getFullYear()}`;
        }
        let parts = client_build ? client_build.split('_') : null;
        if (!parts || parts.length < 3) {
            //Invalid release date format. Use defaults.
            obj.client_build = "";
            obj.client_build_date = new Date();
            obj.channel_types_are_ints = false;
            return false;
        } else {
            let month = parts[0];
            let day = parts[1];
            let year = parts[2];
            let date = new Date(`${month} ${day} ${year}`);
            
            obj.client_build = client_build;
            obj.client_build_date = date;
            obj.plural_recipients = (date.getFullYear() == 2016 && date.getMonth() >= 6) || date.getFullYear() >= 2017;
            obj.channel_types_are_ints = obj.plural_recipients;
            if (client_build === "thirdPartyOrMobile") {
                obj.isThirdPartyOrMobile = true;
            }
            return true;
        }
    },
    flagToReason: (flag) => {
        let ret = "";

        switch(flag) {
            case "NO_REGISTRATION":
                ret = "Account registration is currently disabled on this instance."
                break;
            case "NO_GUILD_CREATION":
                ret = "Creating guilds is currently not allowed on this instance."
                break;
            case "NO_INVITE_USE":
                ret = "You are not allowed to accept this invite."
                break;
            case "NO_INVITE_CREATION":
                ret = "Creating invites is not allowed on this instance."
                break;
        }

        return ret;
    },
    getRegions: () => {
        return [{
            id: "2016",
            name: "2015-2016",
            optimal: false,
            deprecated: false,
            custom: true
        }, {
            id: "2017",
            name: "2015-2017",
            optimal: false,
            deprecated: false,
            custom: true
        }, {
            id: "2018",
            name: "2015-2018",
            optimal: false,
            deprecated: false,
            custom: true
        }, {
            id: "everything",
            name: "Everything",
            optimal: false,
            deprecated: false,
            custom: true
        }];
    },
    serverRegionToYear: (region) => {
        return globalUtils.getRegions().find(x => x.id.toLowerCase() == region) ? globalUtils.getRegions().find(x => x.id.toLowerCase() == region).name : "everything"
    },
    canUseServer: (year, region) => {
        let serverRegion = globalUtils.serverRegionToYear(region);
    
        if (serverRegion.toLowerCase() === "everything") {
            return true;
        }
    
        let [firstYear, lastYear] = serverRegion.split('-').map(year => parseInt(year));

        if (year >= firstYear && year <= lastYear) {
            return true;
        }
    
        return false;
    },
    generateToken: (user_id, password_hash) => {
        //sorry ziad but im stealing this from hummus source, love you
        //oh also this: https://user-images.githubusercontent.com/34555296/120932740-4ca47480-c6f7-11eb-9270-6fb3fbbd856c.png

        const key = `${config.token_secret}--${password_hash}`;
        const timeStampBuffer = Buffer.allocUnsafe(4);
        
        timeStampBuffer.writeUInt32BE(((Math.floor(Date.now() / 1000)) - 1293840));

        const encodedTimeStamp = encode(timeStampBuffer);
        const encodedUserId = encode(user_id);
        const partOne = `${encodedUserId}.${encodedTimeStamp}`;
        const encryptedAuth = crypto.createHmac('sha3-224', key).update(partOne).digest();
        const encodedEncryptedAuth = encode(encryptedAuth);
        const partTwo = `${partOne}.${encodedEncryptedAuth}`;

        return partTwo;
    },
    replaceAll: (str, find, replace) => {
        if (typeof find === 'string') {
            find = find.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); // Escape special characters
            find = new RegExp(find, 'g');
        } else if (!(find instanceof RegExp)) {
            throw new TypeError('find must be a string or a RegExp');
        }
    
        return str.replace(find, replace);
    },
    SerializeOverwriteToString(overwrite) {
        return `${overwrite.id}_${overwrite.allow.toString()}_${overwrite.deny.toString()}_${overwrite.type}`;
    },
    SerializeOverwritesToString(overwrites) {
        if (overwrites == null || overwrites.length == 0) {
            return null;
        }

        let ret = "";

        for(var overwrite of overwrites) {
            ret += `${globalUtils.SerializeOverwriteToString(overwrite)}:`;
        }

        ret = ret.slice(0, -1);

        return ret;
    },
    sanitizeObject: (object, toSanitize = []) => {
        const sanitizedObject = { ...object };

        if (toSanitize.length > 0) {
            toSanitize.forEach(property => {
                delete sanitizedObject[property];
            });
        }

        return sanitizedObject;
    },
    buildGuildObject: (guild, req) => {
        if (!guild) return null;

        if (!req.account) return null;

        if (guild.region != "everything" && req.client_build_date && req.client_build_date.getFullYear() != parseInt(guild.region)) {
            let sessions = global.userSessions.get(req.account.id);

            if (!sessions) return guild; //fallback ig

            let session = sessions.find(x => x.socket != null && x.socket.client_build === req.client_build);
                
            if (!session) return guild;
            
            let proper_guild = session.guilds.find(x => x.id === guild.id);

            if (!session.guilds || !proper_guild) return guild; //man wtf

            return proper_guild;
        }

        return guild;
    },
    checkUsername: (username) => {
        let allowed = /^[A-Za-z0-9А-Яа-яЁё\s.]+$/;

        if (!username) {
            return {
                code: 400,
                username: "This field is required."
            }
        }

        if (username.length > 32) {
            return {
                code: 400,
                username: "Maximum character length for usernames reached (32).",
            };
        }

        if (username.length < 2) {
            return {
                code: 400,
                username: "Minimum character length for usernames not reached (2).",
            };
        }

        if (username.startsWith(" ")) {
            return {
                code: 400,
                username: "Username cannot start with a space.",
            };
        }

        if (username.endsWith(" ")) {
            return {
                code: 400,
                username: "Username cannot end with a space.",
            };
        }

        if (!allowed.test(username)) {
            return {
                code: 400,
                username: "That username is not allowed. Please try another.",
            };
        }

        return {
            code: 200,
            username: ""
        }
    },
    badEmail: async (email) => {
        try {   
            if (!globalUtils.badEmails) {
                let response = await fetch("https://raw.githubusercontent.com/unkn0w/disposable-email-domain-list/main/domains.txt");
    
                if (!response.ok) {
                    globalUtils.badEmails = new Set(["Bademaildomainlist.com"]);
    
                    return false;
                }
    
                const data = await response.text();
                const domains = new Set(data.split('\n').map(domain => domain.trim()));

                globalUtils.badEmails = domains;
            }

            let domain = email.split('@')[1];

            return globalUtils.badEmails.has(domain);
        } catch (error) {
            logText(error, "error");

            return true;
        }
    },
    validSuperPropertiesObject: (superprops, url, baseUrl, userAgent) => {
        try {
            //Maybe do something with url going forward?

            if (baseUrl === "/api/auth") {
                return true;
            } //This one usually gives an X Super props which returns nothing useful or usually hinders everything - so may aswell skip it {"os":"Linux","browser":"Firefox","device":"","referrer":"","referring_domain":""}

            if (!superprops || !userAgent || typeof superprops !== 'string' || typeof userAgent !== 'string' || superprops === "{}" || superprops.length < 30 || userAgent.length < 10 || superprops.length > 4500) {
                return false;
            }

            let decodedProperties = Buffer.from(superprops, "base64").toString("utf-8");

            if (!decodedProperties || decodedProperties.length < 5) {
                return false;
            }

            let obj = JSON.parse(decodedProperties);

            let points = 0;
            let to_check = [
                "os",
                "browser",
                "device",
                "referrer",
                "referring_domain",
                "browser_user_agent"
            ];

            for(var check of to_check) {
                let val = obj[check];

                if (obj && val) {
                    points++;

                    if (check === "browser_user_agent" && val !== userAgent) {
                        points++;
                    }
                }
            } //to-do make this much, much better please.

            return points >= 2;
        }
        catch (error) {
            logText(error, "error");

            return false;
        }
    },
    prepareAccountObject: (rows, relationships) => {
        if (rows === null || rows.length === 0) {
            return null;
        }

        const user = {
            id: rows[0].id,
            username: rows[0].username,
            discriminator: rows[0].discriminator,
            avatar: rows[0].avatar,
            email: rows[0].email,
            password: rows[0].password,
            token: rows[0].token,
            verified: rows[0].verified,
            mfa_enabled: rows[0].mfa_enabled, //MFA_SMS is another flag in of itself, not looking forward to implementing that.
            premium: true,
            flags: rows[0].flags ?? 0,
            bot: rows[0].bot,
            created_at: rows[0].created_at,
            relationships: relationships,
            settings: JSON.parse(rows[0].settings),
            claimed: true
        };

        if (rows[0].disabled_until != null) {
            user.disabled_until = rows[0].disabled_until;
        }

        if (rows[0].disabled_reason != null) {
            user.disabled_reason = rows[0].disabled_reason;
        }

        return user;
    },
    areWeFriends: (user1, user2) => {
        if (user1.bot || user2.bot) {
            return false;
        }
        let ourRelationships = user1.relationships;
        let theirRelationships = user2.relationships;

        let relationshipState = theirRelationships.find(x => x.id === user1.id);
        let ourRelationshipState = ourRelationships.find(x => x.id === user2.id);

        if (!ourRelationshipState) {
            ourRelationships.push({
                id: user2.id,
                type: 0,
                user: globalUtils.miniUserObject(user2)
            });

            ourRelationshipState = ourRelationships.find(x => x.user.id == user2.id);
        }

        if (!relationshipState) {
            theirRelationships.push({
                id: user1.id,
                type: 0,
                user: globalUtils.miniUserObject(user1)
            })

            relationshipState = theirRelationships.find(x => x.id === user1.id);
        }

        return relationshipState.type === 1 && ourRelationshipState.type === 1;
    },
    parseMentions: (text) => {
        let result = {
            mentions: [],
            mention_roles: [],
            mention_everyone: false,
            mention_here: false,
        };

        if (typeof text !== "string" || !text)
            return result;

        let i = 0;
        while (i < text.length) {
            switch (text[i++]) {
                case '\\':
                    //Escape: Skip next char
                    i++;
                    break;

                case '@':
                    if (text.startsWith("everyone", i)) {
                        //Mention @everyone
                        result.mention_everyone = true;
                        i += "everyone".length;
                        break;
                    }
                    if (text.startsWith("here", i)) {
                        //Mention @here
                        result.mention_everyone = true;
                        result.mention_here = true; //keep this for internal tracking i guess? but @here, and @everyone are bundled under the same logic internally
                        i += "here".length;
                        break;
                    }
                    break;

                case '<':
                    if (text[i++] != '@')
                        break; //Ignore non-user mentions

                    //Check type (optional)
                    let targetArray = result.mentions;
                    switch (text[i]) {
                        case '!': //Nickname
                            i++;
                            break;

                        case '&': //Role
                            targetArray = result.mention_roles;
                            i++;
                            break;
                    }

                    //Read snowflake
                    let snowflake = "";
                    while (true) {
                        if (i >= text.length) {
                            //Snowflake not complete
                            snowflake = "";
                            break;
                        }

                        const c = text[i];
                        if (c == '>') {
                            //Completed valid snowflake
                            break;
                        }

                        if (c >= '0' && c <= '9') {
                            snowflake += c;
                            i++;
                        } else {
                            //Invalid snowflake
                            snowflake = "";
                            break;
                        }
                    }

                    if (snowflake && snowflake.length > 0)
                        targetArray.push(snowflake);

                    break;
                    
                case '`':
                    let startTicks = 1;
                    let startIndex = i;
                    if (text[i++] == '`') {
                        startTicks++;
                        if (text[i++] == '`') {
                            startTicks++;
                        }
                    }
                    
                    let success = false;
                    while (i < text.length) {
                        if (text[i++] == '`') {
                            let endTicks = 1;
                            while (endTicks < startTicks) {
                                if (text[i++] != '`')
                                    break;
                                endTicks++;
                            }
                            
                            if (endTicks >= startTicks && text[i] != '`') {
                                success = true;
                                break;
                            }
                        }
                    }
                    if (!success)
                        i = startIndex;
                    break;
            }
        }

        return result;
    },
    pingPrivateChannel: async (channel) => {
        for(var recipient of channel.recipients) {
            await globalUtils.pingPrivateChannelUser(channel, recipient.id);
        }
    },
    pingPrivateChannelUser: async (private_channel, recipient_id) => {
        let userPrivChannels = await database.getPrivateChannels(recipient_id);
        
        let sendCreate = false;
        if (!userPrivChannels) {
            //New
            userPrivChannels = [private_channel.id];
            sendCreate = true;
        } else {
            if (userPrivChannels.includes(private_channel.id)) {
                //Remove old entry
                const oldIndex = userPrivChannels.indexOf(private_channel.id);
                userPrivChannels.splice(oldIndex, 1);
            } else {
                sendCreate = true;
            }

            //Add to top
            userPrivChannels.unshift(private_channel.id);
        }

        await database.setPrivateChannels(recipient_id, userPrivChannels);
        
        if (sendCreate) {
            await global.dispatcher.dispatchEventTo(recipient_id, "CHANNEL_CREATE", function() {
                return globalUtils.personalizeChannelObject(this.socket, private_channel);
            });
        }
    },
    formatMessage: (row, author, attachments, mentions, mention_roles, reactions, isWebhook) => {
        return {
            type: row.type, //8 = boost, 9 = boosted server, guild has reached level 1, 10 = level 2, 11 = level 3 (12 = i have added what a bla bla to this channel?)
            guild_id: row.guild_id, //Is this necessary here?
            id: row.message_id,
            content: row.content,
            channel_id: row.channel_id,
            author: globalUtils.miniUserObject(author),
            attachments: attachments,
            embeds: row.embeds == null ? [] : JSON.parse(row.embeds),
            mentions: mentions,
            mention_everyone: row.mention_everyone,
            mention_roles: mention_roles,
            nonce: row.nonce,
            edited_timestamp: row.edited_timestamp,
            timestamp: row.timestamp,
            reactions: reactions,
            tts: row.tts,
            pinned: row.pinned,
            //overrides: (!row.overrides ? [] : JSON.parse(row.overrides)), - what is this even for?
            ...(isWebhook && { webhook_id: row.author_id.split('_')[1] })
        };
    },
    channelTypeToString: (type) => {
        switch (type) {
            case 0: return "text";
            case 1: return "dm";
            case 2: return "voice";
            case 3: return "group_dm";
            case 4: return "category";
            default: return "text";
        }
    },
    personalizeMessageObject: (msg, guild, client_build_date) => {
        let boostLvlConversion = {
            9: 1,
            10: 2,
            11: 3
        }

        if (msg.id === '1279218211430105089') {
            msg.content = msg.content.replace("[YEAR]", client_build_date.getFullYear());
            msg.author.bot = true;
        }

        if (client_build_date.getFullYear() < 2019 && msg.type >= 8 && msg.type != 12 && guild) {
            let levelReachedText = "";

            if (boostLvlConversion[msg.type]) {
                levelReachedText = `${guild.name} has reached Level ${boostLvlConversion[msg.type]}!`;
            }

            msg.content = `${msg.author.username} just boosted the server! ${levelReachedText}`;
            msg.type = 0;
            msg.author = {
                username: "Oldcord",
                discriminator: "0000",
                bot: true,
                id: "1279218211430105089",
                avatar: null
            };
        }

        if (client_build_date <= new Date(2017, 0, 23) && msg.type === 7 && guild) {
            msg.content = `${msg.author.username} has joined the server!`;
            msg.type = 0;
            msg.author = {
                username: "Oldcord",
                discriminator: "0000",
                bot: true,
                id: "1279218211430105089",
                avatar: null
            };
        }

        return msg;
    },
    personalizeChannelObject: (req, channel, user = null) => {
        if (!req)
            return channel;
        
        if (!req.plural_recipients && channel.type >= 2)
            return null;
        
        let clone = {}
        Object.assign(clone, channel);
        
        if (channel.recipients)
            clone.recipients = channel.recipients.filter(r => r.id != (req.user || user).id);
        
        clone.is_private = clone.recipients && clone.recipients.length > 0 ? true : false;
        
        if (!req.plural_recipients && clone.recipients) {
            clone.recipient = clone.recipients[0];
            delete clone.recipients;
        }
        
        if (!req.channel_types_are_ints)
            clone.type = globalUtils.channelTypeToString(parseInt(channel.type));
        
        return clone;
    },
    usersToIDs: (array) => {
        let IDs = [];
        
        for (let i = 0; i < array.length; i++)
            if (array[i].id)
                IDs.push(array[i].id);
            else if ((typeof array[i]) == "string")
                IDs.push(array[i]);
            
        return IDs;
    },
    miniUserObject: (user) => {
        return {
            username: user.username,
            discriminator: user.discriminator,
            id: user.id,
            avatar: user.avatar,
            bot: user.bot,
            flags: user.flags,
            premium: user.premium || true
        };
    },
    miniBotObject: (bot) => {
        delete bot.token;

        return bot;
    }
};

module.exports = globalUtils;
