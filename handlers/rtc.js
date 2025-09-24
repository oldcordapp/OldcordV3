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

    socket.client.initIncomingSSRCs({
        audio_ssrc: 0,
        video_ssrc: 0,
        rtx_ssrc: 0
    });

    socket.send(JSON.stringify({
        op: OPCODES.CONNECTIONINFO,
        d: {
            ssrc: globalUtils.generateSsrc(),
            ip: global.mediaserver.ip,
            port: global.mediaserver.port,
            modes: ["plain", "xsalsa20_poly1305"],
            heartbeat_interval: 1
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

        if (!socket.client.isProducingAudio()) {
            global.rtcServer.debug(`Client ${socket.userid} sent a speaking packet but has no audio producer.`);
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

                if (packet.d.speaking && ssrc.audio_ssrc === 0) {
                     global.rtcServer.debug(`Suppressing speaking packet for ${client.user_id} as consumer for ${socket.userid} is not ready (ssrc=0).`);
                     return Promise.resolve();
                }

                client.websocket.send(JSON.stringify({
                    op: OPCODES.SPEAKING,
                    d: {
                        user_id: socket.userid,
                        speaking: packet.d.speaking,
                        ssrc: ssrc.audio_ssrc
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

        const isCurrentlyProducingAudio = socket.client.isProducingAudio();
        const isCurrentlyProducingVideo = socket.client.isProducingVideo();

        socket.client.initIncomingSSRCs({
            audio_ssrc: d.audio_ssrc,
            video_ssrc: d.video_ssrc,
            rtx_ssrc: d.rtx_ssrc
        });

        if (wantsToProduceAudio && !isCurrentlyProducingAudio) {
            console.log(`[${socket.userid}] Starting audio production with ssrc ${d.audio_ssrc}`);
            await socket.client.publishTrack("audio", { audio_ssrc: d.audio_ssrc });

            for (const client of socket.client.room.clients.values()) {
                if (client.user_id === socket.userid) continue;
                await client.subscribeToTrack(socket.client.user_id, "audio");
                clientsThatNeedUpdate.add(client);
            }
        }
        else if (!wantsToProduceAudio && isCurrentlyProducingAudio) {
            console.log(`[${socket.userid}] Stopping audio production.`);
            socket.client.stopPublishingTrack("audio");

            for (const client of socket.client.room.clients.values()) {
                if (client.user_id !== socket.userid) clientsThatNeedUpdate.add(client);
            }
        }

        if (wantsToProduceVideo && !isCurrentlyProducingVideo) {
            console.log(`[${socket.userid}] Starting video production with ssrc ${d.video_ssrc}`);
            await socket.client.publishTrack("video", { video_ssrc: d.video_ssrc, rtx_ssrc: d.rtx_ssrc });
            for (const client of socket.client.room.clients.values()) {
                if (client.user_id === socket.userid) continue;
                await client.subscribeToTrack(socket.client.user_id, "video");
                clientsThatNeedUpdate.add(client);
            }
        }
        else if (!wantsToProduceVideo && isCurrentlyProducingVideo) {
            console.log(`[${socket.userid}] Stopping video production.`);
            socket.client.stopPublishingTrack("video");
            for (const client of socket.client.room.clients.values()) {
                if (client.user_id !== socket.userid) clientsThatNeedUpdate.add(client);
            }
        }

        await Promise.all(
            Array.from(clientsThatNeedUpdate).map((client) => {
                const ssrcs = client.getOutgoingStreamSSRCsForUser(socket.userid);
                client.websocket.send(JSON.stringify({
                    op: OPCODES.VIDEO,
                    d: {
                        user_id: socket.userid,
                        audio_ssrc: ssrcs.audio_ssrc,
                        video_ssrc: ssrcs.video_ssrc,
                        rtx_ssrc: ssrcs.rtx_ssrc
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