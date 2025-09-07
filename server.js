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
global.signaling_sessions = [];

const signalingServer = new WebSocket.Server({
    port: config.signaling_server_port
});

signalingServer.on('listening', async () => {
    await sodium.ready;

    logText(`Server up on port ${config.signaling_server_port}`, 'RTC_SERVER');
});

signalingServer.on('connection', async (socket) => {
    logText(`Client has connected`, 'RTC_SERVER');

    global.signaling_sessions.push(socket);

    socket.send(JSON.stringify({
        op: 8,
        d: {
            heartbeat_interval: 41250
        }
    }));

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

    socket.on('message', async (data) => {
        let raw_data = Buffer.from(data).toString("utf-8");
        let jason = JSON.parse(raw_data);

        logText(`Incoming -> ${raw_data}`, 'RTC_SERVER');

        if (jason.op === 0) {
            logText(`A client's state has changed to -> RTC_CONNECTING`, 'RTC_SERVER');

            socket.send(JSON.stringify({
                op: 2,
                d: {
                    ssrc: 1,
                    ip: "127.0.0.1",
                    port: socket.hostPort,
                    modes: ["plain", "xsalsa20_poly1305"],
                    heartbeat_interval: 1
                }
            }))
        } else if (jason.op == 3) {
            socket.send(JSON.stringify({
                op: 6,
                d: jason.d
            }))
        } else if (jason.op === 1) {
            let sdp = jason.d.sdp; 
            let codecs = jason.d.codecs;

            let offer = sdpTransform.parse(sdp);
            let isChrome = codecs.find((val) => val.name == "opus")?.payload_type === 111;
           /*
            a=ice-ufrag:4a/b
            a=ice-pwd:1msaOo+JhSsXIr+gxhqL282B
            a=ice-options:trickle
            a=rtpmap:111 opus/48000/2
            a=rtpmap:96 VP8/90000
            a=rtpmap:97 rtx/90000
           */
            
           /*
            [
                {
                    "name": "opus",
                    "type": "audio",
                    "priority": 1000,
                    "payload_type": 111
                },
                {
                    "name": "VP8",
                    "type": "video",
                    "priority": 1000,
                    "payload_type": 96,
                    "rtx_payload_type": 97
                },
                {
                    "name": "H264",
                    "type": "video",
                    "priority": 2000,
                    "payload_type": 103,
                    "rtx_payload_type": 104
                },
                {
                    "name": "VP9",
                    "type": "video",
                    "priority": 3000,
                    "payload_type": 98,
                    "rtx_payload_type": 99
                }
            ]
           */

           //The 2017 discord client uses sdp-transform, which ONLY works to parse the truncated SDP (only ICE and RTP mappings) in this case
           //to-do, should I use a media server?
           /*
           m=audio 50004 ICE/SDP

            c=IN IP4 127.0.0.1

            a=rtcp:50004

            a=ice-ufrag:jha4

            a=ice-pwd:qBVOne32T8X9VFENnh70ty

            a=fingerprint:sha-256 4A:79:94:16:44:3F:BD:05:41:5A:C7:20:F3:12:54:70:00:73:5D:33:00:2D:2C:80:9B:39:E1:9F:2D:A7:49:87

            a=candidate:1 1 UDP 4261412862 35.213.196.38 50004 typ host

            a=mid:0
           */ //The client is expecting an sdp like this from us, ice credentials are random

            let keyBuffer = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);

            socket.send(JSON.stringify({
                op: 4,
                d: {
                    sdp: `m=audio ${socket.hostPort} ICE/SDP\nc=IN IP4 127.0.0.1\na=rtcp:${socket.hostPort}\na=ice-ufrag:${iceParameters.usernameFragment}\na=ice-pwd:${iceParameters.password}\na=fingerprint:sha-256 ${socket.fingerprint}\na=candidate:1 1 UDP ${socket.candidate.priority} ${socket.candidate.address} ${socket.candidate.port} typ host`,
                    mode: "xsalsa20_poly1305",
                    secret_key: Array.from(keyBuffer)
                }
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