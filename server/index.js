const Snowflake = require('./helpers/snowflake');

// this is needed because of discord kotlin sending in id as Number and not string, and it messes precision
const originalJsonParse = JSON.parse;

JSON.parse = (text, reviver) => {
    try {
        return originalJsonParse(text, (key, value, context) => {
            let result = value;

            if (typeof value === 'number' && context?.source) {
                const rawValue = context.source;

                if (!Number.isSafeInteger(value) && !rawValue.includes('.') && !rawValue.toLowerCase().includes('e') && Snowflake.isValid(rawValue)) {
                    result = rawValue;
                }
            }

            return reviver ? reviver(key, result, context) : result;
        });
    }
    catch (e) {
        return originalJsonParse(text, reviver);
    }
};

const errors = require('./helpers/errors');
const express = require('express');
const gateway = require('./gateway');
const fs = require('fs');
const { createServer } = require('http');
const https = require('https');
const { logText } = require('./helpers/logger');
const database = require('./helpers/database');
const cookieParser = require('cookie-parser');
const path = require('path');
const globalUtils = require('./helpers/globalutils');
const { corsMiddleware, apiVersionMiddleware, assetsMiddleware, clientMiddleware } = require('./helpers/middlewares');
const router = require('./api/index');
const { Jimp, ResizeStrategy } = require('jimp');
const dispatcher = require('./helpers/dispatcher');
const permissions = require('./helpers/permissions');
const config = globalUtils.config;
const app = express();
const emailer = require('./helpers/emailer');
const MediasoupSignalingDelegate = require('./helpers/webrtc/MediasoupSignalingDelegate');
const udpServer = require('./udpserver');
const rtcServer = require('./rtcserver');
const os = require('os');
const mrServer = require('./mrserver');
const { Readable } = require("stream");

app.set('trust proxy', 1);

database.setupDatabase();

global.dispatcher = dispatcher;
global.gateway = gateway;
global.slowmodeCache = new Map();
global.gatewayIntentMap = new Map();
global.udpServer = udpServer;
global.rtcServer = rtcServer;
global.using_media_relay = globalUtils.config && globalUtils.config.mr_server.enabled;

if (!global.using_media_relay) {
    global.mediaserver = new MediasoupSignalingDelegate();
}

if (globalUtils.config.email_config.enabled) {
    global.emailer = new emailer(globalUtils.config.email_config, globalUtils.config.max_per_timeframe_ms, globalUtils.config.timeframe_ms, globalUtils.config.ratelimit_modifier);
}

global.sessions = new Map();
global.userSessions = new Map();
global.database = database;
global.permissions = permissions;
global.config = globalUtils.config;
global.rooms = [];
global.MEDIA_CODECS = [
    {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
            'minptime': 10,
            'useinbandfec': 1,
            'usedtx': 1
        },
        preferredPayloadType: 111,
    },
    {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        rtcpFeedback: [
            { type: 'ccm', parameter: 'fir' },
            { type: 'nack' },
            { type: 'nack', parameter: 'pli' },
            { type: 'goog-remb' }
        ],
        preferredPayloadType: 101
    }
];

global.guild_voice_states = new Map(); //guild_id -> voiceState[]

const portAppend = globalUtils.nonStandardPort ? ":" + config.port : "";
const base_url = config.base_url + portAppend;

global.full_url = base_url;
global.protocol_url = (config.secure ? 'https://' : 'http://') + config.base_url;

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

gateway.ready(gatewayServer, config.debug_logs['gateway'] ?? true);

//https://stackoverflow.com/a/15075395
function getIPAddress() {
    var interfaces = os.networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];

        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];

            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
                return alias.address;
        }
    }
    return '0.0.0.0';
}

(async () => {
    let ip_address = getIPAddress();

    if (config.media_server_public_ip) {
        let try_get_ip = await fetch("https://checkip.amazonaws.com");

        ip_address = await try_get_ip.text();
    }

    let rtcHttpServer;
    let mrHttpServer;

    if (certificates) {
        rtcHttpServer = https.createServer(certificates);
        mrHttpServer = https.createServer(certificates);
    }
    else {
        rtcHttpServer = createServer();
        mrHttpServer = createServer();
    }

    rtcHttpServer.listen(config.signaling_server_port);
    mrHttpServer.listen(config.mr_server.port);

    global.udpServer.start(config.udp_server_port, config.debug_logs['udp'] ?? true);
    global.rtcServer.start(rtcHttpServer, config.signaling_server_port, config.debug_logs['rtc'] ?? true);
    
    if (global.using_media_relay) {
        global.mrServer = mrServer;
        global.mrServer.start(mrHttpServer, config.mr_server.port, config.debug_logs['mr'] ?? true);
    }

    if (!global.using_media_relay) {
        await global.mediaserver.start(ip_address, 5000, 6000, config.debug_logs['media'] ?? true);
    }
})();

httpServer.listen(config.port, () => {
    logText(`HTTP ready on port ${config.port}`, "OLDCORD");
});

httpServer.on('request', app);

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(cookieParser());

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        logText(`Body Parsing Error: ${err.message}`, "error");

        return res.status(400).json({
            code: 400,
            message: "Malformed JSON body"
        });
    } //find the error for this

    logText(`Unhandled Error: ${err.stack}`, "error");
    
    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
});

app.use(corsMiddleware);

app.get('/proxy/:url', async (req, res) => {
    let requestUrl;
    let width = parseInt(req.query.width); 
    let height = parseInt(req.query.height);

    if (width > 800) {
        width = 800;
    }

    if (height > 800) {
        height = 800;
    }

    let shouldResize = !isNaN(width) && width > 0 && !isNaN(height) && height > 0;

    try {
        requestUrl = decodeURIComponent(req.params.url);
    } catch (e) {
        return res.status(400).send('Invalid URL encoding.');
    }
    
    if (!requestUrl) {
        requestUrl = "https://i.imgur.com/ezXZJ0h.png"; //to-do: get this from the cdn
    }

    if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
        return res.status(400).send('Invalid URL format.');
    }

    try {
        let response = await fetch(requestUrl);

        if (!response.ok) {
            return res.status(400).send('Invalid URL.');
        }

        let contentType = response.headers.get('content-type').toLowerCase() || 'image/jpeg';

        if (!contentType.startsWith('image/')) {
            return res.status(400).send('Only images are supported via this route. Try harder.');
        }

        let isAnimatedGif = contentType === 'image/gif';

        if (isAnimatedGif) {
            shouldResize = false;
        }

        if (shouldResize) {
            let imageBuffer = await response.arrayBuffer();
            let image;

            try {
                image = await Jimp.read(imageBuffer);
            } catch (err) {
                logText(`Failed to read image with Jimp for resizing: ${requestUrl}: ${err}`, "error");

                return res.status(400).send('Only images are supported via this route. Try harder.');
            }

            image.resize({ w: parseInt(width), h: parseInt(height)}); 

            let finalBuffer = await image.getBuffer(contentType);

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', finalBuffer.length);
            res.status(200).send(finalBuffer);
            
        } else {
            res.setHeader('Content-Type', contentType);

            let contentLength = response.headers.get('content-length');

            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
            }

            Readable.fromWeb(response.body).pipe(res);
        }
    } catch (error) {
        logText(error, "error");

        res.status(500).send('Internal server error.');
    }
});

app.get('/attachments/:guildid/:channelid/:filename', async (req, res) => {
    const guildId = path.basename(req.params.guildid);
    const channelId = path.basename(req.params.channelid);
    const fileName = path.basename(req.params.filename);
    const safeBabyModeExtensionsImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const safeBabyModeExtensionsVideo = ['.mp4', '.mov', '.webm'];
    const baseFilePath = path.join(process.cwd(), 'www_dynamic', 'attachments', guildId, channelId, fileName);
    const ext = path.extname(fileName).toLowerCase();

    res.setHeader('X-Content-Type-Options', 'nosniff');  //fuck you browser

    //to-do make html, text, etc files render as plain text

    try {
        let { format, width, height } = req.query;

        if (format === 'jpeg' && safeBabyModeExtensionsVideo.includes(ext)) {
            let fixed_path = baseFilePath.replace(fileName, "thumbnail.png");

            if (fs.existsSync(fixed_path)) {
                return res.status(200).type("image/png").sendFile(fixed_path);
            }
        }
        
        if (!width || !height) {
            if (!safeBabyModeExtensionsImage.includes(ext) && !safeBabyModeExtensionsVideo.includes(ext)) {
                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                res.setHeader('Content-Type', 'application/octet-stream');
            }

            return res.status(200).sendFile(baseFilePath);
        }

        if (ext === ".gif" || safeBabyModeExtensionsVideo.includes(ext)) {
            return res.status(200).sendFile(baseFilePath);
        }

        const mime = (ext === ".jpg" || ext === ".jpeg") ? 'image/jpeg' : 'image/png';
        const resizedFileName = `${fileName.split('.').slice(0, -1).join('.')}_${width}_${height}.${mime.split('/')[1]}`;
        const resizedFilePath = path.join(process.cwd(), 'www_dynamic', 'attachments', guildId, channelId, resizedFileName);

        if (fs.existsSync(resizedFilePath)) {
            return res.status(200).type(mime).sendFile(resizedFilePath);
        }

        const imageBuffer = fs.readFileSync(baseFilePath);
        const image = await Jimp.read(imageBuffer);

        let w = parseInt(width);
        let h = parseInt(height);

        if (isNaN(w) || w > 2560 || w < 0) {
            w = 800;
            h = Math.round(image.bitmap.height * (800 / image.bitmap.width));
        }

        if (isNaN(h) || h > 1440 || h < 0) {
            h = 800;
            w = Math.round(image.bitmap.width * (800 / image.bitmap.height));
        }

        image.resize(w, h);

        const resizedImage = await image.getBuffer(mime);

        fs.writeFileSync(resizedFilePath, resizedImage);

        return res.status(200).type(mime).sendFile(resizedFilePath);
    }
    catch(err) {
        if (!safeBabyModeExtensionsImage.includes(ext) && !safeBabyModeExtensionsVideo.includes(ext)) {
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        }
        
        return res.status(200).sendFile(baseFilePath);
    }
});

//No one can upload to these other than the instance owner so no real risk here until we allow them to
app.get('/icons/:serverid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(process.cwd(), 'www_dynamic', 'icons', req.params.serverid);

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

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.get("/app-assets/:applicationid/store/:file", async(req, res) => {
    try {
        const directoryPath = path.join(process.cwd(), 'www_dynamic', 'app_assets');

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

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.get("/store-directory-assets/applications/:applicationId/:file", async(req, res) => {
    try {
        const directoryPath = path.join(process.cwd(), 'www_dynamic', 'app_assets');

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

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.get('/channel-icons/:channelid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(process.cwd(), 'www_dynamic', 'group_icons', req.params.channelid);

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

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.get('/app-icons/:applicationid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(process.cwd(), 'www_dynamic', 'applications_icons', req.params.applicationid);

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

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.get('/splashes/:serverid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(process.cwd(), 'www_dynamic', 'splashes', req.params.serverid);

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

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.get('/banners/:serverid/:file', async (req, res) => {
    try {
        const directoryPath = path.join(process.cwd(), 'www_dynamic', 'banners', req.params.serverid);

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

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.get('/avatars/:userid/:file', async (req, res) => {
    try {
        let userid = req.params.userid;

        if (req.params.userid.includes("WEBHOOK_")) {
            userid = req.params.userid.split('_')[1];
        } //to-do think of long term solution to webhook overrides

        const directoryPath = path.join(process.cwd(), 'www_dynamic', 'avatars', userid);

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
    
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.get("/emojis/:file", async (req, res) => {
    try {
        const directoryPath = path.join(process.cwd(), 'www_dynamic', 'emojis');

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
    
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.use('/assets', express.static(path.join(process.cwd(), 'www_static', 'assets')));

app.use('/assets', express.static(path.join(process.cwd(), 'www_dynamic', 'assets')));

app.use("/assets/:asset", assetsMiddleware);

if (global.config.serveDesktopClient) {
    const desktop = require('./api/desktop');

    app.use(desktop);
}

app.use(clientMiddleware);

app.get("/api/users/:userid/avatars/:file", async (req, res) => {
    try {
        const filePath = path.join(process.cwd(), 'www_dynamic', 'avatars', req.params.userid, req.params.file);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send("File not found");
        }

        return res.status(200).sendFile(filePath);
    }
    catch(error) {
        logText(error, "error");
    
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

app.use("/api", apiVersionMiddleware, router);

app.get("/.well-known/spacebar",
(req, res) => {
    res.json({
      api: `${req.protocol}://${req.get('host')}/api`,
    });
  })

if (config.serve_selector) {
    app.get("/selector", (req, res) => {
        res.cookie('default_client_build', config.default_client_build || "october_5_2017", {
            maxAge: 100 * 365 * 24 * 60 * 60 * 1000
        });

        if (!config.require_release_date_cookie && !req.cookies['release_date']) {
            res.cookie('release_date', config.default_client_build || "october_5_2017", {
                maxAge: 100 * 365 * 24 * 60 * 60 * 1000
            });
        }

        return res.send(fs.readFileSync(`./www_static/assets/selector/index.html`, 'utf8'));
    });
}

app.get("/launch", (req, res) => {
    if (!req.query.release_date && config.require_release_date_cookie) {
        return res.redirect("/selector");
    }

    if (!config.require_release_date_cookie && !req.query.release_date) {
        req.query.release_date = config.default_client_build || "october_5_2017"
    }
    
    res.cookie('release_date', req.query.release_date, {
        maxAge: 100 * 365 * 24 * 60 * 60 * 1000
    });

    res.cookie('default_client_build', config.default_client_build || "october_5_2017", {
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
        assets_cdn_url: config.assets_cdn_url ?? "https://cdn.oldcordapp.com"
    });
});

app.get(/\/admin*/, (req, res) => {
    return res.send(fs.readFileSync(`./www_static/assets/admin/index.html`, 'utf8'));
});

app.get(/.*/, (req, res) => {
    try {
        if (!req.client_build && config.require_release_date_cookie) {
            return res.redirect("/selector");
        }

        if (!config.require_release_date_cookie && !req.client_build) {
            req.client_build = config.default_client_build || "october_5_2017"
        }

        if (!req.cookies['default_client_build'] || req.cookies['default_client_build'] !== (config.default_client_build || "october_5_2017")) {
            res.cookie('default_client_build', config.default_client_build || "october_5_2017", {
                maxAge: 100 * 365 * 24 * 60 * 60 * 1000
            });
        }

        res.sendFile(path.join(process.cwd(), "www_static/assets/bootloader/index.html"));
    }
    catch(error) {
        logText(error, "error");

        return res.redirect("/selector");
    }
});