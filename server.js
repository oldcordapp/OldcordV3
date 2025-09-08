const express = require('express');
const gateway = require('./gateway');
const cors = require('cors');
const fs = require('fs');
const { createServer } = require('http');
const https = require('https');
const { logText } = require('./helpers/logger');
const database = require('./helpers/database');
const cookieParser = require('cookie-parser');
const path = require('path');
const globalUtils = require('./helpers/globalutils');
const { assetsMiddleware, clientMiddleware } = require('./helpers/middlewares');
const router = require('./api/index');
const Jimp = require('jimp');
const dispatcher = require('./helpers/dispatcher');
const permissions = require('./helpers/permissions');
const config = globalUtils.config;
const app = express();
const emailer = require('./helpers/emailer');
const fetch = require('node-fetch');
const WebSocket = require('ws').WebSocket;
const sodium = require('libsodium-wrappers');
const sdpTransform = require('sdp-transform');
const lodash = require('lodash');
const mediasoup = require('mediasoup');
const udp = require('dgram');
const session = require('./helpers/session');
const udpServer = udp.createSocket('udp4');

let worker;
let serve;

(async () => {
    worker = await mediasoup.createWorker();
    const mediaCodecs = [{
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2
    }];
    serve = await worker.createRouter({ mediaCodecs });
})();

app.set('trust proxy', 1);

database.setupDatabase();

global.dispatcher = dispatcher;
global.gateway = gateway;

if (globalUtils.config.email_config.enabled) {
    global.emailer = new emailer(globalUtils.config.email_config, globalUtils.config.max_per_timeframe_ms, globalUtils.config.timeframe_ms, globalUtils.config.ratelimit_modifier);
}

global.sessions = new Map();
global.userSessions = new Map();
global.database = database;
global.permissions = permissions;
global.config = globalUtils.config;
global.rooms = [];
global.signaling_clients = new Map();
global.udp_sessions = new Map();
global.encryptions = new Map();

udpServer.on('listening', () => {
    var address = udpServer.address();
    var ipaddr = address.address;

    logText(`Ready on ${ipaddr}:${config.udp_server_port}`, 'UDP_SERVER');
});

udpServer.on('error',function(error){
    logText(`An unexpected error occurred: ${error.toString()}`, 'UDP_SERVER');
    udpServer.close();
});

udpServer.sendBytes = (address, port, bytes) => {
    udpServer.send(bytes, port, address, (err) => {
        if (err) {
            console.error('Error sending response:', err);
        } else {
            console.log(`Sent ${bytes.length} bytes to ${address}:${port}`);
        }
    });
};

udpServer.on('message', (msg, info) => {
    if (msg.length < 4) {
        console.log("msg length failed check")
        return;
    }

    let ssrc = msg.readUInt32BE(0); //always in every packet, if its not here invalid packet

    let session = global.udp_sessions.get(ssrc);

    if (!session) {
        let encryption = global.encryptions.get(ssrc);

        if (!encryption) {
            encryption = {
                mode: "xsalsa20_poly1305",
                key: [
                    211,
                    214,
                    237,
                    8,
                    221,
                    92,
                    86,
                    132,
                    167,
                    57,
                    17,
                    71,
                    189,
                    169,
                    224,
                    211,
                    115,
                    17,
                    191,
                    82,
                    96,
                    98,
                    107,
                    155,
                    92,
                    72,
                    52,
                    246,
                    52,
                    109,
                    142,
                    194
                ]
            }
        }

        let sesh = {
            ip_addr: info.address,
            ip_port: info.port,
            encryption_mode: encryption.mode,
            encryption_key: encryption.key
        };

        global.udp_sessions.set(ssrc, sesh);

        session = sesh;
    }

    logText(`Incoming -> ${msg.length} bytes from ${info.address}:${info.port}`, 'UDP_SERVER');
    logText(`Attempted deserialization -> ${msg.toString()} from ${info.address}:${info.port}`, 'UDP_SERVER');

    if (msg.length === 70) {
        //ip discovery

        const ssrc = msg.readUInt32BE(0);
        console.log(`Received SSRC: ${ssrc}`);

        let ipDiscoveryResponse = Buffer.alloc(70);

        ipDiscoveryResponse.writeUInt32LE(ssrc, 0);
        ipDiscoveryResponse.write(info.address, 4, 'utf8');
        ipDiscoveryResponse.writeUInt16LE(info.port, 68);

        udpServer.sendBytes(info.address, info.port, ipDiscoveryResponse);
    } else if (msg.length === 8) {
        //ping packet(?)

        udpServer.sendBytes(info.address, info.port, msg);
    } else if (msg.length > 12) {
        console.log('incoming voice data??');

        const ssrc = msg.readUInt32BE(8);
        const sequence = msg.readUInt16BE(2);
        const timestamp = msg.readUInt32BE(4);

        const session = global.udp_sessions.get(ssrc);

        if (!session) {
            console.error(`Received voice data for unknown SSRC: ${ssrc}`);
            return;
        }

        const voiceKey = Buffer.from(session.encryption_key);
        const rtpHeader = msg.slice(0, 12);

        const nonce = Buffer.alloc(24).fill(0);
        msg.slice(0, 12).copy(nonce, 0);

        const encryptedPayload = msg.slice(12);

        const decryptedOpusData = sodium.crypto_secretbox_open_easy(
            encryptedPayload,
            nonce,
            voiceKey
        );

        if (!decryptedOpusData) {
            console.error(`Failed to decrypt voice packet from SSRC: ${ssrc}`);
            return;
        }

        global.udp_sessions.forEach((otherSession, otherSsrc) => {
            if (otherSsrc !== ssrc) {
                const otherKey = Buffer.from(otherSession.encryption_key);

                const reEncryptionNonce = Buffer.alloc(24).fill(0);
                msg.slice(0, 12).copy(reEncryptionNonce, 0);

                const reEncryptedPayload = sodium.crypto_secretbox_easy(
                    decryptedOpusData,
                    reEncryptionNonce,
                    otherKey
                );

                const reEncryptedPacket = Buffer.concat([
                    msg.slice(0, 12),
                    reEncryptedPayload
                ]);

                udpServer.send(reEncryptedPacket, otherSession.ip_port, otherSession.ip_addr);

                global.signaling_clients.forEach((sg, index) => {
                    sg.send(JSON.stringify({
                        op: 5,
                        d: {
                            ssrc: ssrc,
                            speaking: true,
                            delay: 0
                        }
                    }))
                })
            }
        });
    }
});

udpServer.bind(config.udp_server_port);

const signalingServer = new WebSocket.Server({
    port: config.signaling_server_port
});

signalingServer.on('listening', async () => {
    await sodium.ready;

    logText(`Server up on port ${config.signaling_server_port}`, 'RTC_SERVER');
});

signalingServer.on('connection', async (socket) => {
    logText(`Client has connected`, 'RTC_SERVER');

    socket.send(JSON.stringify({
        op: 8,
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
                op: 6,
                d: d
            }
            let payload = session ? base : JSON.stringify(base);
            (session || socket).send(payload);
        }
    };

    socket.transport = await serve.createWebRtcTransport({
        listenIps: [{ ip: '127.0.0.1', announcedIp: null }],
        enableUdp: true,
        enableTcp: true,
        initialAvailableOutgoingBitrate: 1000000,
        portRange: { min: 10000, max: 20000 }
    });

    const dtlsParameters = socket.transport.dtlsParameters;
    const iceParameters = socket.transport.iceParameters;
    const iceCandidates = socket.transport.iceCandidates;

    socket.candidate = iceCandidates[0];
    socket.fingerprint = dtlsParameters.fingerprints.find(x => x.algorithm === 'sha-256').value;

    socket.hostCandidate = iceCandidates.find(candidate => candidate.type === 'host');
    socket.hostPort = socket.hostCandidate.port;

    //let ssrc = socket.sessions.size + 1;
    let ssrc = 1;
    let keyBuffer = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);

    /*
    let keyArry = [
        211,
        214,
        237,
        8,
        221,
        92,
        86,
        132,
        167,
        57,
        17,
        71,
        189,
        169,
        224,
        211,
        115,
        17,
        191,
        82,
        96,
        98,
        107,
        155,
        92,
        72,
        52,
        246,
        52,
        109,
        142,
        194
    ];
    */

    socket.ssrc = Math.round(Math.random() * 99999);

    let identified = false;
    let resumed = false;

    socket.on('close', () => {
        for (const [id, clientSocket] of global.signaling_clients) {
            if (id !== socket.userid) {
                clientSocket.send(JSON.stringify({
                    op: 13,
                    d: {
                        user_id: socket.userid
                    }
                }));
            }
        }

        if (socket.userid) {
            global.signaling_clients.delete(socket.userid);
        }
    });

    socket.on('message', async (data) => {
        let raw_data = Buffer.from(data).toString("utf-8");
        let jason = JSON.parse(raw_data);

        logText(`Incoming -> ${raw_data}`, 'RTC_SERVER');

        if (jason.op === 0) {
            let protocol = jason.d.protocol;
            let userid = jason.d.user_id;
            let sessionid = jason.d.session_id;
            let token = jason.d.token;

            if (identified || socket.session) {
                return socket.close(4005, 'You have already identified.');
            }

            logText("New client connection", "GATEWAY");

            identified = true;

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
            }, 'voice');

            socket.session = sesh;

            socket.session.server_id = jason.d.server_id;

            socket.session.start();

            await socket.session.prepareReady();

            logText(`A client's state has changed to -> RTC_CONNECTING`, 'RTC_SERVER');

            socket.userid = user.id;

            global.signaling_clients.set(socket.userid, socket);

            logText(`Client ${socket.userid} has identified.`, 'RTC_SERVER');
        
            socket.send(JSON.stringify({
                op: 2,
                d: {
                    ssrc: socket.ssrc,
                    ip: "127.0.0.1",
                    port: protocol === 'webrtc' ? socket.hostPort : config.udp_server_port,
                    modes: ["plain", "xsalsa20_poly1305"],
                    heartbeat_interval: 1
                }
            }))
        } else if (jason.op === 3) {
            if (!socket.hb) return;

            socket.hb.acknowledge(jason.d);
            socket.hb.reset();
        } else if (jason.op === 1) {
            let protocol = jason.d.protocol;

            global.encryptions.set(ssrc, {
                mode: "xsalsa20_poly1305",
                key: Array.from(keyBuffer)
            });

            if (protocol === 'webrtc') {
                let sdp = jason.d.sdp || jason.d.data;
                let codecs = jason.d.codecs || [ {
                    name: "opus",
                    type: "audio",
                    priority: 1000,
                    payload_type: 111
                }]; //older clients dont have video/screensharing so its just voice yay

                let offer = sdpTransform.parse(sdp);
                let isChrome = codecs.find((val) => val.name == "opus")?.payload_type === 111;

                return socket.send(JSON.stringify({
                    op: 4,
                    d: {
                        sdp: `m=audio ${socket.hostPort} ICE/SDP\nc=IN IP4 127.0.0.1\na=rtcp:${socket.hostPort}\na=ice-ufrag:${iceParameters.usernameFragment}\na=ice-pwd:${iceParameters.password}\na=fingerprint:sha-256 ${socket.fingerprint}\na=candidate:1 1 UDP ${socket.candidate.priority} ${socket.candidate.address} ${socket.candidate.port} typ host`,
                        mode: "xsalsa20_poly1305",
                        secret_key: Array.from(keyBuffer)
                    }
                }))
            } else if (protocol === 'webrtc-p2p') {
                //this doesnt support encryption

                return socket.send(JSON.stringify({
                    op: 4,
                    d: {
                        peers: Array.from(global.signaling_clients.keys()).filter(id => socket.userid != id)
                    }
                }))
            } else {
                return socket.send(JSON.stringify({
                    op: 4,
                    d: {
                        mode: "xsalsa20_poly1305",
                        secret_key: Array.from(keyBuffer)
                    }
                }))
            }
        } else if (jason.op === 10) {
            const recipientId = jason.d.user_id;
            const recipientSocket = global.signaling_clients.get(recipientId);

            if (recipientSocket) {
                const forwardedPayload = { ...jason.d, user_id: socket.userid };
                const forwardedMessage = { op: 10, d: forwardedPayload };

                recipientSocket.send(JSON.stringify(forwardedMessage));
                logText(`Forwarded op:10 message from ${socket.userid} to ${recipientId}`, 'RTC_SERVER');
            } else {
                logText(`Recipient ${recipientId} not found.`, 'RTC_SERVER');
            }
        } else if (jason.op === 5) {
            for (const [id, clientSocket] of global.signaling_clients) {
                if (id !== socket.userid) {
                    clientSocket.send(JSON.stringify({
                        op: 5,
                        d: {
                            speaking: jason.d.speaking,
                            ssrc: jason.d.ssrc,
                            user_id: socket.userid
                        }
                    }));
                }
            }
        } else if (jason.op === 12) {
            let video_ssrc = parseInt(jason.d.video_ssrc ?? "0");
            let rtx_ssrc = parseInt(jason.d.rtx_ssrc ?? "0");
            let audio_ssrc = socket.ssrc;
            let response = {
                audio_ssrc: audio_ssrc,
                video_ssrc: video_ssrc,
                rtx_ssrc: rtx_ssrc
            }

            socket.send(JSON.stringify({
                op: 12,
                d: response
            }))

             for (const [id, clientSocket] of global.signaling_clients) {
                if (id !== socket.userid) {
                    response.user_id = socket.userid;

                    clientSocket.send(JSON.stringify({
                        op: 12,
                        d: response
                    }));
                }
            }
        } else if (jason.op === 7) {
            let token = jason.d.token;
            let session_id = jason.d.session_id;
            let server_id = jason.d.server_id;

            if (!token || !session_id) return socket.close(4000, 'Invalid payload');

            if (socket.session || resumed) return socket.close(4005, 'Cannot resume at this time');

            resumed = true;

            let session2 = global.sessions.get(`voice:${session_id}`);

            if (!session2) {
                let sesh = new session(globalUtils.generateString(16), socket, socket.user, token, false, {
                    game_id: null,
                    status: 'online',
                    activities: [],
                    user: socket.user ? globalUtils.miniUserObject(socket.user) : null
                }, 'voice');

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
                op: 9,
                d: null
            }))
        }
    });
});

const portAppend = globalUtils.nonStandardPort ? ":" + config.port : "";
const base_url = config.base_url + portAppend;

global.full_url = base_url;

process.on('uncaughtException', (error) => {
    logText(error, "error");
});

//Load certificates (if any)
let certificates = null;
if (config.cert_path && config.cert_path !== "" && config.key_path && config.key_path !== "") {
    certificates = {
        cert: fs.readFileSync(config.cert_path),
        key: fs.readFileSync(config.key_path)
    };
}

//Prepare a HTTP server
let httpServer;
if (certificates)
    httpServer = https.createServer(certificates);
else
    httpServer = createServer();

let gatewayServer;
if (config.port == config.ws_port) {
    //Reuse the HTTP server
    gatewayServer = httpServer;
} else {
    //Prepare a separate HTTP server for the gateway
    if (certificates)
        gatewayServer = https.createServer(certificates);
    else
        gatewayServer = createServer();
    
    gatewayServer.listen(config.ws_port, () => {
        logText(`Gateway ready on port ${config.ws_port}`, "GATEWAY");
    });
}

gateway.ready(gatewayServer);

httpServer.listen(config.port, () => {
    logText(`HTTP ready on port ${config.port}`, "OLDCORD");
});

httpServer.on('request', app);

app.use(express.json({
    limit: '10mb',
}));

app.use(cookieParser());

app.use(cors());

app.get('/proxy', async (req, res) => {
    let url = req.query.url;
    
    if (!url) {
        url = "https://i-love.nekos.zip/ztn1pSsdos.png"
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            return res.status().send('Failed to proxy URL');
        }

        res.setHeader('Content-Type', response.headers.get('content-type'));

        response.body.pipe(res);
    } catch (error) {
        res.status(500).send('Error fetching the image');
    }
});

app.get('/attachments/:guildid/:channelid/:filename', async (req, res) => {
    const baseFilePath = path.join(__dirname, 'www_dynamic', 'attachments', req.params.guildid, req.params.channelid, req.params.filename);
    
    try {
        let { width, height } = req.query;
        const url = req.url;
        
        if (!url || !width || !height) {
            return res.status(200).sendFile(baseFilePath);
        }
        
        let urlWithoutParams = url.split('?', 2)[0];
        if (urlWithoutParams.endsWith(".gif") || urlWithoutParams.endsWith(".mp4")|| urlWithoutParams.endsWith(".webm")) {
            return res.status(200).sendFile(baseFilePath);
        }

        if (parseInt(width) > 800) {
            width = '800';
        }

        if (parseInt(height) > 800) {
            height = '800';
        }

        const mime = req.params.filename.endsWith(".jpg") ? 'image/jpeg' : 'image/png';

        const resizedFileName = `${req.params.filename.split('.').slice(0, -1).join('.')}_${width}_${height}.${mime.split('/')[1]}`;
        const resizedFilePath = path.join(__dirname, 'www_dynamic', 'attachments', req.params.guildid, req.params.channelid, resizedFileName);

        if (fs.existsSync(resizedFilePath)) {
            return res.status(200).type(mime).sendFile(resizedFilePath);
        }

        const imageBuffer = fs.readFileSync(baseFilePath);

        const image = await Jimp.read(imageBuffer);

        image.resize(parseInt(width), parseInt(height));

        const resizedImage = await image.getBufferAsync(mime);

        fs.writeFileSync(resizedFilePath, resizedImage);

        return res.status(200).type(mime).sendFile(resizedFilePath);
    }
    catch(err) {
        logText(err, "error");
        return res.status(200).sendFile(baseFilePath);
    }
});

app.get('/icons/:serverid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'www_dynamic', 'icons', req.params.serverid);

        if (!fs.existsSync(directoryPath)) {
            return res.status(404).send("File not found");
        }

        const files = fs.readdirSync(directoryPath);
        const matchedFile = files.find(file => file.startsWith(req.params.file.split('.')[0]));

        if (!matchedFile) {
            return res.status(404).send("File not found");
        }

        const filePath = path.join(directoryPath, matchedFile);

        return res.status(200).sendFile(filePath);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

app.get("/app-assets/:applicationid/store/:file", async(req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'www_dynamic', 'app_assets');

        if (!fs.existsSync(directoryPath)) {
            return res.status(404).send("File not found");
        }

        let files = fs.readdirSync(directoryPath);
        let matchedFile = null;

        if (req.params.file.includes(".mp4")) {
            matchedFile = files[1];
        } else matchedFile = files[0];

        if (!matchedFile) {
            return res.status(404).send("File not found");
        }

        const filePath = path.join(directoryPath, matchedFile);

        return res.status(200).sendFile(filePath);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

app.get('/channel-icons/:channelid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'www_dynamic', 'group_icons', req.params.channelid);

        if (!fs.existsSync(directoryPath)) {
            return res.status(404).send("File not found");
        }

        const files = fs.readdirSync(directoryPath);
        const matchedFile = files.find(file => file.startsWith(req.params.file.split('.')[0]));

        if (!matchedFile) {
            return res.status(404).send("File not found");
        }

        const filePath = path.join(directoryPath, matchedFile);

        return res.status(200).sendFile(filePath);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

app.get('/app-icons/:applicationid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'www_dynamic', 'applications_icons', req.params.applicationid);

        if (!fs.existsSync(directoryPath)) {
            return res.status(404).send("File not found");
        }

        const files = fs.readdirSync(directoryPath);
        const matchedFile = files.find(file => file.startsWith(req.params.file.split('.')[0]));

        if (!matchedFile) {
            return res.status(404).send("File not found");
        }

        const filePath = path.join(directoryPath, matchedFile);

        return res.status(200).sendFile(filePath);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

app.get('/splashes/:serverid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'www_dynamic', 'splashes', req.params.serverid);

        if (!fs.existsSync(directoryPath)) {
            return res.status(404).send("File not found");
        }

        const files = fs.readdirSync(directoryPath);
        const matchedFile = files.find(file => file.startsWith(req.params.file.split('.')[0]));

        if (!matchedFile) {
            return res.status(404).send("File not found");
        }

        const filePath = path.join(directoryPath, matchedFile);

        return res.status(200).sendFile(filePath);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

app.get('/banners/:serverid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'www_dynamic', 'banners', req.params.serverid);

        if (!fs.existsSync(directoryPath)) {
            return res.status(404).send("File not found");
        }

        const files = fs.readdirSync(directoryPath);
        const matchedFile = files.find(file => file.startsWith(req.params.file.split('.')[0]));

        if (!matchedFile) {
            return res.status(404).send("File not found");
        }

        const filePath = path.join(directoryPath, matchedFile);

        return res.status(200).sendFile(filePath);
    } catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

app.get('/avatars/:userid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'www_dynamic', 'avatars', req.params.userid);

        if (!fs.existsSync(directoryPath)) {
            return res.status(404).send("File not found");
        }

        const files = fs.readdirSync(directoryPath);
        const matchedFile = files.find(file => file.startsWith(req.params.file.split('.')[0]));

        if (!matchedFile) {
            return res.status(404).send("File not found");
        }

        const filePath = path.join(directoryPath, matchedFile);

        return res.status(200).sendFile(filePath);
    }
    catch(error) {
        logText(error, "error");
    
        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

app.get("/emojis/:file", async (req, res) => {
    try {
        const directoryPath = path.join(__dirname, 'www_dynamic', 'emojis');

        if (!fs.existsSync(directoryPath)) {
            return res.status(404).send("File not found");
        }

        const files = fs.readdirSync(directoryPath);
        const matchedFile = files.find(file => file.startsWith(req.params.file.split('.')[0]));

        if (!matchedFile) {
            return res.status(404).send("File not found");
        }

        const filePath = path.join(directoryPath, matchedFile);

        return res.status(200).sendFile(filePath);
    }
    catch(error) {
        logText(error, "error");
    
        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

app.use('/assets', express.static(path.join(__dirname, 'www_static', 'assets')));

app.use('/assets', express.static(path.join(__dirname, 'www_dynamic', 'assets')));

app.use("/assets/:asset", assetsMiddleware);

if (global.config.serveDesktopClient) {
    const desktop = require('./api/desktop');

    app.use(desktop);
}

app.use(clientMiddleware);

app.get("/api/users/:userid/avatars/:file", async (req, res) => {
    try {
        const filePath = path.join(__dirname, 'www_dynamic', 'avatars', req.params.userid, req.params.file);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send("File not found");
        }

        return res.status(200).sendFile(filePath);
    }
    catch(error) {
        logText(error, "error");
    
        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

app.use("/api/v6/", router);

app.use("/api/v2/", router);

app.use("/api/", router);

app.use("/api/v*/", (_, res) => {
    return res.status(400).json({
        code: 400,
        message: "Invalid API Version"
    });
});

if (config.serve_selector) {
    app.get("/selector", (_, res) => {
        return res.send(fs.readFileSync(`./www_static/assets/selector/selector.html`, 'utf8'));
    });
}

app.get("/launch", (req, res) => {
    if (!req.query.release_date) {
        return res.redirect("/selector");
    }
    
    res.cookie('release_date', req.query.release_date, {
        maxAge: 100 * 365 * 24 * 60 * 60 * 1000
    });

    res.redirect("/");
});

app.get("/channels/:guildid/:channelid", (_, res) => {
    return res.redirect("/");
});

app.get("/instance", (req, res) => {
    const portAppend = globalUtils.nonStandardPort ? ":" + config.port : "";
    const base_url = config.base_url + portAppend;

    res.json({
        instance: config.instance,
        custom_invite_url: config.custom_invite_url == "" ? base_url + "/invite" : config.custom_invite_url,
        gateway: globalUtils.generateGatewayURL(req),
        captcha_options: config.captcha_config ? { ...config.captcha_config, secret_key: undefined } : {},
    });
});

app.get("*", (req, res) => {
    try {
        if (!req.client_build) {
            return res.redirect("/selector");
        }

        res.sendFile(path.join(__dirname, "www_static/assets/bootloader/index.html"));
    }
    catch(error) {
        logText(error, "error");

        return res.redirect("/selector");
    }
});