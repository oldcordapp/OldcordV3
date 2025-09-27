const sodium = require('libsodium-wrappers');
const { logText } = require('./helpers/logger');
const WebSocket = require('ws');
const { mrHandlers, OPCODES } = require('./handlers/mr');

const mrServer = {
    port: null,
    debug_logs: false,
    servers: new Map(),
    emitter: null,
    signalingServer: null,
    debug(message) {
        if (!this.debug_logs) {
            return;
        }

        logText(message, 'MR_SERVER');
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
            port: serverObject.port
        };
    },
    async handleClientConnect(socket) {
        this.debug(`Media server has connected`);

        socket.send(JSON.stringify({
            op: OPCODES.HEARTBEAT_INFO,
            d: {
                heartbeat_interval: 41250
            }
        }));

        socket.hb = {
            timeout: setTimeout(async () => {
                this.handleClientClose(socket, true);
            }, (45 * 1000) + (20 * 1000)),
            reset: () => {
                if (socket.hb.timeout != null) {
                    clearInterval(socket.hb.timeout);
                }

                socket.hb.timeout = new setTimeout(async () => {
                    this.handleClientClose(socket, true);
                }, (45 * 1000) + 20 * 1000);
            },
            acknowledge: (d) => {
                socket.send(JSON.stringify({
                    op: OPCODES.HEARTBEAT_ACK,
                    d: d
                }));
            }
        };

        socket.on('close', () => this.handleClientClose(socket));
        socket.on('message', (data) => this.handleClientMessage(socket, data));
    },
    async handleClientClose(socket, timedOut = false) {
        if (timedOut) {
            this.debug(`!! MEDIA SERVER HAS TIMED OUT - CHECK SERVER ASAP`);
        }

        this.debug(`Lost connection to media server -> Removing from store...`);

        this.servers.delete(socket.public_ip);
    },
    async handleClientMessage(socket, data) {
        try {
            let raw_data = Buffer.from(data).toString("utf-8");
            let packet = JSON.parse(raw_data);

            this.debug(`Incoming -> ${raw_data}`);

            await mrHandlers[packet.op]?.(socket, packet);
        }
        catch (error) {
            logText(error, "error");

            socket.close(4000, 'Invalid payload');
        }
    },
    start(port, debug_logs) {
        this.port = port;
        this.debug_logs = debug_logs;
        this.signalingServer = new WebSocket.Server({
            port: port
        });

        this.signalingServer.on('listening', async () => {
            this.debug(`Server up on port ${this.port}`);
        });
        
        this.signalingServer.on('connection', this.handleClientConnect.bind(this));
    }
};

module.exports = mrServer;