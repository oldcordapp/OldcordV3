const { logText } = require('./helpers/logger');
const globalUtils = require('./helpers/globalutils');
const WebSocket = require('ws').WebSocket;
const zlib = require('zlib');
const { OPCODES, gatewayHandlers } = require('./handlers/gateway');

let erlpack = null;

if (globalUtils.config.gateway_erlpack) {
    erlpack = require('@spacebarchat/erlpack')
}

const gateway = {
    server: null,
    port: null,
    debug_logs: false,
    debug(message) {
        if (!this.debug_logs) {
            return;
        }

        logText(message, 'GATEWAY');
    },
    syncPresence: async function (socket, packet) {
        let allSessions = global.userSessions.get(socket.user.id);

        if (!allSessions || allSessions.size === 0) return;

        let setStatusTo = "online";
        let gameField = null;

        if (socket.client_build.includes("2015")) {
            gameField = packet.d.game_id || null;

            if (packet.d.idle_since != null || packet.d.afk === true) {
                setStatusTo = "idle";
                socket.session.last_idle = Date.now();
            }

            if (setStatusTo === "idle" && (packet.d.afk === false || !packet.d.idle_since) && socket.session.last_idle > 0) {
                setStatusTo = "online";
                socket.session.last_idle = 0;
            }
        } else {
            gameField = packet.d.game || null;

            if (packet.d.status) {
                setStatusTo = packet.d.status.toLowerCase();
            }

            if (packet.d.since != 0 || packet.d.afk === true) {
                setStatusTo = "idle";
                socket.session.last_idle = Date.now();
            }

            if (setStatusTo === "idle" && packet.d.afk === false && socket.session.last_idle > 0) {
                setStatusTo = "online";
                socket.session.last_idle = 0;
            }
        }

        // Sync
        for (let session of allSessions) {
            if (session.id !== socket.session.id) {
                session.presence.status = setStatusTo;
                session.presence.game_id = gameField;
                session.last_idle = socket.session.last_idle || 0;
            } //only do this for other sessions, not us as we're gonna update in a sec
        }

        await socket.session.updatePresence(setStatusTo, gameField);
    },
    handleClientConnect: async function (socket, req) {
        const reqHost = req.headers.origin ?? req.headers.host;

        const isInstanceLocal = global.full_url.includes('localhost') || global.full_url.includes('127.0.0.1');
        const isReqLocal = reqHost.includes('localhost') || reqHost.includes('127.0.0.1');

        const isBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/i.test(req.headers['user-agent']);
        let isSameHost = false;

        if (global.full_url === reqHost) {
            isSameHost = true;
        } else if (isInstanceLocal && isReqLocal) {            
            const normalizedInstance = global.full_url.replace('localhost', '127.0.0.1');
            const normalizedReq = reqHost.replace('localhost', '127.0.0.1');

            isSameHost = normalizedInstance === normalizedReq;
        } else {
            isSameHost = false;
        }

        let cookies = req.headers.cookie;

        if (!cookies || !isBrowser) {
            cookies = `release_date=thirdPartyOrMobile;default_client_build=${globalUtils.config.default_client_build || "october_5_2017"};`
        }

        if (!cookies && isSameHost && isBrowser && !globalUtils.config.require_release_date_cookie) {
            cookies = `release_date=${globalUtils.config.default_client_build || "october_5_2017"};default_client_build=${globalUtils.config.default_client_build || "october_5_2017"};`
        }

        let cookieStore = cookies?.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.split('=').map(v => v.trim());
            acc[key] = value;
            return acc;
        }, {});

        if (!cookieStore) {
            cookieStore = {}
        }

        if (!cookies && isSameHost && isBrowser && !cookies?.includes('release_date') && !globalUtils.config.require_release_date_cookie) {
            cookieStore['release_date'] = globalUtils.config.default_client_build || "october_5_2017";
        }

        if (!cookieStore['release_date']) {
            cookies += `release_date=thirdPartyOrMobile;`;
            cookieStore['release_date'] = "thirdPartyOrMobile";
        }
        
        if (!globalUtils.addClientCapabilities(cookieStore['release_date'], socket)) {
            socket.close(1000, 'The release_date cookie is in an invalid format.');
            return;
        }

        if (req.url.includes("compress=zlib-stream")) {
            socket.wantsZlib = true;
            socket.zlibHeader = true;
        }

        if (req.url.includes("encoding=etf")) {
            socket.wantsEtf = true;
        }

        const match = req.url.match(/[?&]v=([^&]*)/);

        if (match && match[1] !== undefined) {
            socket.apiVersion = Number(match[1]);
        }

        socket.cookieStore = cookieStore;

        socket.inCall = false;

        socket.on('close', (code) => this.handleClientClose(socket, code));

        let heartbeat_payload = {
            op: OPCODES.HEARTBEAT_INFO,
            s: null,
            d: {
                heartbeat_interval: 45 * 1000,
                _trace: [
                    JSON.stringify(["oldcord-v3", {micros: 0, calls:["oldcord-v3"]}])
                ]
            }
        }

        heartbeat_payload = socket.wantsEtf ? erlpack.pack(heartbeat_payload) : JSON.stringify(heartbeat_payload)

        if (socket.wantsZlib) {
            let buffer;

            buffer = zlib.deflateSync(heartbeat_payload, { chunkSize: 65535, flush: zlib.constants.Z_SYNC_FLUSH, finishFlush: zlib.constants.Z_SYNC_FLUSH, level: zlib.constants.Z_BEST_COMPRESSION })

            if (!socket.zlibHeader) {
                buffer = buffer.subarray(2, buffer.length);
            }
            else socket.zlibHeader = false;

            socket.send(buffer);
        } else socket.send(heartbeat_payload);

        socket.hb = {
            timeout: null,
            start: () => {
                if (socket.hb.timeout) clearTimeout(socket.hb.timeout);

                socket.hb.timeout = setTimeout(async () => {
                    socket.close(4009, 'Session timed out');
                }, (45 * 1000) + 20 * 1000);
            },
            reset: () => {
                socket.hb.start();
            },
            acknowledge: (d) => {
                socket.session?.send({
                    op: OPCODES.HEARTBEAT_ACK,
                    d: d
                });
            }
        };

        socket.hb.start();

        socket.on('message', (data) => this.handleClientMessage(socket, data));
    },
    handleClientMessage: async function (socket, data) {
        try {
            const msg = socket.wantsEtf ? data : data.toString("utf-8");
            const packet = socket.wantsEtf && erlpack !== null ? erlpack.unpack(msg) : JSON.parse(msg);

            if (packet.op !== 1) {
                this.debug(`Incoming -> ${socket.wantsEtf ? JSON.stringify(packet) : msg}`);
            } //ignore heartbeat stuff

            await gatewayHandlers[packet.op]?.(socket, packet);
        }
        catch (error) {
            logText(error, "error");

            socket.close(4000, 'Invalid payload');
        }
    },
    handleClientClose: async function(socket, code) {
        if (socket.session) {
            if (socket.current_guild) {
                let voiceStates = global.guild_voice_states.get(socket.current_guild.id);
                let possibleIndex = voiceStates.findIndex(x => x.user_id === socket.user.id);
                let myVoiceState = voiceStates[possibleIndex];

                if (myVoiceState) {
                    myVoiceState.channel_id = null;

                    await global.dispatcher.dispatchEventInGuild(socket.current_guild, "VOICE_STATE_UPDATE", myVoiceState);
                }

                voiceStates.splice(possibleIndex, 1);
            }

            socket.session.onClose(code);
        }
    },
    handleEvents: function () {
        const server = gateway.server;

        server.on("listening", () => {
            this.debug("Listening for connections");
        });

        server.on('connection', this.handleClientConnect.bind(this));
    },
    ready: function (server, debug_logs = false) {
        gateway.debug_logs = debug_logs;
        gateway.server = new WebSocket.Server({
            perMessageDeflate: false,
            server: server
        });

        gateway.handleEvents();
    },
};

module.exports = gateway;
