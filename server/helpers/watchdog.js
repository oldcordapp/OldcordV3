const crypto = require('crypto');
const { logText } = require('./logger');
const globalUtils = require('./globalutils');
const errors = require('./errors');

const Watchdog = {
  numHeadersThreshold: 10,
  susScoreDecayTime: 24 * 60 * 60 * 1000, //to-do: add this to the config somewhere
  susScoreDecayStore: new Map(),
  rateLimitStore: new Map(),
  normalizeHeader: (name) => {
    return name.toLowerCase().trim();
  },
  getFingerprint: (url, baseUrl, protocol, headers, account = null, ja3hash = null) => {
    if (
      typeof headers !== 'object' ||
      headers === null ||
      Object.entries(headers).length < Watchdog.numHeadersThreshold
    ) {
      return {
        fingerprint: null,
        reason: "The client didn't reach the number of headers threshold",
      };
    }

    let xSuperProps = headers['x-super-properties'];
    let userAgent = headers['user-agent'];

    if (!userAgent) {
      return {
        fingerprint: null,
        reason: "The client didn't send a user-agent",
      };
    }

    if (xSuperProps) {
      let outcome = globalUtils.validSuperPropertiesObject(xSuperProps, url, baseUrl, userAgent);

      if (!outcome) {
        return {
          fingeprint: null,
          reason: 'Invalid X-Super-Properties Object',
        };
      }
    }

    let relevantHeaders = [
      'user-agent',
      'accept',
      'accept-encoding',
      'accept-language',
      'sec-fetch-dest',
      'sec-fetch-mode',
      'x-super-properties',
    ];

    let presentHeaders = Object.keys(headers)
      .map(Watchdog.normalizeHeader)
      .filter((name) => relevantHeaders.includes(name))
      .sort();
    let to_fingerprint = `ORDER=${presentHeaders.join(',')};`;

    for (let name of presentHeaders) {
      let value = headers[name];
      let normalizedValue = (Array.isArray(value) ? value.join(',') : value || '').trim();

      if (['user-agent', 'accept', 'accept-language', 'x-super-properties'].includes(name)) {
        to_fingerprint += `${name}=${normalizedValue};`;
      }
    }

    to_fingerprint += `PROTOCOL=${protocol};`;

    let hash = crypto.createHash('sha256').update(to_fingerprint).digest('hex');

    return {
      fingerprint: hash,
      reason: '',
    }; //to-do: something with the account & ja3 hash, tcp/ip stack if provided (would require your own certificate & possibly kernel driver for Linux systems, unsure about Windows - could use something like node pcap?)
  },
  getRandomRange(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  middleware: (maxPerTimeFrame, timeFrame, sus_weight = 0.2, onTrip = null) => {
    if (typeof maxPerTimeFrame !== 'number' || typeof timeFrame !== 'number') {
      throw new Error('Missing maxPerTimeFrame and timeFrame for initialization of the Watchdog.');
    }

    return async function (req, res, next) {
      if (!global.config.ratelimit_config.enabled) {
        return next();
      }

      if (!global.config.ratelimit_config.deep_mode) {
        return next();
      }

      if (
        req.account &&
        (req.account.bot || global.config.trusted_users.includes(req.account.id) || req.is_staff)
      ) {
        return next();
      }

      if (!req.fingerprint) {
        let fingerprint_outcome = Watchdog.getFingerprint(
          req.originalUrl,
          req.baseUrl,
          req.headers['x-forwarded-proto'] || req.protocol,
          req.headers,
          req.account,
          null,
        );
        let fingerprint = fingerprint_outcome.fingerprint;

        if (fingerprint === null) {
          logText(
            `Failed to fingerprint: ${req.ip} (${fingerprint_outcome.reason}) - auto blocking them for security of the instance.`,
            'watchdog',
          );

          return res.status(429).json({
            ...errors.response_429.WATCHDOG_BLOCKED,
            retry_after: 999999999999,
            global: true,
          });
        }

        req.fingerprint = fingerprint;
      }

      let { fingerprint } = req;

      if (!fingerprint) {
        return res.status(429).json({
          ...errors.response_429.WATCHDOG_BLOCKED,
          retry_after: 999999999999,
          global: true,
        });
      }

      let entry = Watchdog.rateLimitStore.get(fingerprint);

      if (!entry) {
        entry = { count: 0, timer: null, sus_score: 0, windowStart: Date.now() };
      }

      entry.count++;

      if (entry.count > maxPerTimeFrame) {
        entry.sus_score += sus_weight;

        Watchdog.setSusScoreDecay(fingerprint);

        let timeRemaining = entry.windowStart + timeFrame - Date.now();
        let retryAfterSeconds = Math.max(0, Math.ceil(timeRemaining / 1000));

        logText(
          `Fingerprint: ${fingerprint} exceeded ${maxPerTimeFrame} reqs in ${timeFrame}ms from IP: ${req.ip}`,
          'watchdog',
        );

        if (onTrip !== null) {
          onTrip(
            {
              sus_score: entry.sus_score,
              maxPerTimeFrame,
              timeFrame,
              path: req.path,
              method: req.method,
            },
            req,
          );
        }

        if (entry.sus_score > 7) {
          res.setHeader('Retry-After-WD', retryAfterSeconds);

          return res.status(429).json({
            ...errors.response_429.RATE_LIMITED,
            retry_after: timeRemaining,
            global: true,
          });
        } else if (entry.sus_score > 3) {
          retryAfterSeconds = Math.min(retryAfterSeconds, 30);

          return res.status(429).json({
            ...errors.response_429.RESOURCE_RATE_LIMITED,
            retry_after: retryAfterSeconds * 1000,
            global: true,
          });
        } else {
          let block = Watchdog.getRandomRange(600, 10000);

          logText(
            `Fingerprint: ${fingerprint} is scoring high. Blocking them from proceeding for ~${block / 1000} seconds.`,
            'watchdog',
          );

          await new Promise((resolve) => setTimeout(resolve, block));

          return next();
        }
      }

      if (entry.timer === null) {
        entry.timer = setTimeout(() => {
          logText(`Resetting count for ${fingerprint}. Sus score: ${entry.sus_score}`, 'watchdog');

          let existingEntry = Watchdog.rateLimitStore.get(fingerprint);

          if (existingEntry) {
            existingEntry.count = 0;
            existingEntry.timer = null;
            existingEntry.windowStart = Date.now();
          }
        }, timeFrame);

        entry.timer.unref();
      }

      if (entry.sus_score > 0) {
        Watchdog.setSusScoreDecay(fingerprint);
      }

      Watchdog.rateLimitStore.set(fingerprint, entry);

      res.setHeader('X-RateLimit-Limit-WD', maxPerTimeFrame);
      res.setHeader('X-RateLimit-Remaining-WD', maxPerTimeFrame - entry.count);
      res.setHeader('X-RateLimit-Reset-WD', Math.floor((entry.windowStart + timeFrame) / 1000));

      return next();
    };
  },
  setSusScoreDecay: (fingerprint) => {
    let existingTimer = Watchdog.susScoreDecayStore.get(fingerprint);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    let decayTimer = setTimeout(() => {
      logText(
        `Clearing sus_score and entry for ${fingerprint} after ${Watchdog.susScoreDecayTime}ms.`,
        'watchdog',
      );

      Watchdog.rateLimitStore.delete(fingerprint);
      Watchdog.susScoreDecayStore.delete(fingerprint);
    }, Watchdog.susScoreDecayTime);

    decayTimer.unref();

    Watchdog.susScoreDecayStore.set(fingerprint, decayTimer);
  },
};

module.exports = Watchdog;
