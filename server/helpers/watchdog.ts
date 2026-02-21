import { createHash } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { IncomingHttpHeaders } from 'http';

import errors from './consts/errors.js';
import globalUtils from './utils/globalutils.js';
import { logText } from './utils/logger.ts';

interface RateLimitEntry {
  count: number;
  timer: NodeJS.Timeout | null;
  sus_score: number;
  windowStart: number;
}

export interface WatchdogFingerprint {
  fingerprint: string | null;
  reason: string;
}

interface WatchdogConfig {
  ratelimit_config: {
    enabled: boolean;
    deep_mode: boolean;
  };
  trusted_users: string[];
}

declare module 'express-serve-static-core' {
  interface Request {
    fingerprint?: string;
    account?: {
      id: string;
      bot: boolean;
    };
    is_staff?: boolean;
  }
}

type TripCallback = (
  data: {
    sus_score: number;
    maxPerTimeFrame: number;
    timeFrame: number;
    path: string;
    method: string;
  },
  req: Request,
) => void;

const Watchdog = {
  numHeadersThreshold: 10,
  susScoreDecayTime: 24 * 60 * 60 * 1000, //to-do: add this to the config somewhere
  susScoreDecayStore: new Map<string, NodeJS.Timeout>(),
  rateLimitStore: new Map<string, RateLimitEntry>(),
  normalizeHeader: (name: string): string => {
    return name.toLowerCase().trim();
  },
  getFingerprint: (
    url: string,
    baseUrl: string,
    protocol: string,
    headers: IncomingHttpHeaders,
  ): WatchdogFingerprint => {
    if (Object.entries(headers).length < Watchdog.numHeadersThreshold) {
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
      const normalizedValue = (Array.isArray(value) ? value.join(',') : (value ?? '')).trim();

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
  middleware: (
    maxPerTimeFrame: number,
    timeFrame: number,
    sus_weight = 0.2,
    onTrip: ((data: any, req: Request) => void) | null = null,
  ) => {
    if (typeof maxPerTimeFrame !== 'number' || typeof timeFrame !== 'number') {
      throw new Error('Missing maxPerTimeFrame and timeFrame for initialization of the Watchdog.');
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      const config = (global as any).config as WatchdogConfig;
      if (!config.ratelimit_config.enabled || !config.ratelimit_config.deep_mode) {
        next();
        return;
      }

      const acc = req.account;
      const isStaff = req.is_staff;

      if (acc && (acc.bot || (acc.id && config.trusted_users.includes(acc.id)) || isStaff)) {
        next();
        return;
      }

      if (!req.fingerprint) {
        const protocol = req.headers['x-forwarded-proto']?.toString() ?? req.protocol;
        const fingerprint_outcome = Watchdog.getFingerprint(
          req.originalUrl,
          req.baseUrl,
          protocol,
          req.headers,
        );

        if (fingerprint_outcome.fingerprint === null) {
          logText(
            `Failed to fingerprint: ${req.ip ?? 'unknown'} (${fingerprint_outcome.reason}) - on ${req.method} ${req.originalUrl}`,
            'watchdog',
          );

          return res.status(429).json({
            ...errors.response_429.WATCHDOG_BLOCKED,
            retry_after: 999999999999,
            global: true,
          });
        }

        req.fingerprint = fingerprint_outcome.fingerprint;
      }

      const { fingerprint } = req;

      let entry = Watchdog.rateLimitStore.get(fingerprint);

      entry ??= { count: 0, timer: null, sus_score: 0, windowStart: Date.now() };

      entry.count++;

      if (entry.count > maxPerTimeFrame) {
        entry.sus_score += sus_weight;

        Watchdog.setSusScoreDecay(fingerprint);

        const timeRemaining = entry.windowStart + timeFrame - Date.now();
        let retryAfterSeconds = Math.max(0, Math.ceil(timeRemaining / 1000));

        logText(
          `Fingerprint: ${fingerprint} exceeded ${String(maxPerTimeFrame)} reqs in ${String(timeFrame)}ms on ${req.method} ${req.originalUrl} from IP: ${String(req.ip)}`,
          'watchdog',
        );

        if (onTrip) {
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
            `Fingerprint: ${fingerprint} is scoring high on ${req.method} ${req.originalUrl}. Blocking them from proceeding for ~${String(block / 1000)} seconds.`,
            'watchdog',
          );

          await new Promise((resolve) => setTimeout(resolve, block));

          next();
          return;
        }
      }

      if (entry.timer === null) {
        entry.timer = setTimeout(() => {
          logText(
            `Resetting count for ${fingerprint}. Sus score: ${String(entry.sus_score)}`,
            'watchdog',
          );

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

      next();
    };
  },
  setSusScoreDecay: (fingerprint: string) => {
    const existingTimer = Watchdog.susScoreDecayStore.get(fingerprint);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const decayTimer = setTimeout(() => {
      logText(
        `Clearing sus_score and entry for ${fingerprint} after ${String(Watchdog.susScoreDecayTime)}ms.`,
        'watchdog',
      );

      Watchdog.rateLimitStore.delete(fingerprint);
      Watchdog.susScoreDecayStore.delete(fingerprint);
    }, Watchdog.susScoreDecayTime);

    decayTimer.unref();

    Watchdog.susScoreDecayStore.set(fingerprint, decayTimer);
  },
};

export const numHeadersThreshold = Watchdog.numHeadersThreshold;
export const susScoreDecayTime = Watchdog.susScoreDecayTime;
export const susScoreDecayStore = Watchdog.susScoreDecayStore;
export const rateLimitStore = Watchdog.rateLimitStore;
export const normalizeHeader = (name: string) => Watchdog.normalizeHeader(name);
export const getFingerprint = (u: string, b: string, p: string, h: IncomingHttpHeaders) =>
  Watchdog.getFingerprint(u, b, p, h);
export const getRandomRange = (min: number, max: number) => Watchdog.getRandomRange(min, max);
export const middleware = (max: number, t: number, w?: number, trip?: TripCallback | null) =>
  Watchdog.middleware(max, t, w, trip);
export const setSusScoreDecay = (f: string) => {
  Watchdog.setSusScoreDecay(f);
};

export default Watchdog;
