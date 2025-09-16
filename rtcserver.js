const sodium = require('libsodium-wrappers');
const { logText } = require('./helpers/logger');
const WebSocket = require('ws');
const { EventEmitter } = require("node:events");
const { OPCODES, rtcHandlers } = require('./handlers/rtc');

const rtcServer = {
    port: null,
    signalingServer: null,
    debugLogs: false,
    clients: new Map(),
    emitter: null,
    protocolsMap: new Map(),
    debug(message) {
        if (!this.debugLogs) {
            return;
        }

        logText(message, 'RTC_SERVER');
    },
    randomKeyBuffer() {
        return sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
    },
    async handleClientConnect(socket, req) {
        this.debug(`Client has connected`);

        socket.userAgent = req.headers['user-agent'] ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
        socket.isChrome = /Chrome/.test(socket.userAgent);

        socket.send(JSON.stringify({
            op: OPCODES.HEARTBEAT_INFO,
            d: {
                heartbeat_interval: 41250
            }
        }));

        socket.hb = {
            timeout: setTimeout(async () => {
                socket.close(4009, 'Session timed out');
            }, (45 * 1000) + (20 * 1000)),
            reset: () => {
                if (socket.hb.timeout != null) {
                    clearInterval(socket.hb.timeout);
                }

                socket.hb.timeout = new setTimeout(async () => {
                    socket.close(4009, 'Session timed out');
                }, (45 * 1000) + 20 * 1000);
            },
            acknowledge: (d) => {
                let session = socket.session;
                let base = {
                    op: OPCODES.HEARTBEAT_ACK,
                    d: d
                }
                let payload = session ? base : JSON.stringify(base);
                (session || socket).send(payload);
            }
        };

        socket.on('close', () => this.handleClientClose(socket));
        socket.on('message', (data) => this.handleClientMessage(socket, data));
    },
    async handleClientClose(socket) {
        for (const [id, clientSocket] of this.clients) {
            if (id !== socket.userid) {
                clientSocket.send(JSON.stringify({
                    op: OPCODES.DISCONNECT,
                    d: {
                        user_id: socket.userid
                    }
                }));
            }
        }

        if (socket.userid) {
            this.clients.delete(socket.userid);
        }
    },
    async handleClientMessage(socket, data) {
        try {
            let raw_data = Buffer.from(data).toString("utf-8");
            let packet = JSON.parse(raw_data);

            this.debug(`Incoming -> ${raw_data}`);

            await rtcHandlers[packet.op]?.(socket, packet);
        }
        catch (error) {
            logText(error, "error");

            socket.close(4000, 'Invalid payload');
        }
    },
    start(port, debugLogs) {
        this.emitter = new EventEmitter();
        this.port = port;
        this.debugLogs = debugLogs;
        this.signalingServer = new WebSocket.Server({
            port: port
        });

        this.signalingServer.on('listening', async () => {
            await sodium.ready;

            this.debug(`Server up on port ${this.port}`);
        });
        
        this.signalingServer.on('connection', this.handleClientConnect.bind(this));
    }
};

module.exports = rtcServer;