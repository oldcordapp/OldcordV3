import { WebSocket } from 'ws';

import { mrHandlers, OPCODES } from '../handlers/mr.ts';
import { logText } from '../helpers/utils/logger.ts';
import { type GatewayPayload, GatewayPayloadSchema } from '../types/gateway.ts';

// TODO: Replace all String() or "as type" conversions with better ones

const mrServer = {
  debug_logs: false,
  servers: new Map(),
  emitter: null,
  debug(message) {
    if (!this.debug_logs) {
      return;
    }

    logText(message, 'MRA_CLIENT');
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
    this.debug(`Connected to a media server`);

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
          clearTimeout(socket.hb.timeout);
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

    if (socket.public_ip) {
      this.servers.delete(socket.public_ip);
    }
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
  connectToAgent(url) {
    this.debug(`Attempting to connect to media agent at ${url}`);
    const socket = new WebSocket(url);

    socket.on('open', () => {
        this.handleClientConnect(socket);
    });

    socket.on('error', (err) => {
        this.debug(`Error from media agent at ${url}: ${err.message}`);
    });

    socket.on('close', () => {
        this.debug(`Media agent at ${url} disconnected. Retrying in 5s...`);
        setTimeout(() => this.connectToAgent(url), 5000);
    });
  },
  start(debug_logs) {
    this.debug_logs = debug_logs;
    
    const agents = (global as any).config.mr_server.agents || [];
    
    if (agents.length === 0) {
        this.debug('No media agents configured.');
    }

    for (const agentUrl of agents) {
        this.connectToAgent(agentUrl);
    }
  },
};

export default mrServer;
