process.env.DEBUG = 'mediasoup*';

import { createWorker } from 'mediasoup';
import { SDPInfo } from 'semantic-sdp';

import { logText } from '../logger.ts';
import { MediasoupWebRtcClient } from './MediasoupWebRtcClient.js';
import { VoiceRoom } from './VoiceRoom.js';

class MediasoupSignalingDelegate {
  constructor() {
    this._workers = [];
    this._rooms = new Map();
    this.nextWorkerIdx = 0;
    this._ip = '';
    this.logRtpPackets = false;
  }

  async start(public_ip, portMin, portMax, debug_logs) {
    this._ip = public_ip.replace('\n', '');
    const numWorkers = 2;

    for (let i = 0; i < numWorkers; i++) {
      const worker = await createWorker({
        logLevel: debug_logs ? 'debug' : 'none',
        logTags: debug_logs
          ? [
              'info',
              'ice',
              'dtls',
              'srtp',
              'rtx',
              'bwe',
              'score',
              'simulcast',
              'svc',
              'sctp',
              ...(this.logRtpPackets ? ['rtp', 'rtcp'] : []),
            ]
          : [],
        rtcMinPort: portMin,
        rtcMaxPort: portMax,
      });

      worker.on('died', () => {
        console.error('mediasoup Worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
        setTimeout(() => process.exit(1), 2000);
      });
      this._workers.push(worker);
    }

    logText(`Media Server online on ${this.ip}:${this.port}`, `MEDIA_SERVER`);
  }

  async join(roomId, userId, ws, type) {
    const rooms =
      type === 'stream'
        ? []
        : Array.from(this.rooms.values()).filter(
            (room) => room.type === 'dm-voice' || room.type === 'guild-voice',
          );

    let existingClient;
    for (const room of rooms) {
      const result = room.getClientById(userId);
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

  async onOffer(client_build, client_build_date, client, sdpOffer, codecs) {
    const room = this._rooms.get(client.voiceRoomId);
    const legacyAnswer =
      client_build === 'january_23_2017' || client_build_date.getFullYear() < 2017;

    if (!room) {
      return Promise.reject(new Error('Room not found'));
    }

    const offer = SDPInfo.parse('m=audio\n' + sdpOffer);

    const rtpHeaders = Array.from(offer.medias[0].extensions.entries()).map(([id, uri]) => {
      return { uri, id };
    });

    const transport = await room.router.router.createWebRtcTransport({
      listenInfos: [{ ip: '0.0.0.0', announcedAddress: this.ip, protocol: 'udp' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
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
        role: 'client',
      },
    });

    client.webrtcConnected = true;
    client.emitter.emit('connected');

    await client.onJoinedRoom();

    const iceParameters = transport.iceParameters;
    const iceCandidates = transport.iceCandidates;
    const iceCandidate = iceCandidates[0];
    const dltsParamters = transport.dtlsParameters;
    const fingerprint = dltsParamters.fingerprints.find((x) => x.algorithm === 'sha-256');
    if (!fingerprint) {
      return Promise.reject(new Error('Fingerprint not found'));
    }

    if (legacyAnswer) {
      const sdpLines = [];

      sdpLines.push('v=0');
      sdpLines.push(`o=- 0 0 IN IP4 ${iceCandidate.ip}`);
      sdpLines.push('s=-');
      sdpLines.push('t=0 0');
      sdpLines.push(`m=audio ${iceCandidate.port} ICE/SDP`);
      sdpLines.push(`c=IN IP4 ${iceCandidate.ip}`);
      sdpLines.push(`a=rtcp:${iceCandidate.port}`);
      sdpLines.push(`a=ice-ufrag:${iceParameters.usernameFragment}`);
      sdpLines.push(`a=ice-pwd:${iceParameters.password}`);
      sdpLines.push(`a=fingerprint:sha-256 ${fingerprint.value}`);
      sdpLines.push('a=setup:active');
      sdpLines.push('a=mid:0');
      sdpLines.push('a=sendrecv');
      sdpLines.push('a=rtcp-mux');

      for (const codec of codecs) {
        sdpLines.push(`a=rtpmap:${codec.payload_type} ${codec.name}/48000/2`);
      }

      for (const ext of rtpHeaders) {
        sdpLines.push(`a=extmap:${ext.id} ${ext.uri}`);
      }

      sdpLines.push(
        `a=candidate:1 1 ${iceCandidate.protocol.toUpperCase()} ${iceCandidate.priority} ${iceCandidate.ip} ${iceCandidate.port} typ ${iceCandidate.type}`,
      );

      const sdpAnswer = sdpLines.join('\n') + '\n';

      return {
        sdp: sdpAnswer,
        selectedVideoCodec: 'VP8',
      };
    }

    const sdpAnswer =
      `m=audio ${iceCandidate.port} ICE/SDP\n` +
      `c=IN IP4 ${iceCandidate.ip}\n` +
      `a=rtcp:${iceCandidate.port}\n` +
      `a=ice-ufrag:${iceParameters.usernameFragment}\n` +
      `a=ice-pwd:${iceParameters.password}\n` +
      `a=fingerprint:sha-256 ${fingerprint.value}\n` +
      `a=candidate:1 1 ${iceCandidate.protocol.toUpperCase()} ${
        iceCandidate.priority
      } ${iceCandidate.ip} ${iceCandidate.port} typ ${iceCandidate.type}\n`;

    return { sdp: sdpAnswer, selectedVideoCodec: 'H264' };
  }

  onClientClose(client) {
    this._rooms.get(client.voiceRoomId)?.onClientLeave(client);
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

export default MediasoupSignalingDelegate;
