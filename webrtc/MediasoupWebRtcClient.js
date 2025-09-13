const { EventEmitter } = require("node:events");
const { VoiceRoom } = require("./VoiceRoom");

class MediasoupWebRtcClient {
    constructor(userId, roomId, websocket, room) {
        this.user_id = userId;
        this.voiceRoomId = roomId;
        this.websocket = websocket;
        this.room = room;
        this.webrtcConnected = false;
        this.isStopped = false;
        this.emitter = new EventEmitter();
        this.consumers = [];
        this.transport = null;
        this.codecs = [];
        this.codecCapabilities = [];
        this.headerExtensions = [];
        this.audioProducer = null;
        this.videoProducer = null;
        this.incomingSSRCS = null;
        this.videoStream = undefined;
    }

    initIncomingSSRCs(ssrcs) {
        this.incomingSSRCS = ssrcs;
    }

    getIncomingStreamSSRCs() {
        return {
            audio_ssrc: this.incomingSSRCS?.audio_ssrc,
            video_ssrc: this.isProducingVideo()
                ? this.incomingSSRCS?.video_ssrc
                : 0,
            rtx_ssrc: this.isProducingVideo()
                ? this.incomingSSRCS?.rtx_ssrc
                : 0,
        };
    }

    getOutgoingStreamSSRCsForUser(user_id) {
        const otherClient = this.room?.getClientById(user_id);

        if (!otherClient) {
            return {
                audio_ssrc: 0,
                video_ssrc: 0,
                rtx_ssrc: 0
            };
        }

        const audioProducerId = otherClient.audioProducer?.id;
        const videoProducerId = otherClient.videoProducer?.id;

        const audioConsumer = this.consumers?.find(
            (consumer) => consumer.producerId === audioProducerId
        );
        const videoConsumer = this.consumers?.find(
            (consumer) => consumer.producerId === videoProducerId
        );

        const audioSsrc = audioConsumer?.rtpParameters?.encodings[0]?.ssrc ?? 0;
        const videoSsrc = videoConsumer?.rtpParameters?.encodings[0]?.ssrc ?? 0;
        const rtxSsrc = videoConsumer?.rtpParameters?.encodings[0]?.rtx?.ssrc ?? 0;

        return {
            audio_ssrc: audioSsrc,
            video_ssrc: videoSsrc,
            rtx_ssrc: rtxSsrc,
        };
    }

    isProducingAudio() {
        return !!this.audioProducer;
    }

    isProducingVideo() {
        return !!this.videoProducer;
    }

    async getExistingProducer(ssrcs) {
        let producerFound = null;

        for (let client of this.room.clients.values()) {
            if (!client.audioProducer) {
                continue;
            }

            let ssrc = client.audioProducer.rtpParameters.encodings[0].ssrc;

            if (ssrc === ssrcs) {
                producerFound = client.audioProducer;
                break;
            }
        }

        return producerFound;
    }

    async getConsumerForProducer(producerId) {
        let consumerFound = null;

        for (const consumer of this.consumers) {
            if (consumer.producerId === producerId) {
                consumerFound = consumer;
                break;
            }
        }

        return consumerFound;
    }

    async subscribeToProducers(mediaServer) {
        if (!this.webrtcConnected) return;

        const clients = mediaServer.getClientsForRtcServer(
            this.voiceRoomId,
        );

        let mutedClients = [];

        if (this.room.muted_clients.has(this.user_id)) {
            mutedClients = this.room.muted_clients.get(this.user_id);
        }

        await Promise.all(
            Array.from(clients).map(async (client) => {
                if (client.user_id === this.user_id) return;

                let needsUpdate = false;
                let consumerAudioSsrc = 0;
                let consumerVideoSsrc = 0;
                let consumerRtxSsrc = 0;

                if (mutedClients.includes(client.user_id) || this.room.server_muted_clients.includes(client.user_id)) {
                    if (this.isSubscribedToTrack(client.user_id, "audio")) {
                        this.unSubscribeFromTrack(client.user_id, "audio");
                    }

                    return;
                }

                if (
                    client.isProducingAudio() &&
                    !this.isSubscribedToTrack(client.user_id, "audio")
                ) {
                    await this.subscribeToTrack(client.user_id, "audio");
                    needsUpdate = true;
                }

                if (
                    client.isProducingVideo() &&
                    !this.isSubscribedToTrack(client.user_id, "video")
                ) {
                    await this.subscribeToTrack(client.user_id, "video");
                    needsUpdate = true;
                }

                if (!needsUpdate) return;

                const audioConsumer = this.consumers.find(
                    (consumer) => consumer.producerId === client.audioProducer?.id
                );
                const videoConsumer = this.consumers.find(
                    (consumer) => consumer.producerId === client.videoProducer?.id
                );

                if (audioConsumer) {
                    consumerAudioSsrc = audioConsumer.rtpParameters?.encodings?.[0]?.ssrc ?? 0;
                }

                if (videoConsumer) {
                    consumerVideoSsrc = videoConsumer.rtpParameters?.encodings?.[0]?.ssrc ?? 0;
                    consumerRtxSsrc = videoConsumer.rtpParameters?.encodings?.[0]?.rtx?.ssrc ?? 0;
                }

                this.websocket.send(JSON.stringify({
                    op: 12,
                    d: {
                        user_id: client.user_id,
                        audio_ssrc: consumerAudioSsrc,
                        video_ssrc: consumerVideoSsrc,
                        rtx_ssrc: consumerRtxSsrc
                    },
                }));
            }),
        );
    }

    async publishTrack(type, ssrc) {
        try {
            if (!this.webrtcConnected || !this.transport) return;

            if (this.room.server_muted_clients.includes(this.user_id)) return;

            if (type === "audio" && !this.isProducingAudio()) {

                let existingProducer = await this.getExistingProducer(ssrc.audio_ssrc);

                if (existingProducer) {
                    this.audioProducer = existingProducer;
                } else {
                    this.audioProducer = await this.transport.produce({
                        kind: "audio",
                        mid: "audio",
                        rtpParameters: {
                            codecs:
                                this.codecCapabilities
                                    ?.filter((codec) => codec.kind === "audio")
                                    .map((codec) => {
                                        const {
                                            mimeType,
                                            clockRate,
                                            channels,
                                            rtcpFeedback,
                                            parameters,
                                        } = codec;

                                        return {
                                            mimeType,
                                            clockRate,
                                            channels,
                                            rtcpFeedback,
                                            parameters,
                                            payloadType: codec.preferredPayloadType || 111,
                                        };
                                    }) || [],
                            encodings: [
                                {
                                    ssrc: ssrc.audio_ssrc,
                                    maxBitrate: 64000,
                                    codecPayloadType:
                                        this.codecCapabilities?.find(codec => codec.kind === "audio")
                                            ?.preferredPayloadType || 111,
                                },
                            ],
                        },
                        paused: false,
                    });
                }
            }

            if (type === "video" && !this.isProducingVideo()) {
                this.videoProducer = await this.transport.produce({
                    kind: "video",
                    mid: "video",
                    rtpParameters: {
                        codecs:
                            this.codecCapabilities
                                ?.filter((codec) => codec.kind === "video")
                                .map((codec) => {
                                    const {
                                        mimeType,
                                        clockRate,
                                        channels,
                                        rtcpFeedback,
                                        parameters,
                                    } = codec;

                                    return {
                                        mimeType,
                                        clockRate,
                                        channels,
                                        rtcpFeedback,
                                        parameters,
                                        payloadType: codec.preferredPayloadType || 102,
                                    };
                                }) || [],
                        encodings: [
                            {
                                ssrc: ssrc.video_ssrc,
                                rtx: { ssrc: ssrc.rtx_ssrc },
                                codecPayloadType:
                                    this.codecCapabilities?.find(codec => codec.kind === "video")?.preferredPayloadType || 102,
                            },
                        ],
                        headerExtensions: this.headerExtensions
                            ?.filter(
                                (header) =>
                                    header.uri === "http://www.webrtc.org/experiments/rtp-hdrext/playout-delay" ||
                                    header.uri === "http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time" ||
                                    header.uri === "urn:ietf:params:rtp-hdrext:toffset" ||
                                    header.uri === "http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01"
                            )
                            .map((header) => {
                                return {
                                    id: header.id,
                                    uri: header.uri,
                                };
                            }),
                    },
                    paused: false,
                });
            }
        } catch { }
    }

    stopPublishingTrack(type) {
        if (!this.room) return;

        const producer =
            type === "audio" ? this.audioProducer : this.videoProducer;

        for (const client of this.room.clients.values()) {
            const consumers = client.consumers?.filter(
                (consumer) => consumer.producerId === producer?.id
            );

            consumers?.forEach((consumer) => {
                consumer.close();
                const index = client.consumers?.indexOf(consumer);
                if (typeof index === "number" && index != -1) {
                    client.consumers?.splice(index, 1);
                }
            });
        }

        producer?.close();

        if (type === "audio") {
            this.audioProducer = undefined;
        } else {
            this.videoProducer = undefined;
        }
    }

    async subscribeToTrack(user_id, type) {
        if (!this.webrtcConnected || !this.transport) return;

        const client = this.room?.getClientById(user_id);

        if (!client.audioProducer) return;
        
        let mutedClients = [];

        if (this.room.muted_clients.has(this.user_id)) {
            mutedClients = this.room.muted_clients.get(this.user_id);
        }
        
        const producer =
            type === "audio" ? client.audioProducer : client.videoProducer;

        if (!producer) return;

        let existingConsumer = this.consumers?.find(
            (x) => x.producerId === producer?.id
        );

        if (existingConsumer) return;

        if (mutedClients.includes(client.user_id) || this.room.server_muted_clients.includes(client.user_id)) return;

        const consumer = await this.transport.consume({
            producerId: producer.id,
            rtpCapabilities: {
                codecs: this.codecCapabilities,
                headerExtensions:
                    this.headerExtensions?.map((header) => {
                        return {
                            preferredId: header.id,
                            uri: header.uri,
                            kind: type,
                        };
                    }) || [],
            },
            paused: type === "video",
            appData: {
                user_id: client.user_id,
            }, //
        });

        if (type === "video") {
            setTimeout(async () => {
                await consumer.resume();
            }, 2000);
        }

        this.consumers?.push(consumer);
    }

    unSubscribeFromTrack(user_id, type) {
        const client = this.room?.getClientById(user_id);
        if (!client) return;

        const producer =
            type === "audio" ? client.audioProducer : client.videoProducer;

        if (!producer) return;

        const consumer = this.consumers?.find(
            (c) => c.producerId === producer.id
        );

        if (!consumer) return;

        consumer.close();
        const index = this.consumers?.indexOf(consumer);
        if (typeof index === "number" && index != -1) {
            this.consumers?.splice(index, 1);
        }
    }

    async updateTrack(type, muted = false, deafen = false) {
        const producer =
            type === "audio" ? this.audioProducer : this.videoProducer;

        if (!producer) return;

        if (muted) {
            await producer.pause();

            this.room.server_muted_clients.push(this.user_id);
        } else {
            await producer.resume();

            this.room.server_muted_clients.splice(this.room.server_muted.clients.indexOf(this.user_id), 1);
        }
    }

    async updateTrackLocal(user_id, type, muted = false) {
        const client = this.room?.getClientById(user_id);
        if (!client) return;

        const producer =
            type === "audio" ? client.audioProducer : client.videoProducer;

        if (!producer) return;

        const consumer = this.consumers?.find(
            (c) => c.producerId === producer.id
        );

        if (!consumer) return;

        let muted_list = this.room.muted_clients.get(this.user_id);

        if (!muted_list) {
            muted_list = [];
        }

        if (muted) {
            await consumer.pause();
            muted_list.push(client.user_id);
        } else {
            await consumer.resume();
            muted_list.splice(muted_list.indexOf(client.user_id), 1);
        }

        this.room.muted_clients.set(this.user_id, muted_list);
    }

    isSubscribedToTrack(user_id, type) {
        const client = this.room?.getClientById(user_id);

        if (!client) return false;

        const producer =
            type === "audio" ? client.audioProducer : client.videoProducer;

        if (!producer) return false;

        const consumer = this.consumers?.find(
            (c) => c.producerId === producer.id
        );

        if (consumer) return true;

        return false;
    }
}

module.exports = { MediasoupWebRtcClient };