import Snowflake from './helpers/snowflake.js';

// this is needed because of discord kotlin sending in id as Number and not string, and it messes precision
const originalJsonParse = JSON.parse;

JSON.parse = (text: string, reviver?: JSONReviver): unknown => {
  try {
    return originalJsonParse(text, function (key: string, value: any, context: JSONReviverContext) {
      let result = value;

      if (typeof value === 'number' && context?.source) {
        const rawValue = context.source;

        if (
          !Number.isSafeInteger(value) &&
          !rawValue.includes('.') &&
          !rawValue.toLowerCase().includes('e') &&
          Snowflake.isValid(rawValue)
        ) {
          result = rawValue;
        }
      }

      return reviver ? reviver.call(this, key, result, context) : result;
    });
  } catch (e) {
    return originalJsonParse(text, reviver);
  }
};

import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'fs';
import { createServer } from 'http';
import https from 'https';
import { Jimp } from 'jimp';
import path from 'path';

import router from './api/index.js';
import gateway from './gateway.ts';
import database from './helpers/database.js';
import errors from './helpers/errors.js';
import globalUtils from './helpers/globalutils.js';
import { logText } from './helpers/logger.js';
import {
  apiVersionMiddleware,
  assetsMiddleware,
  clientMiddleware,
  corsMiddleware,
} from './helpers/middlewares.js';
import permissions from './helpers/permissions.js';
const config = globalUtils.config;
const app = express();
import os from 'os';
import { Readable } from 'stream';

import emailer from './helpers/emailer.js';
import MediasoupSignalingDelegate from './helpers/webrtc/MediasoupSignalingDelegate.js';
import mrServer from './mrserver.ts';
import rtcServer from './rtcserver.ts';
import udpServer from './udpserver.ts';

// TODO: Replace all String() or "as type" conversions with better ones

app.set('trust proxy', 1);

database.setupDatabase();

global.gateway = gateway;
global.slowmodeCache = new Map();
global.gatewayIntentMap = new Map();
global.udpServer = udpServer;
global.rtcServer = rtcServer;
global.using_media_relay = globalUtils.config?.mr_server.enabled;

if (!global.using_media_relay) {
  global.mediaserver = new MediasoupSignalingDelegate();
}

if (globalUtils.config.email_config.enabled) {
  global.emailer = new emailer(
    globalUtils.config.email_config,
    globalUtils.config.max_per_timeframe_ms,
    globalUtils.config.timeframe_ms,
    globalUtils.config.ratelimit_modifier,
  );
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
      minptime: 10,
      useinbandfec: 1,
      usedtx: 1,
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
      { type: 'goog-remb' },
    ],
    preferredPayloadType: 101,
  },
];

global.guild_voice_states = new Map(); //guild_id -> voiceState[]

const portAppend = globalUtils.nonStandardPort ? ':' + config.port : '';
const base_url = config.base_url + portAppend;

global.full_url = base_url;
global.protocol_url = (config.secure ? 'https://' : 'http://') + config.base_url;

process.on('uncaughtException', (error) => {
  logText(error, 'error');
});

//Load certificates (if any)
let certificates: { cert: Buffer<ArrayBuffer>; key: Buffer<ArrayBuffer> } | null = null;
if (config.cert_path && config.cert_path !== '' && config.key_path && config.key_path !== '') {
  certificates = {
    cert: fs.readFileSync(config.cert_path),
    key: fs.readFileSync(config.key_path),
  };
}

//Prepare a HTTP server
let httpServer: {
  listen: (arg0: any, arg1: () => void) => void;
  on: (arg0: string, arg1: any) => void;
};
if (certificates) httpServer = https.createServer(certificates);
else httpServer = createServer();

let gatewayServer: { listen: (arg0: any, arg1: () => void) => void };
if (config.port == config.ws_port) {
  //Reuse the HTTP server
  gatewayServer = httpServer;
} else {
  //Prepare a separate HTTP server for the gateway
  if (certificates) gatewayServer = https.createServer(certificates);
  else gatewayServer = createServer();

  gatewayServer.listen(config.ws_port, () => {
    logText(`Gateway ready on port ${config.ws_port}`, 'GATEWAY');
  });
}

gateway.ready(gatewayServer, config.debug_logs.gateway ?? true);

//https://stackoverflow.com/a/15075395
function getIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];

    if (iface) {
      for (let i = 0; i < iface.length; i++) {
        const alias = iface[i];

        if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
          return alias.address;
      }
    }
  }
  return '0.0.0.0';
}

(async () => {
  let ip_address = getIPAddress();

  if (config.media_server_public_ip) {
    const try_get_ip = await fetch('https://checkip.amazonaws.com');

    ip_address = await try_get_ip.text();
  }

  let rtcHttpServer: { listen: (arg0: any) => void };
  let mrHttpServer: { listen: (arg0: any) => void };

  if (certificates) {
    rtcHttpServer = https.createServer(certificates);
    mrHttpServer = https.createServer(certificates);
  } else {
    rtcHttpServer = createServer();
    mrHttpServer = createServer();
  }

  rtcHttpServer.listen(config.signaling_server_port);
  mrHttpServer.listen(config.mr_server.port);

  global.udpServer.start(config.udp_server_port, config.debug_logs.udp ?? true);
  global.rtcServer.start(
    rtcHttpServer,
    config.signaling_server_port,
    config.debug_logs.rtc ?? true,
  );

  if (global.using_media_relay) {
    global.mrServer = mrServer;
    global.mrServer.start(mrHttpServer, config.mr_server.port, config.debug_logs.mr ?? true);
  }

  if (!global.using_media_relay) {
    await global.mediaserver.start(ip_address, 5000, 6000, config.debug_logs.media ?? true);
  }
})();

httpServer.listen(config.port, () => {
  logText(`HTTP ready on port ${config.port}`, 'OLDCORD');
});

httpServer.on('request', app);

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(cookieParser());

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    logText(`Body Parsing Error: ${err.message}`, 'error');

    return res.status(400).json({
      code: 400,
      message: 'Malformed JSON body',
    });
  } //find the error for this

  logText(`Unhandled Error: ${err.stack}`, 'error');

  return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
});

app.use(corsMiddleware);

app.get('/proxy/:url', async (req, res) => {
  let requestUrl: string | URL | Request;
  let width = parseInt(req.query.width as string);
  let height = parseInt(req.query.height as string);

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
    res.status(400).send('Invalid URL encoding.');
    return;
  }

  if (!requestUrl) {
    requestUrl = 'https://i.imgur.com/ezXZJ0h.png'; //to-do: get this from the cdn
  }

  if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
    res.status(400).send('Invalid URL format.');
    return;
  }

  try {
    const response = await fetch(requestUrl);

    if (!response.ok) {
      res.status(400).send('Invalid URL.');
      return;
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || 'image/jpeg';

    if (!contentType.startsWith('image/')) {
      res.status(400).send('Only images are supported via this route. Try harder.');
      return;
    }

    const isAnimatedGif = contentType === 'image/gif';

    if (isAnimatedGif) {
      shouldResize = false;
    }

    if (shouldResize) {
      const imageBuffer = await response.arrayBuffer();
      let image;

      try {
        image = await Jimp.read(imageBuffer);
      } catch (err) {
        logText(`Failed to read image with Jimp for resizing: ${requestUrl}: ${err}`, 'error');

        res.status(400).send('Only images are supported via this route. Try harder.');
        return;
      }

      image.resize({ w: width, h: height });

      const finalBuffer = await image.getBuffer(contentType);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', finalBuffer.length);
      res.status(200).send(finalBuffer);
    } else {
      res.setHeader('Content-Type', contentType);

      const contentLength = response.headers.get('content-length');

      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      Readable.fromWeb(response.body!).pipe(res);
    }
  } catch (error) {
    logText(error, 'error');

    res.status(500).send('Internal server error.');
  }
});

app.get('/attachments/:guildid/:channelid/:filename', async (req, res) => {
  const guildId = path.basename(req.params.guildid);
  const channelId = path.basename(req.params.channelid);
  const fileName = path.basename(req.params.filename);
  const safeBabyModeExtensionsImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  const safeBabyModeExtensionsVideo = ['.mp4', '.mov', '.webm'];
  const baseFilePath = path.join(
    process.cwd(),
    'www_dynamic',
    'attachments',
    guildId,
    channelId,
    fileName,
  );
  const ext = path.extname(fileName).toLowerCase();

  res.setHeader('X-Content-Type-Options', 'nosniff'); //fuck you browser

  //to-do make html, text, etc files render as plain text

  try {
    const { format, width, height } = req.query;

    if (format === 'jpeg' && safeBabyModeExtensionsVideo.includes(ext)) {
      const fixed_path = baseFilePath.replace(fileName, 'thumbnail.png');

      if (fs.existsSync(fixed_path)) {
        res.status(200).type('image/png').sendFile(fixed_path);
        return;
      }
    }

    if (!width || !height) {
      if (
        !safeBabyModeExtensionsImage.includes(ext) &&
        !safeBabyModeExtensionsVideo.includes(ext)
      ) {
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
      }

      res.status(200).sendFile(baseFilePath);
      return;
    }

    if (ext === '.gif' || safeBabyModeExtensionsVideo.includes(ext)) {
      res.status(200).sendFile(baseFilePath);
      return;
    }

    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    const resizedFileName = `${fileName.split('.').slice(0, -1).join('.')}_${width}_${height}.${mime.split('/')[1]}`;
    const resizedFilePath = path.join(
      process.cwd(),
      'www_dynamic',
      'attachments',
      guildId,
      channelId,
      resizedFileName,
    );

    if (fs.existsSync(resizedFilePath)) {
      res.status(200).type(mime).sendFile(resizedFilePath);
      return;
    }

    const imageBuffer = fs.readFileSync(baseFilePath);
    const image = await Jimp.read(imageBuffer);

    let w = parseInt(width as string);
    let h = parseInt(height as string);

    if (isNaN(w) || w > 2560 || w < 0) {
      w = 800;
      h = Math.round(image.bitmap.height * (800 / image.bitmap.width));
    }

    if (isNaN(h) || h > 1440 || h < 0) {
      h = 800;
      w = Math.round(image.bitmap.width * (800 / image.bitmap.height));
    }

    image.resize({ w, h });

    const resizedImage = await image.getBuffer(mime);

    fs.writeFileSync(resizedFilePath, resizedImage);

    res.status(200).type(mime).sendFile(resizedFilePath);
    return;
  } catch (err) {
    if (!safeBabyModeExtensionsImage.includes(ext) && !safeBabyModeExtensionsVideo.includes(ext)) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    }

    res.status(200).sendFile(baseFilePath);
    return;
  }
});

//No one can upload to these other than the instance owner so no real risk here until we allow them to
app.get('/icons/:serverid/:file', async (req, res) => {
  try {
    const directoryPath = path.join(process.cwd(), 'www_dynamic', 'icons', req.params.serverid);

    if (!fs.existsSync(directoryPath)) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(directoryPath);
    const matchedFile = files.find((file: string) =>
      file.startsWith(req.params.file.split('.')[0]),
    );

    if (!matchedFile) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(directoryPath, matchedFile);

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.get('/app-assets/:applicationid/store/:file', async (req, res) => {
  try {
    const directoryPath = path.join(process.cwd(), 'www_dynamic', 'app_assets');

    if (!fs.existsSync(directoryPath)) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(directoryPath);
    let matchedFile: string | null = null;

    if (req.params.file.includes('.mp4')) {
      matchedFile = files[1];
    } else matchedFile = files[0];

    if (!matchedFile) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(directoryPath, matchedFile);

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.get('/store-directory-assets/applications/:applicationId/:file', async (req, res) => {
  try {
    const directoryPath = path.join(process.cwd(), 'www_dynamic', 'app_assets');

    if (!fs.existsSync(directoryPath)) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(directoryPath);
    let matchedFile: string | null = null;

    if (req.params.file.includes('.mp4')) {
      matchedFile = files[1];
    } else matchedFile = files[0];

    if (!matchedFile) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(directoryPath, matchedFile);

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.get('/channel-icons/:channelid/:file', async (req, res) => {
  try {
    const directoryPath = path.join(
      process.cwd(),
      'www_dynamic',
      'group_icons',
      req.params.channelid,
    );

    if (!fs.existsSync(directoryPath)) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(directoryPath);
    const matchedFile = files.find((file: string) =>
      file.startsWith(req.params.file.split('.')[0]),
    );

    if (!matchedFile) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(directoryPath, matchedFile);

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.get('/app-icons/:applicationid/:file', async (req, res) => {
  try {
    const directoryPath = path.join(
      process.cwd(),
      'www_dynamic',
      'applications_icons',
      req.params.applicationid,
    );

    if (!fs.existsSync(directoryPath)) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(directoryPath);
    const matchedFile = files.find((file: string) =>
      file.startsWith(req.params.file.split('.')[0]),
    );

    if (!matchedFile) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(directoryPath, matchedFile);

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.get('/splashes/:serverid/:file', async (req, res) => {
  try {
    const directoryPath = path.join(process.cwd(), 'www_dynamic', 'splashes', req.params.serverid);

    if (!fs.existsSync(directoryPath)) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(directoryPath);
    const matchedFile = files.find((file: string) =>
      file.startsWith(req.params.file.split('.')[0]),
    );

    if (!matchedFile) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(directoryPath, matchedFile);

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.get('/banners/:serverid/:file', async (req, res) => {
  try {
    const directoryPath = path.join(process.cwd(), 'www_dynamic', 'banners', req.params.serverid);

    if (!fs.existsSync(directoryPath)) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(directoryPath);
    const matchedFile = files.find((file: string) =>
      file.startsWith(req.params.file.split('.')[0]),
    );

    if (!matchedFile) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(directoryPath, matchedFile);

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.get('/avatars/:userid/:file', async (req, res) => {
  try {
    let userid = req.params.userid;

    if (req.params.userid.includes('WEBHOOK_')) {
      userid = req.params.userid.split('_')[1];
    } //to-do think of long term solution to webhook overrides

    const directoryPath = path.join(process.cwd(), 'www_dynamic', 'avatars', userid);

    if (!fs.existsSync(directoryPath)) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(directoryPath);
    const matchedFile = files.find((file: string) =>
      file.startsWith(req.params.file.split('.')[0]),
    );

    if (!matchedFile) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(directoryPath, matchedFile);

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.get('/emojis/:file', async (req, res) => {
  try {
    const directoryPath = path.join(process.cwd(), 'www_dynamic', 'emojis');

    if (!fs.existsSync(directoryPath)) {
      return res.status(404).send('File not found');
    }

    const files = fs.readdirSync(directoryPath);
    const matchedFile = files.find((file: string) =>
      file.startsWith(req.params.file.split('.')[0]),
    );

    if (!matchedFile) {
      return res.status(404).send('File not found');
    }

    const filePath = path.join(directoryPath, matchedFile);

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.use('/assets', express.static(path.join(process.cwd(), 'www_static', 'assets')));

app.use('/assets', express.static(path.join(process.cwd(), 'www_dynamic', 'assets')));

app.use('/assets/:asset', assetsMiddleware);

if (global.config.serveDesktopClient) {
  const desktop = require('./api/desktop');

  app.use(desktop);
}

app.use(clientMiddleware);

app.get('/api/users/:userid/avatars/:file', async (req, res) => {
  try {
    const filePath = path.join(
      process.cwd(),
      'www_dynamic',
      'avatars',
      req.params.userid,
      req.params.file,
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }

    res.status(200).sendFile(filePath);
    return;
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

app.use('/api', apiVersionMiddleware, router);

app.get(
  '/.well-known/spacebar',
  (
    req: { protocol: any; get: (arg0: string) => any },
    res: { json: (arg0: { api: string }) => void },
  ) => {
    res.json({
      api: `${req.protocol}://${req.get('host')}/api`,
    });
  },
);

if (config.serve_selector) {
  app.get(
    '/selector',
    (
      req: { cookies: { release_date: any } },
      res: {
        cookie: (arg0: string, arg1: any, arg2: { maxAge: number }) => void;
        send: (arg0: any) => any;
      },
    ) => {
      res.cookie('default_client_build', config.default_client_build || 'october_5_2017', {
        maxAge: 100 * 365 * 24 * 60 * 60 * 1000,
      });

      if (!config.require_release_date_cookie && !req.cookies.release_date) {
        res.cookie('release_date', config.default_client_build || 'october_5_2017', {
          maxAge: 100 * 365 * 24 * 60 * 60 * 1000,
        });
      }

      return res.send(fs.readFileSync(`./www_static/assets/selector/index.html`, 'utf8'));
    },
  );
}

app.get(
  '/launch',
  (
    req: { query: { release_date: any } },
    res: {
      redirect: (arg0: string) => void;
      cookie: (arg0: string, arg1: any, arg2: { maxAge: number }) => void;
    },
  ) => {
    if (!req.query.release_date && config.require_release_date_cookie) {
      res.redirect('/selector');
      return;
    }

    if (!config.require_release_date_cookie && !req.query.release_date) {
      req.query.release_date = config.default_client_build || 'october_5_2017';
    }

    res.cookie('release_date', req.query.release_date, {
      maxAge: 100 * 365 * 24 * 60 * 60 * 1000,
    });

    res.cookie('default_client_build', config.default_client_build || 'october_5_2017', {
      maxAge: 100 * 365 * 24 * 60 * 60 * 1000,
    });

    res.redirect('/');
  },
);

app.get('/channels/:guildid/:channelid', (_: any, res: { redirect: (arg0: string) => any }) => {
  return res.redirect('/');
});

app.get(
  '/instance',
  (
    req: any,
    res: {
      json: (arg0: {
        instance: any;
        custom_invite_url: any;
        gateway: any;
        captcha_options: any;
        assets_cdn_url: any;
      }) => void;
    },
  ) => {
    const portAppend = globalUtils.nonStandardPort ? ':' + config.port : '';
    const base_url = config.base_url + portAppend;

    res.json({
      instance: config.instance,
      custom_invite_url:
        config.custom_invite_url == '' ? base_url + '/invite' : config.custom_invite_url,
      gateway: globalUtils.generateGatewayURL(req),
      captcha_options: config.captcha_config
        ? { ...config.captcha_config, secret_key: undefined }
        : {},
      assets_cdn_url: config.assets_cdn_url ?? 'https://cdn.oldcordapp.com',
    });
  },
);

app.get(/\/admin*/, (req: any, res: { send: (arg0: any) => any }) => {
  return res.send(fs.readFileSync(`./www_static/assets/admin/index.html`, 'utf8'));
});

app.get(/.*/, (req, res) => {
  try {
    if (!req.client_build && config.require_release_date_cookie) {
      res.redirect('/selector');
      return;
    }

    if (!config.require_release_date_cookie && !req.client_build) {
      req.client_build = config.default_client_build || 'october_5_2017';
    }

    if (
      !req.cookies.default_client_build ||
      req.cookies.default_client_build !== (config.default_client_build || 'october_5_2017')
    ) {
      res.cookie('default_client_build', config.default_client_build || 'october_5_2017', {
        maxAge: 100 * 365 * 24 * 60 * 60 * 1000,
      });
    }

    res.sendFile(path.join(process.cwd(), 'www_static/assets/bootloader/index.html'));
  } catch (error) {
    logText(error, 'error');

    res.redirect('/selector');
    return;
  }
});
