import { createHash } from 'crypto';

import errors from './consts/errors.js';
import globalUtils from './utils/globalutils.js';
import { logText } from './utils/logger.ts';
import type { IncomingHttpHeaders } from 'http';
import type { NextFunction, Request, Response } from 'express';

export interface WatchdogFingerprint {
  fingerprint: string | null,
  reason: string
}

const Watchdog = {
  numHeadersThreshold: 10,
  susScoreDecayTime: 24 * 60 * 60 * 1000, //to-do: add this to the config somewhere
  susScoreDecayStore: new Map(),
  rateLimitStore: new Map(),
  normalizeHeader: (name: string): string => {
    return name.toLowerCase().trim();
  },
  getFingerprint: (url: string, baseUrl: string, protocol: string, headers: IncomingHttpHeaders): WatchdogFingerprint => {
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

    const xSuperProps = headers['x-super-properties'];
    const userAgent = headers['user-agent'];

    if (!userAgent) {
      return {
        fingerprint: null,
        reason: "The client didn't send a user-agent",
      };
    }

    if (xSuperProps) {
      const outcome = globalUtils.validSuperPropertiesObject(xSuperProps, url, baseUrl, userAgent);

      if (!outcome) {
        return {
          fingerprint: null,
          reason: 'Invalid X-Super-Properties Object',
        };
      }
    }

    const relevantHeaders = [
      'user-agent',
      'accept',
      'accept-encoding',
      'accept-language',
      'sec-fetch-dest',
      'sec-fetch-mode',
      'x-super-properties',
    ];

    const presentHeaders = Object.keys(headers)
      .map(Watchdog.normalizeHeader)
      .filter((name) => relevantHeaders.includes(name))
      .sort();
    let to_fingerprint = `ORDER=${presentHeaders.join(',')};`;

    for (const name of presentHeaders) {
      const value = headers[name];
      const normalizedValue = (Array.isArray(value) ? value.join(',') : value || '').trim();

      if (['user-agent', 'accept', 'accept-language', 'x-super-properties'].includes(name)) {
        to_fingerprint += `${name}=${normalizedValue};`;
      }
    }

    to_fingerprint += `PROTOCOL=${protocol};`;

    const hash = createHash('sha256').update(to_fingerprint).digest('hex');

    return {
      fingerprint: hash,
      reason: '',
    }; //to-do: something with the account & ja3 hash, tcp/ip stack if provided (would require your own certificate & possibly kernel driver for Linux systems, unsure about Windows - could use something like node pcap?)
  },
  getRandomRange(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  middleware: (maxPerTimeFrame: number, timeFrame: number, sus_weight: number = 0.2, onTrip: Function | null = null) => {
    if (typeof maxPerTimeFrame !== 'number' || typeof timeFrame !== 'number') {
      throw new Error('Missing maxPerTimeFrame and timeFrame for initialization of the Watchdog.');
    }

    return async function (req: Request, res: Response, next: NextFunction) {
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
        const fingerprint_outcome = Watchdog.getFingerprint(
          req.originalUrl,
          req.baseUrl,
          req.headers['x-forwarded-proto']?.toString() || req.protocol,
          req.headers,
        );
        const fingerprint = fingerprint_outcome.fingerprint;

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

      const { fingerprint } = req;

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

        const timeRemaining = entry.windowStart + timeFrame - Date.now();
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
          const block = Watchdog.getRandomRange(600, 10000);

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

          const existingEntry = Watchdog.rateLimitStore.get(fingerprint);

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
  setSusScoreDecay: (fingerprint: string) => {
    const existingTimer = Watchdog.susScoreDecayStore.get(fingerprint);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const decayTimer = setTimeout(() => {
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

export const {
  numHeadersThreshold,
  susScoreDecayTime,
  susScoreDecayStore,
  rateLimitStore,
  normalizeHeader,
  getFingerprint,
  getRandomRange,
  middleware,
  setSusScoreDecay,
} = Watchdog;

export default Watchdog;
