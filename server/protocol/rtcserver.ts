import sodium from 'libsodium-wrappers';
import { EventEmitter } from 'node:events';
import { WebSocketServer } from 'ws';

import { OPCODES, rtcHandlers } from '../handlers/rtc.ts';
import { logText } from '../helpers/utils/logger.ts';
import { type GatewayPayload, GatewayPayloadSchema } from '../types/gateway.ts';

// TODO: Replace all String() or "as type" conversions with better ones

const rtcServer = {
  port: null as number | null,
  signalingServer: null as WebSocketServer | null,
  debug_logs: false,
  clients: new Map(),
  emitter: null as EventEmitter | null,
  protocolsMap: new Map(),
  debug(message) {
    if (!this.debug_logs) {
      return;
    }

    logText(message, 'RTC_SERVER');
  },
  randomKeyBuffer() {
    return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
  },
  async handleClientConnect(socket, req) {
    this.debug(`Client has connected`);

    socket.userAgent =
      req.headers['user-agent'] ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
    socket.isChrome = /Chrome/.test(socket.userAgent);
    socket.ip_address = (req.headers['x-forwarded-for'] || req.socket.remoteAddress)
      .split(',')[0]
      .trim();

    socket.send(
      JSON.stringify({
        op: OPCODES.HEARTBEAT_INFO,
        d: {
          heartbeat_interval: 41250,
        },
      }),
    );

    socket.hb = {
      timeout: setTimeout(
        async () => {
          socket.close(4009, 'Session timed out');
        },
        45 * 1000 + 20 * 1000,
      ),
      reset: () => {
        if (socket.hb.timeout != null) {
          clearInterval(socket.hb.timeout);
        }

        socket.hb.timeout = setTimeout(
          async () => {
            socket.close(4009, 'Session timed out');
          },
          45 * 1000 + 20 * 1000,
        );
      },
      acknowledge: (d) => {
        const session = socket.session;
        const base = {
          op: OPCODES.HEARTBEAT_ACK,
          d: d,
        };
        const payload = session ? base : JSON.stringify(base);
        (session || socket).send(payload);
      },
    };

    socket.on('close', () => this.handleClientClose(socket));
    socket.on('message', (data) => this.handleClientMessage(socket, data));
  },
  async handleClientClose(socket) {
    for (const [id, clientSocket] of this.clients) {
      if (id !== socket.userid) {
        clientSocket.send(
          JSON.stringify({
            op: OPCODES.DISCONNECT,
            d: {
              user_id: socket.userid,
            },
          }),
        );
      }
    }

    if (socket.userid) {
      this.clients.delete(socket.userid);
    }
  },
  async handleClientMessage(socket, data) {
    try {
      const raw_data = Buffer.from(data).toString('utf-8');
      const packet: GatewayPayload = GatewayPayloadSchema.parse(JSON.parse(raw_data));

      this.debug(`Incoming -> ${raw_data}`);

      await rtcHandlers[packet.op]?.(socket, packet);
    } catch (error) {
      logText(error, 'error');

      socket.close(4000, 'Invalid payload');
    }
  },
  start(server, port, debug_logs) {
    this.emitter = new EventEmitter();
    this.port = port;
    this.debug_logs = debug_logs;
    this.signalingServer = new WebSocketServer({
      server: server,
    });

    this.signalingServer.on('listening', async () => {
      await sodium.ready;

      this.debug(`Server up on port ${this.port}`);
    });

    this.signalingServer.on('connection', this.handleClientConnect.bind(this));
  },
};

export default rtcServer;
