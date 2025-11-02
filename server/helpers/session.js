const globalUtils = require('./globalutils');
const { logText } = require("./logger");
const zlib = require('zlib');
const Snowflake = require('../helpers/snowflake');

let erlpack = null;

if (globalUtils.config.gateway_erlpack) {
    erlpack = require('@spacebarchat/erlpack');
}

//Adapted from Hummus' handling of sessions & whatnot

const BUFFER_LIMIT = 500; //max dispatch event backlog before terminating?
const SESSION_TIMEOUT = 10 * 1000; //10 seconds brooo

class session {
    constructor(id, socket, user, token, ready, presence, guild_id = 0, channel_id = 0, type = 'gateway', apiVersion = 3, capabilities) {
        this.id = id;
        this.socket = socket;
        this.token = token;
        this.user = user;
        this.seq = 0;
        this.time = Date.now();
        this.ready = ready;
        this.presence = presence;
        this.type = type ?? 'gateway'; //or voice
        this.dead = false;
        this.lastMessage = Date.now();
        this.ratelimited = false;
        this.messages = 0;
        this.channel_id = channel_id;
        this.guild_id = guild_id;
        this.eventsBuffer = [];
        this.guilds = [];
        this.unavailable_guilds = [];
        this.presences = [];
        this.read_states = [];
        this.relationships = [];
        this.subscriptions = [];
        this.guildCache = [];
        this.apiVersion = apiVersion;
        this.capabilities = capabilities; // Either an integer (recent/third party) or a build date (specific build capabilities). We can use it to give builds/capability flag specific JSON object props.
    }
    onClose(code) {
        this.dead = true;
        this.socket = null;

        setTimeout(this.terminate.bind(this), SESSION_TIMEOUT);
    }
    subscribe(subscriptionType, parameters) {
        if (this.type !== 'gateway') {
            return;
        }

        let valid_subs = [
            "GUILD_MEMBER_LIST_UPDATE"
        ]

        if (!valid_subs.includes(subscriptionType)) {
            return false; //invalid event subscription type
        }

        if (subscriptionType === "GUILD_MEMBER_LIST_UPDATE") {
            if (this.subscriptions.find(x => x.type === "GUILD_MEMBER_LIST_UPDATE" && x.channel === parameters.channel && x.range === parameters.range)) {
                return false; //already subbed to member update events for this range in the channel
            }

            this.subscriptions.push({
                type: "GUILD_MEMBER_LIST_UPDATE",
                channel: parameters.channel,
                range: parameters.range
            })
        }

        return true;
    }
    async updatePresence(status, game_id = null, save_presence = true) {
        if (this.type !== 'gateway') {
            return;
        }

        try {
            if (this.presence.status.toLowerCase() === status.toLowerCase() && this.presence.game_id === game_id) {
                return;
            }

            let valid_status = [
                "online",
                "idle",
                "invisible",
                "offline",
                "dnd"
            ];

            if (!valid_status.includes(status.toLowerCase())) return;

            if (status.toLowerCase() != "offline" && save_presence) {
                this.user.settings.status = status.toLowerCase();

                await global.database.updateSettings(this.user.id, this.user.settings);

                await this.dispatch("USER_SETTINGS_UPDATE", this.user.settings);

                //prevent users from saving offline as their last seen status... as u cant do that
            }

            if (status === "invisible") {
                status = "offline"; //they shouldnt be able to tell this
            }

            this.presence.status = status.toLowerCase();
            this.presence.game_id = game_id;

            await this.dispatchPresenceUpdate();
        } catch (error) {
            logText(error, "error");
        }
    }
    async dispatch(type, payload) {
        if (this.type !== 'gateway') {
            return;
        }

        if (!this.ready) return;
        if (this.dead) return;

        let sequence = ++this.seq;

        if (this.eventsBuffer.length > BUFFER_LIMIT) {
            this.eventsBuffer.shift();
            this.eventsBuffer.push({
                type: type,
                payload: payload,
                seq: sequence
            });
        } else {
            this.eventsBuffer.push({
                type: type,
                payload: payload,
                seq: sequence
            })
        }

        //Evaluate dynamic payload
        if ((typeof payload) == "function") {
            payload = await payload.call(this);
        }

        if (payload) {
            this.send({
                op: 0,
                t: type,
                s: sequence,
                d: payload
            });
        }
    }
    async dispatchPresenceUpdate() {
        if (this.type !== 'gateway') {
            return;
        }

        let current_guilds = await global.database.getUsersGuilds(this.user.id);

        this.guilds = current_guilds;

        if (current_guilds.length == 0) {
            this.presence.guild_id = null;

            return await this.dispatch("PRESENCE_UPDATE", this.presence);
        }

        for (let i = 0; i < current_guilds.length; i++) {
            let guild = current_guilds[i];

            this.presence.guild_id = guild.id;

            let personalizedPresenceObj = this.presence;

            if (this.socket) {
                personalizedPresenceObj = globalUtils.personalizePresenceObject(this.socket, this.presence);
            } //basically the socket has died from termination - bled out, whatever, so we cant customize their shit

            await global.dispatcher.dispatchEventInGuild(guild, "PRESENCE_UPDATE", personalizedPresenceObj);
        }
    }
    async dispatchSelfUpdate() {
        if (this.type !== 'gateway') {
            return;
        }

        let current_guilds = await global.database.getUsersGuilds(this.user.id);

        this.guilds = current_guilds;

        if (current_guilds.length == 0) return;

        for (let i = 0; i < current_guilds.length; i++) {
            let guild = current_guilds[i];

            let our_member = guild.members.find(x => x.id === this.user.id);

            if (!our_member) continue;

            await global.dispatcher.dispatchEventInGuild(guild, "GUILD_MEMBER_UPDATE", {
                roles: our_member.roles,
                user: globalUtils.miniUserObject(our_member.user),
                guild_id: guild.id
            });
        }
    }
    async terminate() {
        if (!this.dead) return; //resumed in time, lucky bastard

        let uSessions = global.userSessions.get(this.user.id);

        if (uSessions) {
            uSessions.splice(uSessions.indexOf(this), 1);

            if (uSessions.length >= 1) {
                global.userSessions.set(this.user.id, uSessions);
            } else {
                global.userSessions.delete(this.user.id);
            }
        }

        global.sessions.delete(this.id);

        if (this.type === 'gateway') {
            if (!uSessions || uSessions.length == 0) {
                await this.updatePresence("offline", null);
            } else await this.updatePresence(uSessions[uSessions.length - 1].presence.status, uSessions[uSessions.length - 1].presence.game_id);
        }
    }
    send(payload) {
        if (this.dead) return;
        if (this.ratelimited) return;

        if (this.socket.wantsEtf && this.type === 'gateway' && erlpack !== null) {
            payload = erlpack.pack(payload);
        }

        if (this.socket.wantsZlib && this.type === 'gateway') {
            //Closely resembles Discord's zlib implementation from https://gist.github.com/devsnek/4e094812a4798d8f10428d04ee02cab7
            payload = this.socket.wantsEtf ? payload : JSON.stringify(payload);

            let buffer;

            buffer = zlib.deflateSync(payload, { chunkSize: 65535, flush: zlib.constants.Z_SYNC_FLUSH, finishFlush: zlib.constants.Z_SYNC_FLUSH, level: zlib.constants.Z_BEST_COMPRESSION })

            if (!this.socket.zlibHeader) {
                buffer = buffer.subarray(2, buffer.length);
            }
            else this.socket.zlibHeader = false;

            this.socket.send(buffer);
        } else this.socket.send(this.socket.wantsEtf ? payload : JSON.stringify(payload));

        this.lastMessage = Date.now();
    }
    start() {
        global.sessions.set(this.id, this);

        if (this.type === 'gateway') {
            let uSessions = global.userSessions.get(this.user.id);

            if (!uSessions) {
                uSessions = [];
            }

            uSessions.push(this);
            global.userSessions.set(this.user.id, uSessions);
        }
    }
    async readyUp(body) {
        if (this.type === 'gateway') {
            this.send({
                op: 0,
                s: ++this.seq,
                t: "READY",
                d: body
            });
        }

        this.ready = true;
    }
    async resume(seq, socket) {
        if (this.timeout) clearTimeout(this.timeout);

        this.socket = socket;
        this.dead = false;

        if (this.type === 'gateway') {
            let items = this.eventsBuffer.filter(s => s.seq > seq);

            for (var k of items) {
                this.dispatch(k.type, k.payload);
            }

            this.dispatch("RESUMED", {
                _trace: ["oldcord-v3"]
            });

            this.updatePresence("online", null, false);
        }
    }
    async prepareReady() {
        if (this.type !== 'gateway') {
            return;
        }

        try {
            let month = this.socket.client_build_date.getMonth();
            let year = this.socket.client_build_date.getFullYear();

            this.guilds = await global.database.getUsersGuilds(this.user.id);

            if (this.user.bot) {
                for (var guild of this.guilds) {
                    this.guildCache.push(guild);

                    guild = {
                        id: guild.id,
                        unavailable: true
                    }; //bots cant get this here idk
                }
            } else {
                for (var guild of this.guilds) {
                    if (guild.unavailable) {
                        this.guilds = this.guilds.filter(x => x.id !== guild.id);

                        this.unavailable_guilds.push(guild.id);

                        continue;
                    }

                    if (globalUtils.unavailableGuildsStore.includes(guild.id)) {
                        this.guilds = this.guilds.filter(x => x.id !== guild.id);

                        this.unavailable_guilds.push(guild.id);

                        continue;
                    }

                    if (guild.region != "everything" && !globalUtils.canUseServer(year, guild.region)) {
                        guild.channels = [{
                            type: this.socket.channel_types_are_ints ? 0 : "text",
                            name: guild.name.replace(/" "/g, "_"),
                            topic: `This server only supports ${globalUtils.serverRegionToYear(guild.region)} and you're using ${year}! Please change your client and try again.`,
                            last_message_id: "0",
                            id: `12792182114301050${Math.round(Math.random() * 100).toString()}`,
                            parent_id: null,
                            guild_id: guild.id,
                            permission_overwrites: []
                        }];

                        guild.roles = [{
                            id: guild.id,
                            name: "@everyone",
                            permissions: 104186945,
                            position: 0,
                            color: 0,
                            hoist: false,
                            mentionable: false
                        }]

                        guild.name = `${globalUtils.serverRegionToYear(guild.region)} ONLY! CHANGE BUILD`;
                        guild.owner_id = "1279218211430105089";

                        continue;
                    }

                    let guild_presences = guild.presences;

                    if (guild_presences.length == 0) continue;

                    if (guild_presences.length >= 100) {
                        guild_presences = [
                            guild_presences.find(x => x.user.id === this.user.id)
                        ]
                    }

                    for (var presence of guild_presences) {
                        if (this.presences.find(x => x.user.id === presence.user.id)) continue;

                        this.presences.push({
                            game_id: null,
                            user: globalUtils.miniUserObject(presence.user),
                            activities: [],
                            status: presence.status
                        });
                    }

                    //if (guild.members.length >= 100) {
                    //guild.members = [
                    //guild.members.find(x => x.id === this.user.id)
                    //]
                    //} //uh someone do this better?

                    for (var channel of guild.channels) {
                        if ((year === 2017 && month < 9) || year < 2017) {
                            if (channel.type === 4) {
                                guild.channels = guild.channels.filter(x => x.id !== channel.id);
                            }
                        }

                        if (!this.socket.channel_types_are_ints) {
                            channel.type = channel.type == 2 ? "voice" : "text";
                        }

                        let can_see = await global.permissions.hasChannelPermissionTo(channel, guild, this.user.id, "READ_MESSAGE_HISTORY");

                        if (!can_see) {
                            guild.channels = guild.channels.filter(x => x.id !== channel.id);

                            continue;
                        }

                        let getLatestAcknowledgement = await global.database.getLatestAcknowledgement(this.user.id, channel.id);

                        if (getLatestAcknowledgement) {
                            this.read_states.push(getLatestAcknowledgement);
                        }
                    }
                    
                    guild.properties = structuredClone(guild)

                }
            }

            let tutorial = {
                indicators_suppressed: true,
                indicators_confirmed: [
                    "direct-messages",
                    "voice-conversations",
                    "organize-by-topic",
                    "writing-messages",
                    "instant-invite",
                    "server-settings",
                    "create-more-servers",
                    "friends-list",
                    "whos-online",
                    "create-first-server"
                ]
            }

            let chans = this.user.bot ? await database.getBotPrivateChannels(this.user.id) : await database.getPrivateChannels(this.user.id);
            let filteredDMs = [];

            for (var chan_id of chans) {
                let chan = await database.getChannelById(chan_id);

                if (!chan)
                    continue;

                chan = globalUtils.personalizeChannelObject(this.socket, chan);

                if (!chan)
                    continue;

                filteredDMs.push(chan);
            }

            let connectedAccounts = await global.database.getConnectedAccounts(this.user.id);
            let guildSettings = await global.database.getUsersGuildSettings(this.user.id);
            let notes = await global.database.getNotesByAuthorId(this.user.id);

            this.relationships = this.user.relationships;

            this.readyUp({
                v: this.apiVersion,
                guilds: this.guilds ?? [],
                presences: this.presences ?? [],
                private_channels: filteredDMs,
                relationships: this.relationships ?? [],
                read_state: this.read_states ?? [],
                tutorial: tutorial,
                user: {
                    id: this.user.id,
                    username: this.user.username,
                    avatar: this.user.avatar,
                    email: this.user.email,
                    discriminator: this.user.discriminator,
                    verified: this.user.verified,
                    bot: this.user.bot,
                    premium: this.user.premium || true,
                    claimed: this.user.claimed || true
                },
                user_settings: this.user.settings,
                session_id: this.id,
                sessions: [ {session_id: this.id} ], // spacebar compat
                friend_suggestion_count: 0,
                notes: notes,
                analytics_token: globalUtils.generateString(20),
                experiments: (month == 3 && year == 2018) ? ["2018-4_april-fools"] : [], //for 2018 clients
                connected_accounts: connectedAccounts ?? [],
                guild_experiments: [],
                user_guild_settings: guildSettings ?? [],
                heartbeat_interval: 45 * 1000,
                _trace: ["oldcord-v3"]
            });

            for (var guild of this.unavailable_guilds) {
                await this.dispatch("GUILD_DELETE", {
                    id: guild.id,
                    unavailable: true,
                })
            }

            if (this.user.bot) {
                for (var guild of this.guilds) {
                    if (guild.unavailable) {
                        await this.dispatch("GUILD_CREATE", this.guildCache.find(x => x.id == guild.id));
                    }
                }
            } //ok
        } catch (error) {
            logText(error, "error");
        }
    }
}

module.exports = session;
