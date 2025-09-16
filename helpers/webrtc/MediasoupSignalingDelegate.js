process.env.DEBUG = "mediasoup*";

const mediasoup = require("mediasoup");
const { SDPInfo } = require("semantic-sdp");
const { VoiceRoom } = require("./VoiceRoom");
const { MediasoupWebRtcClient } = require("./MediasoupWebRtcClient");
const { logText } = require("../logger");

class MediasoupSignalingDelegate {
    constructor() {
        this._workers = [];
        this._rooms = new Map();
        this.nextWorkerIdx = 0;
        this._ip = "";
    }

    async start(public_ip, portMin, portMax, debugLogs) {
        this._ip = public_ip.replace("\n", "");
        const numWorkers = 2;

        for (let i = 0; i < numWorkers; i++) {
            const worker = await mediasoup.createWorker({
                logLevel: debugLogs ? "debug" : "none",
                logTags: debugLogs ? [
                    "info",
                    "ice",
                    "dtls",
                    "rtp",
                    "srtp",
                    "rtcp",
                    "rtx",
                    "bwe",
                    "score",
                    "simulcast",
                    "svc",
                    "sctp",
                ] : [],
                rtcMinPort: portMin,
                rtcMaxPort: portMax,
            });

            worker.on("died", () => {
                console.error(
                    "mediasoup Worker died, exiting in 2 seconds... [pid:%d]",
                    worker.pid
                );
                setTimeout(() => process.exit(1), 2000);
            });
            this._workers.push(worker);
        }

        logText(`Media Server online on ${this.ip}:${this.port}`, `MEDIA_SERVER`);
    }

    async join(roomId, userId, ws, type) {
        const rooms =
            type === "stream"
                ? []
                : Array.from(this.rooms.values()).filter(
                    (room) =>
                        room.type === "dm-voice" ||
                        room.type === "guild-voice"
                );

        let existingClient;
        for (const room of rooms) {
            let result = room.getClientById(userId);
            if (result) {
                existingClient = result;
                break;
            }
        }

        if (existingClient) {
            this.onClientClose(existingClient);
        }

        const room = await this.getOrCreateRoom(roomId, type);

        if (!room) {
            return null;
        }

        const client = new MediasoupWebRtcClient(userId, roomId, ws, room);
        room.onClientJoin(client);
        return client;
    }

    async onOffer(client, sdpOffer, codecs) {
        const room = this._rooms.get(client.voiceRoomId);

        if (!room) {
            return Promise.reject(new Error("Room not found"));
        }

        const offer = SDPInfo.parse("m=audio\n" + sdpOffer);

        const rtpHeaders = Array.from(
            offer.medias[0].extensions.entries()
        ).map(([id, uri]) => {
            return { uri, id };
        });

        const transport = await room.router.router.createWebRtcTransport({
            listenInfos: [{ ip: "0.0.0.0", announcedAddress: this.ip, protocol: "udp" }],
            enableUdp: true,
            initialAvailableOutgoingBitrate: 2500000,
        });

        room.onClientOffer(client, transport, codecs, rtpHeaders);

        const remoteDTLS = offer.getDTLS().plain();

        await transport.connect({
            dtlsParameters: {
                fingerprints: [
                    {
                        algorithm: remoteDTLS.hash,
                        value: remoteDTLS.fingerprint,
                    },
                ],
                role: "client",
            },
        });

        client.webrtcConnected = true;
        client.emitter.emit("connected");

        const iceParameters = transport.iceParameters;
        const iceCandidates = transport.iceCandidates;
        const iceCandidate = iceCandidates[0];
        const dltsParamters = transport.dtlsParameters;
        const fingerprint = dltsParamters.fingerprints.find(
            (x) => x.algorithm === "sha-256"
        );
        if (!fingerprint) {
            return Promise.reject(new Error("Fingerprint not found"));
        }

        const sdpAnswer =
            `m=audio ${iceCandidate.port} ICE/SDP\n` +
            `a=fingerprint:sha-256 ${fingerprint.value}\n` +
            `c=IN IP4 ${iceCandidate.ip}\n` +
            `a=rtcp:${iceCandidate.port}\n` +
            `a=ice-ufrag:${iceParameters.usernameFragment}\n` +
            `a=ice-pwd:${iceParameters.password}\n` +
            `a=fingerprint:sha-256 ${fingerprint.value}\n` +
            `a=candidate:1 1 ${iceCandidate.protocol.toUpperCase()} ${
                iceCandidate.priority
            } ${iceCandidate.ip} ${iceCandidate.port} typ ${
                iceCandidate.type
            }\n` + 
            `m=video 0 ICE/SDP`;

        return { sdp: sdpAnswer, selectedVideoCodec: "H264" };
    }

    onClientClose(client) {
        this._rooms.get(client.voiceRoomId)?.onClientLeave(client);
    }

    updateSDP(offer) {
        throw new Error("Method not implemented.");
    }

    getClientsForRtcServer(rtcServerId) {
        if (!this._rooms.has(rtcServerId)) {
            return new Set();
        }
        const room = this._rooms.get(rtcServerId);
        if (room) {
            return new Set(room.clients.values());
        }
        return new Set();
    }

    stop() {
        return Promise.resolve();
    }

    get ip() {
        return this._ip;
    }

    get port() {
        return 9999;
    }

    get rooms() {
        return this._rooms;
    }

    getNextWorker() {
        const worker = this._workers[this.nextWorkerIdx];
        if (++this.nextWorkerIdx === this._workers.length) {
            this.nextWorkerIdx = 0;
        }
        return worker;
    }

    async getOrCreateRoom(roomId, type) {
        if (!this._rooms.has(roomId)) {
            const worker = this.getNextWorker();
            const router = await worker.createRouter({
                mediaCodecs: global.MEDIA_CODECS,
            });

            const data = {
                router,
                worker,
            };

            const room = new VoiceRoom(roomId, type, this, data);
            this._rooms.set(roomId, room);
            return room;
        }
        return this._rooms.get(roomId);
    }
}

module.exports = MediasoupSignalingDelegate;