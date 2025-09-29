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

    global.rtcServer.debug(`Client ${socket.userid} has identified.`);

    let roomId = `${socket.gatewaySession.guild_id}-${socket.gatewaySession.channel_id}`;

    socket.roomId = roomId;

    global.rtcServer.clients.set(socket.userid, socket);

    if (!global.using_media_relay) {
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
    } else {
        let mediaServer = global.mrServer.getRandomMediaServer();

        if (mediaServer === null) {
            return;
        }

        socket.on("close", () => {
            mediaServer.socket.send(JSON.stringify({
                op: "CLIENT_CLOSE",
                d: {
                    ip_address: socket.ip_address,
                    user_id: socket.userid
                }
            }));
        });

        let identity_ssrc = globalUtils.generateSsrc();

        mediaServer.socket.send(JSON.stringify({
            op: "CLIENT_IDENTIFY",
            d: {
                ip_address: socket.ip_address,
                user_id: socket.userid,
                ssrc: identity_ssrc,
                room_id: roomId
            }
        }));

        socket.mediaServer = mediaServer;

        socket.send(JSON.stringify({
            op: OPCODES.CONNECTIONINFO,
            d: {
                ssrc: identity_ssrc,
                ip: mediaServer.ip,
                port: mediaServer.port,
                modes: ["plain", "xsalsa20_poly1305"],
                heartbeat_interval: 1
            }
        }));
    }
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

        let client_build = socket.gatewaySession.socket.client_build;
        let client_build_date = socket.gatewaySession.socket.client_build_date; //to-do add to underlying socket object

        if (!global.using_media_relay) {
            let answer = await global.mediaserver.onOffer(client_build, client_build_date, socket.client, sdp, codecs);

            return socket.send(JSON.stringify({
                op: OPCODES.SETUP,
                d: {
                    sdp: answer.sdp,
                    audio_codec: "opus",
                    video_codec: answer.selectedVideoCodec
                }
            }));
        }

        let mediaServer = socket.mediaServer;

        if (!mediaServer) {
            return;
        }

        mediaServer.socket.send(JSON.stringify({
            op: "OFFER",
            d: {
                sdp: sdp,
                codecs: codecs,
                ip_address: socket.ip_address,
                user_id: socket.userid,
                room_id: socket.roomId,
                client_build: client_build,
                client_build_date: client_build_date
            }
        }))

        mediaServer.socket.emitter.on("answer-received", (answer) => {
            socket.send(JSON.stringify({
                op: OPCODES.SETUP,
                d: {
                    sdp: answer.sdp,
                    audio_codec: answer.audio_codec,
                    video_codec: answer.video_codec
                }
            }));
        });
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
        if (!global.using_media_relay) {
            if (!socket.client.voiceRoomId) {
                return;
            }

            if (!socket.client.isProducingAudio()) {
                global.rtcServer.debug(`Client ${socket.userid} sent a speaking packet but has no audio producer.`);
                return;
            }

            let incomingSSRCs = socket.client.getIncomingStreamSSRCs();

            if (incomingSSRCs.audio_ssrc !== ssrc) {
                console.log(`[${socket.userid}] SSRC mismatch detected. Correcting audio SSRC from ${incomingSSRCs.audio_ssrc} to ${ssrc}.`);

                socket.client.stopPublishingTrack("audio");

                socket.client.initIncomingSSRCs({
                    audio_ssrc: ssrc,
                    video_ssrc: incomingSSRCs.video_ssrc,
                    rtx_ssrc: incomingSSRCs.rtx_ssrc
                });

                await socket.client.publishTrack("audio", { audio_ssrc: ssrc });

                const clientsToNotify = new Set();

                for (const otherClient of socket.client.room.clients.values()) {
                    if (otherClient.user_id === socket.userid) continue;

                    await otherClient.subscribeToTrack(socket.client.user_id, "audio");

                    clientsToNotify.add(otherClient);
                }

                await Promise.all(
                    Array.from(clientsToNotify).map((client) => {
                        const updatedSsrcs = client.getOutgoingStreamSSRCsForUser(socket.userid);

                        client.websocket.send(JSON.stringify({
                            op: OPCODES.VIDEO,
                            d: {
                                user_id: socket.userid,
                                audio_ssrc: updatedSsrcs.audio_ssrc,
                                video_ssrc: updatedSsrcs.video_ssrc,
                                rtx_ssrc: updatedSsrcs.rtx_ssrc,
                            },
                        }));
                    }),
                );
            }

            await Promise.all(
                Array.from(
                    global.mediaserver.getClientsForRtcServer(
                        socket.client.voiceRoomId,
                    ),
                ).map((client) => {
                    if (client.user_id === socket.userid) return Promise.resolve();

                    const ssrcInfo = client.getOutgoingStreamSSRCsForUser(socket.userid);

                    if (packet.d.speaking && ssrcInfo.audio_ssrc === 0) {
                        global.rtcServer.debug(`Suppressing speaking packet for ${client.user_id} as consumer for ${socket.userid} is not ready (ssrc=0).`);
                        return Promise.resolve();
                    }

                    client.websocket.send(JSON.stringify({
                        op: OPCODES.SPEAKING,
                        d: {
                            user_id: socket.userid,
                            speaking: packet.d.speaking,
                            ssrc: ssrcInfo.audio_ssrc
                        },
                    }));
                }),
            );
        } else {
            let mediaServer = socket.mediaServer;

            if (!mediaServer) {
                return;
            }

            mediaServer.socket.send(JSON.stringify({
                op: "CLIENT_SPEAKING",
                d: {
                    ip_address: socket.ip_address,
                    user_id: socket.userid,
                    room_id: socket.roomId,
                    speaking: packet.d.speaking,
                    audio_ssrc: ssrc
                }
            }));

            mediaServer.socket.emitter.on("speaking-batch", (speaking_batch) => {
                console.log(`Received speaking-batch for ${Object.keys(speaking_batch).length} clients.`);

                for (const [recipientId, speakingPacket] of Object.entries(speaking_batch)) {
                    const clientSocket = global.rtcServer.clients.get(recipientId);

                    if (clientSocket && clientSocket.roomId === socket.roomId) {
                        clientSocket.send(JSON.stringify(speakingPacket));
                    }
                }
            });
        }
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
        if (!global.using_media_relay) {
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
            let mediaServer = socket.mediaServer;

            if (!mediaServer) {
                return;
            }

            mediaServer.socket.send(JSON.stringify({
                op: "VIDEO",
                d: {
                    user_id: socket.userid,
                    room_id: socket.roomid,
                    ip_address: socket.ip_address,
                    audio_ssrc: d.audio_ssrc,
                    video_ssrc: d.video_ssrc,
                    rtx_ssrc: d.rtx_ssrc
                }
            }));
        
            mediaServer.socket.emitter.on('video-batch', (video_batch) => {
                for (const [recipientId, videoPacket] of Object.entries(video_batch)) {
                    const clientSocket = global.rtcServer.clients.get(recipientId);

                    if (clientSocket && clientSocket.roomId === socket.roomId) {
                        clientSocket.send(JSON.stringify(videoPacket));
                    }
                }
            });
        }
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