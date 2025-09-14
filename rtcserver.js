const sodium = require('libsodium-wrappers');
const { logText } = require('./helpers/logger');
const session = require('./helpers/session');
const globalUtils = require('./helpers/globalutils');
const WebSocket = require('ws');
const { EventEmitter } = require("node:events");

const rtcServer = {
    port: null,
    signalingServer: null,
    debugLogs: false,
    clients: new Map(),
    emitter: null,
    protocolsMap: new Map(),
    debug(message) {
        if (!this.debugLogs) {
            return;
        }

        logText(message, 'RTC_SERVER');
    },
    start(port, debugLogs) {
        this.emitter = new EventEmitter();
        this.port = port;
        this.debugLogs = debugLogs;
        this.signalingServer = new WebSocket.Server({
            port: port
        });

        this.signalingServer.on('listening', async () => {
            await sodium.ready;

            this.debug(`Server up on port ${this.port}`);
        });

        this.signalingServer.on('connection', async (socket, req) => {
            this.debug(`Client has connected`);

            socket.userAgent = req.headers['user-agent'] ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
            socket.isChrome = /Chrome/.test(socket.userAgent);
            
            socket.send(JSON.stringify({
                op: 8,
                d: {
                    heartbeat_interval: 41250
                }
            }));

            socket.hb = {
                timeout: setTimeout(async () => {
                    socket.close(4009, 'Session timed out');
                }, (45 * 1000) + (20 * 1000)),
                reset: () => {
                    if (socket.hb.timeout != null) {
                        clearInterval(socket.hb.timeout);
                    }

                    socket.hb.timeout = new setTimeout(async () => {
                        socket.close(4009, 'Session timed out');
                    }, (45 * 1000) + 20 * 1000);
                },
                acknowledge: (d) => {
                    let session = socket.session;
                    let base = {
                        op: 6,
                        d: d
                    }
                    let payload = session ? base : JSON.stringify(base);
                    (session || socket).send(payload);
                }
            };

            let keyBuffer = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);

            let identified = false;
            let resumed = false;

            socket.on('close', () => {
                for (const [id, clientSocket] of this.clients) {
                    if (id !== socket.userid) {
                        clientSocket.send(JSON.stringify({
                            op: 13,
                            d: {
                                user_id: socket.userid
                            }
                        }));
                    }
                }

                if (socket.userid) {
                    this.clients.delete(socket.userid);
                }
            });

            socket.on('message', async (data) => {
                let raw_data = Buffer.from(data).toString("utf-8");
                let jason = JSON.parse(raw_data);

                this.debug(`Incoming -> ${raw_data}`);

                if (jason.op === 0) {
                    let userid = jason.d.user_id;
                    let server_id = jason.d.server_id;
                    let sessionid = jason.d.session_id;
                    let token = jason.d.token;

                    if (identified || socket.session) {
                        return socket.close(4005, 'You have already identified.');
                    }

                    identified = true;

                    let user = await global.database.getAccountByUserId(userid);

                    if (user == null || user.disabled_until) {
                        return socket.close(4004, "Authentication failed");
                    }

                    let gatewaySession = global.sessions.get(sessionid);

                    if (!gatewaySession || gatewaySession.user.id !== user.id) {
                        return socket.close(4004, "Authentication failed");
                    }

                    socket.user = user;

                    let sesh = new session(`voice:${sessionid}`, socket, user, token, false, {
                        game_id: null,
                        status: "online",
                        activities: [],
                        user: globalUtils.miniUserObject(socket.user)
                    }, gatewaySession.guild_id, gatewaySession.channel_id, 'voice');

                    socket.session = sesh;
                    socket.gatewaySession = gatewaySession;

                    socket.session.server_id = server_id;

                    socket.session.start();

                    await socket.session.prepareReady();

                    this.debug(`A client's state has changed to -> RTC_CONNECTING`);

                    socket.userid = user.id;

                    this.clients.set(socket.userid, socket);

                    this.debug(`Client ${socket.userid} has identified.`);

                    let roomId = `${socket.gatewaySession.guild_id}-${socket.gatewaySession.channel_id}`;

                    socket.client = await global.mediaserver.join(roomId, user.id, socket, "guild-voice");

                    socket.on("close", () => {
                        global.mediaserver.onClientClose(socket.client);
                    });

                    socket.client.emitter.once("connected", async () => {
                        await socket.client.subscribeToProducers(global.mediaserver);
                    });

                    const generatedSsrc = {
                        audio_ssrc: globalUtils.generateSsrc(),
                        video_ssrc: globalUtils.generateSsrc(),
                        rtx_ssrc: globalUtils.generateSsrc(),
                    };

                    socket.client.initIncomingSSRCs(generatedSsrc);

                    socket.send(JSON.stringify({
                        op: 2,
                        d: {
                            ssrc: generatedSsrc.audio_ssrc,
                            ip: global.mediaserver.ip,
                            port: global.mediaserver.port,
                            modes: ["plain", "xsalsa20_poly1305"],
                            heartbeat_interval: 1
                        }
                    }));
                } else if (jason.op === 3) {
                    if (!socket.hb) return;

                    socket.hb.acknowledge(jason.d);
                    socket.hb.reset();
                } else if (jason.op === 1) {
                    let protocol = jason.d.protocol;
                    
                    this.protocolsMap.set(socket.userid, protocol ?? 'webrtc');

                    global.udpServer.encryptionsMap.set(socket.ssrc, {
                        mode: "xsalsa20_poly1305",
                        key: Array.from(keyBuffer)
                    }); //for the udp server

                    if (protocol === 'webrtc') {
                        let sdp = jason.d.sdp || jason.d.data;
                        let codecs = jason.d.codecs || [{
                            name: "opus",
                            type: "audio",
                            priority: 1000,
                            payload_type: 111
                        }]; //older clients dont have video/screensharing so its just voice yay

                        let answer = await global.mediaserver.onOffer(socket.client, sdp, codecs);

                        return socket.send(JSON.stringify({
                            op: 4,
                            d: {
                                sdp: answer.sdp,
                                audio_codec: "opus",
                                video_codec: answer.selectedVideoCodec
                            }
                        }));
                    } else if (protocol === 'webrtc-p2p') {
                        return socket.send(JSON.stringify({
                            op: 4,
                            d: {
                                peers: Array.from(this.clients.keys()).filter(id => socket.userid != id)
                            }
                        }))
                    } else {
                        return socket.send(JSON.stringify({
                            op: 4,
                            d: {
                                mode: "xsalsa20_poly1305",
                                secret_key: Array.from(keyBuffer)
                            }
                        }))
                    }
                } else if (jason.op === 10) {
                    if (!this.protocolsMap.has(socket.userid) || this.protocolsMap.has(jason.d.user_id)) {
                        return;
                    }

                    let protocol = this.protocolsMap.get(socket.userid);
                    let theirProtocol = this.protocolsMap.get(jason.d.user_id);

                    if (protocol !== "webrtc-p2p" || theirProtocol !== "webrtc-p2p") {
                        this.debug(`A client tried to send ICE candidates to another client, when one (or both) of them aren't using the webrtc-p2p protocol.`);
                        return; //unsupported
                    }

                    const recipientId = jason.d.user_id;
                    const recipientSocket = this.clients.get(recipientId);

                    if (recipientSocket) {
                        const forwardedPayload = { ...jason.d, user_id: socket.userid };
                        const forwardedMessage = { op: 10, d: forwardedPayload };

                        recipientSocket.send(JSON.stringify(forwardedMessage));
                        this.debug(`Forwarded ICE candidates from ${socket.userid} to ${recipientId}`);
                    } else {
                        this.debug(`Couldn't forward ICE candidates to recipient ${recipientId}, their corresponding websocket was not found.`);
                    }
                } else if (jason.op === 5) {
                    let ssrc = jason.d.ssrc;
                    let protocol = this.protocolsMap.get(socket.userid);

                    if (protocol === 'webrtc') {
                        if (!socket.client.voiceRoomId) {
                            return;
                        }

                        await Promise.all(
                            Array.from(
                                global.mediaserver.getClientsForRtcServer(
                                    socket.client.voiceRoomId,
                                ),
                            ).map((client) => {
                                if (client.user_id === socket.userid) return Promise.resolve();

                                const ssrc = client.getOutgoingStreamSSRCsForUser(socket.userid);

                                client.websocket.send(JSON.stringify({
                                    op: 5,
                                    d: {
                                        user_id: socket.userid,
                                        speaking: jason.d.speaking,
                                        ssrc: ssrc.audio_ssrc ?? 0,
                                    },
                                }));
                            }),
                        );
                    } else {
                        for (const [id, clientSocket] of this.clients) {
                            if (id !== socket.userid) {
                                clientSocket.send(JSON.stringify({
                                    op: 5,
                                    d: {
                                        speaking: jason.d.speaking,
                                        ssrc: ssrc,
                                        user_id: socket.userid
                                    }
                                }));
                            }
                        }
                    }
                } else if (jason.op === 12) {
                    let d = jason.d;
                    let video_ssrc = parseInt(d.video_ssrc ?? "0");
                    let rtx_ssrc = parseInt(d.rtx_ssrc ?? "0");
                    let audio_ssrc = parseInt(d.audio_ssrc ?? "0");
                    let response = {
                        audio_ssrc: audio_ssrc,
                        video_ssrc: video_ssrc,
                        rtx_ssrc: rtx_ssrc,
                    }

                    let protocol = this.protocolsMap.get(socket.userid);

                    if (protocol === 'webrtc') {
                        const clientsThatNeedUpdate = new Set();
                        const wantsToProduceAudio = d.audio_ssrc !== 0;
                        const wantsToProduceVideo = d.video_ssrc !== 0;

                        // https://github.com/spacebarchat/server/blob/master/src/webrtc/opcodes/Video.ts (The code for this OP is literally 99% spacebars, its just to wait for the clients to connect & publish/subscribe to tracks so it doesnt scream about producers)
                        if (!socket.client.webrtcConnected) {
                            if (wantsToProduceAudio) {
                                try {
                                    await Promise.race([
                                        new Promise((resolve, reject) => {
                                            socket.client.emitter.once("connected", () =>
                                                resolve(),
                                            );
                                        }),
                                        new Promise((resolve, reject) => {
                                            setTimeout(() => {
                                                if (socket.client.webrtcConnected) resolve();
                                                else reject();
                                            }, 3000);
                                        }),
                                    ]);
                                } catch (e) {
                                    return;
                                }
                            } else return;
                        }

                        if (!wantsToProduceAudio && socket.client.isProducingAudio()) {
                            socket.client.stopPublishingTrack("audio");
                        }

                        if (!wantsToProduceVideo && socket.client.isProducingVideo()) {
                            socket.client.stopPublishingTrack("video");
                        }

                        let roomId = `${socket.gatewaySession.guild_id}-${socket.gatewaySession.channel_id}`;

                        if (wantsToProduceAudio) {
                            if (!socket.client.isProducingAudio()) {
                                await socket.client.publishTrack("audio", {
                                    audio_ssrc: d.audio_ssrc,
                                });
                            }

                            for (const client of global.mediaserver.getClientsForRtcServer(
                                roomId,
                            )) {
                                if (client.user_id === socket.userid) continue;

                                if (!client.isSubscribedToTrack(socket.userid, "audio")) {
                                    await client.subscribeToTrack(
                                        socket.client.user_id,
                                        "audio",
                                    );
                                    clientsThatNeedUpdate.add(client);
                                }
                            }
                        }

                        if (wantsToProduceVideo) {
                            if (!socket.client.isProducingVideo()) {
                                await socket.client.publishTrack("video", {
                                    video_ssrc: d.video_ssrc,
                                    rtx_ssrc: d.rtx_ssrc,
                                });
                            }

                            for (const client of global.mediaserver.getClientsForRtcServer(
                                roomId,
                            )) {
                                if (client.user_id === socket.userid) continue;

                                if (!client.isSubscribedToTrack(socket.userid, "video")) {
                                    await client.subscribeToTrack(
                                        socket.client.user_id,
                                        "video",
                                    );
                                    clientsThatNeedUpdate.add(client);
                                }
                            }
                        }

                        await Promise.all(
                            Array.from(clientsThatNeedUpdate).map((client) => {
                                const ssrcs = client.getOutgoingStreamSSRCsForUser(socket.userid);

                                client.websocket.send(JSON.stringify({
                                    op: 12,
                                    d: {
                                        user_id: socket.userid,
                                        audio_ssrc:
                                            ssrcs.audio_ssrc ??
                                            socket.client.getIncomingStreamSSRCs().audio_ssrc,
                                        video_ssrc: ssrcs.video_ssrc ?? 0,
                                        rtx_ssrc: ssrcs.rtx_ssrc ?? 0
                                    },
                                }));
                            }),
                        );
                    } else {
                        for (const [id, clientSocket] of this.clients) {
                            if (id !== socket.userid) {
                                response.user_id = socket.userid;

                                clientSocket.send(JSON.stringify({
                                    op: 12,
                                    d: response
                                }));
                            }
                        }
                    }
                    
                    socket.send(JSON.stringify({
                        op: 12,
                        d: response
                    }));
                } else if (jason.op === 7) {
                    let token = jason.d.token;
                    let session_id = jason.d.session_id;
                    let server_id = jason.d.server_id;

                    if (!token || !session_id) return socket.close(4000, 'Invalid payload');

                    if (socket.session || resumed) return socket.close(4005, 'Cannot resume at this time');

                    resumed = true;

                    let session2 = global.sessions.get(`voice:${session_id}`);

                    if (!session2) {
                        let sesh = new session(globalUtils.generateString(16), socket, socket.user, token, false, {
                            game_id: null,
                            status: 'online',
                            activities: [],
                            user: socket.user ? globalUtils.miniUserObject(socket.user) : null
                        }, server_id, 0, 'voice');

                        sesh.start();

                        socket.session = sesh;
                    }

                    let sesh = null;

                    if (!session2) {
                        sesh = socket.session;
                    } else {
                        sesh = session2;
                        sesh.user = session2.user;
                    }

                    sesh.server_id = server_id;

                    if (sesh.token !== token) {
                        return socket.close(4004, 'Authentication failed');
                    }

                    socket.send(JSON.stringify({
                        op: 9,
                        d: null
                    }))
                }
            });
        });
    }
};

module.exports = rtcServer;