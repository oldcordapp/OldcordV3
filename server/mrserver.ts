import { WebSocketServer } from 'ws';

import { mrHandlers, OPCODES } from './handlers/mr.ts';
import { logText } from './helpers/logger.ts';
import { type GatewayPayload, GatewayPayloadSchema } from './types/gateway.ts';

// TODO: Replace all String() or "as type" conversions with better ones

const mrServer = {
  port: null as number | null,
  debug_logs: false,
  servers: new Map(),
  emitter: null,
  signalingServer: null as WebSocketServer | null,
  debug(message) {
    if (!this.debug_logs) {
      return;
    }

    logText(message, 'MR_SIGNALING_SERVER');
  },
  getRandomMediaServer() {
    const serverEntries = Array.from(this.servers.entries());

    if (serverEntries.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * serverEntries.length);
    const randomEntry = serverEntries[randomIndex];
    const ip = randomEntry[0];
    const serverObject = randomEntry[1];

    return {
      ip: ip,
      socket: serverObject.socket,
      port: serverObject.port,
    };
  },
  async handleClientConnect(socket) {
    this.debug(`Media server has connected`);

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
          this.handleClientClose(socket, true);
        },
        45 * 1000 + 20 * 1000,
      ),
      reset: () => {
        if (socket.hb.timeout != null) {
          clearInterval(socket.hb.timeout);
        }

        socket.hb.timeout = setTimeout(
          async () => {
            this.handleClientClose(socket, true);
          },
          45 * 1000 + 20 * 1000,
        );
      },
      acknowledge: (d) => {
        socket.send(
          JSON.stringify({
            op: OPCODES.HEARTBEAT_ACK,
            d: d,
          }),
        );
      },
    };

    socket.on('close', () => this.handleClientClose(socket));
    socket.on('message', (data) => this.handleClientMessage(socket, data));
  },
  async handleClientClose(socket, timedOut = false) {
    if (socket === null) {
      return;
    }

    if (timedOut) {
      this.debug(`!! A MEDIA SERVER HAS TIMED OUT - CHECK THE SERVER ASAP`);
    }

    this.debug(`Lost connection to a media server -> Removing from store...`);

    this.servers.delete(socket.public_ip);
    socket = null;
  },
  async handleClientMessage(socket, data) {
    try {
      const raw_data = Buffer.from(data).toString('utf-8');
      const packet: GatewayPayload = GatewayPayloadSchema.parse(JSON.parse(raw_data));

      this.debug(`Incoming -> ${raw_data}`);

      await mrHandlers[packet.op]?.(socket, packet);
    } catch (error) {
      logText(error, 'error');

      socket.close(4000, 'Invalid payload');
    }
  },
  start(server, port, debug_logs) {
    this.port = port;
    this.debug_logs = debug_logs;
    this.signalingServer = new WebSocketServer({
      server: server,
    });

    this.signalingServer.on('listening', async () => {
      this.debug(`Server up on port ${this.port}`);
    });

    this.signalingServer.on('connection', this.handleClientConnect.bind(this));
  },
};

export default mrServer;
