const globalUtils = require("../helpers/globalutils");
const session = require("../helpers/session");

const OPCODES = {
    IDENTIFY: 0,
    SELECTPROTOCOL: 1,
    CONNECTIONINFO: 2,
    HEARTBEAT: 3,
    SETUP: 4,
    SPEAKING: 5,
    HEARTBEAT_ACK: 6,
    RESUME: 7,
    HEARTBEAT_INFO: 8,
    INVALID_SESSION: 9,
    ICECANDIDATES: 10,
    VIDEO: 12,
    DISCONNECT: 13
};

async function handleIdentify(socket, packet) {
    let userid = packet.d.user_id;
    let server_id = packet.d.server_id;
    let sessionid = packet.d.session_id;
    let token = packet.d.token;

    if (socket.identified || socket.session) {
        return socket.close(4005, 'You have already identified.');
    }

    socket.identified = true;

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

    global.rtcServer.debug(`A client's state has changed to -> RTC_CONNECTING`);

    socket.userid = user.id;

    global.rtcServer.clients.set(socket.userid, socket);

    global.rtcServer.debug(`Client ${socket.userid} has identified.`);

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
        op: OPCODES.CONNECTIONINFO,
        d: {
            ssrc: generatedSsrc.audio_ssrc,
            ip: global.mediaserver.ip,
            port: global.mediaserver.port,
            modes: ["plain", "xsalsa20_poly1305"],
            heartbeat_interval: 1,
            streams: [{
                type: "video",
                ssrc: generatedSsrc.video_ssrc,
                rtx_ssrc: generatedSsrc.rtx_ssrc,
                rid: "100",
                active: false,
                quality: 100
            }]
        }
    }));
}

async function handleHeartbeat(socket, packet) {
    if (!socket.hb) return;

    socket.hb.acknowledge(packet.d);
    socket.hb.reset();
}

async function handleSelectProtocol(socket, packet) {
    let protocol = packet.d.protocol;

    global.rtcServer.protocolsMap.set(socket.userid, protocol ?? 'webrtc');

    let keyBuffer = global.rtcServer.randomKeyBuffer();
    global.udpServer.encryptionsMap.set(socket.ssrc, {
        mode: "xsalsa20_poly1305",
        key: Array.from(keyBuffer)
    });

    if (protocol === 'webrtc') {
        let sdp = packet.d.sdp || packet.d.data;
        let codecs = packet.d.codecs || [{
            name: "opus",
            type: "audio",
            priority: 1000,
            payload_type: 111
        }];

        let answer = await global.mediaserver.onOffer(socket.client, sdp, codecs);

        return socket.send(JSON.stringify({
            op: OPCODES.SETUP,
            d: {
                sdp: answer.sdp,
                audio_codec: "opus",
                video_codec: answer.selectedVideoCodec
            }
        }));
    } else if (protocol === 'webrtc-p2p') {
        return socket.send(JSON.stringify({
            op: OPCODES.SETUP,
            d: {
                peers: Array.from(global.rtcServer.clients.keys()).filter(id => socket.userid != id)
            }
        }))
    } else {
        return socket.send(JSON.stringify({
            op: OPCODES.SETUP,
            d: {
                mode: "xsalsa20_poly1305",
                secret_key: Array.from(keyBuffer)
            }
        }))
    }
}

async function handleICECandidates(socket, packet) {
    if (!global.rtcServer.protocolsMap.has(socket.userid) || global.rtcServer.protocolsMap.has(packet.d.user_id)) {
        return;
    }

    let protocol = global.rtcServer.protocolsMap.get(socket.userid);
    let theirProtocol = global.rtcServer.protocolsMap.get(packet.d.user_id);

    if (protocol !== "webrtc-p2p" || theirProtocol !== "webrtc-p2p") {
        global.rtcServer.debug(`A client tried to send ICE candidates to another client, when one (or both) of them aren't using the webrtc-p2p protocol.`);
        return;
    }

    const recipientId = packet.d.user_id;
    const recipientSocket = global.rtcServer.clients.get(recipientId);

    if (recipientSocket) {
        const forwardedPayload = { ...packet.d, user_id: socket.userid };
        const forwardedMessage = { op: OPCODES.ICECANDIDATES, d: forwardedPayload };

        recipientSocket.send(JSON.stringify(forwardedMessage));

        global.rtcServer.debug(`Forwarded ICE candidates from ${socket.userid} to ${recipientId}`);
    } else {
        global.rtcServer.debug(`Couldn't forward ICE candidates to recipient ${recipientId}, their corresponding websocket was not found.`);
    }
}

async function handleSpeaking(socket, packet) {
    let ssrc = packet.d.ssrc;
    let protocol = global.rtcServer.protocolsMap.get(socket.userid);

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
                    op: OPCODES.SPEAKING,
                    d: {
                        user_id: socket.userid,
                        speaking: packet.d.speaking,
                        ssrc: ssrc.audio_ssrc ?? 0,
                    },
                }));
            }),
        );
    } else {
        for (const [id, clientSocket] of global.rtcServer.clients) {
            if (id !== socket.userid) {
                clientSocket.send(JSON.stringify({
                    op: OPCODES.SPEAKING,
                    d: {
                        speaking: packet.d.speaking,
                        ssrc: ssrc,
                        user_id: socket.userid
                    }
                }));
            }
        }
    }
}

async function handleVideo(socket, packet) {
    let d = packet.d;
    let video_ssrc = parseInt(d.video_ssrc ?? "0");
    let rtx_ssrc = parseInt(d.rtx_ssrc ?? "0");
    let audio_ssrc = parseInt(d.audio_ssrc ?? "0");
    let response = {
        audio_ssrc: audio_ssrc,
        video_ssrc: video_ssrc,
        rtx_ssrc: rtx_ssrc,
    }

    let protocol = global.rtcServer.protocolsMap.get(socket.userid);

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
                    op: OPCODES.VIDEO,
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
        for (const [id, clientSocket] of global.rtcServer.clients) {
            if (id !== socket.userid) {
                response.user_id = socket.userid;

                clientSocket.send(JSON.stringify({
                    op: OPCODES.VIDEO,
                    d: response
                }));
            }
        }
    }

}

async function handleResume(socket, packet) {
    let token = packet.d.token;
    let session_id = packet.d.session_id;
    let server_id = packet.d.server_id;

    if (!token || !session_id) return socket.close(4000, 'Invalid payload');

    if (socket.session || socket.resumed) return socket.close(4005, 'Cannot resume at this time');

    socket.resumed = true;

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
        op: OPCODES.INVALID_SESSION,
        d: null
    }))
}

const rtcHandlers = {
    [OPCODES.IDENTIFY]: handleIdentify,
    [OPCODES.SELECTPROTOCOL]: handleSelectProtocol,
    [OPCODES.HEARTBEAT]: handleHeartbeat,
    [OPCODES.SPEAKING]: handleSpeaking,
    [OPCODES.RESUME]: handleResume,
    [OPCODES.ICECANDIDATES]: handleICECandidates,
    [OPCODES.VIDEO]: handleVideo
};

module.exports = {
    rtcHandlers,
    OPCODES
};