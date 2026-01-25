import * as z from 'zod';

// TODO: Add in all payloads

const heartbeatPayload = z.object({
  op: z.literal(1),
  d: z.number().nullable(),
  s: z.int().nullish(),
  t: z.string().nullish(),
});

const identifyPayload = z.object({
  op: z.literal(2),
  d: z.object({
    token: z.string(),
    properties: z.object({
      os: z.string(),
      browser: z.string(),
      device: z.string(),
    }),
    compress: z.boolean().optional(),
    large_threshold: z.number().min(50).max(250).optional(),
    shard: z.tuple([z.number(), z.number()]).optional(),
    intents: z.number().nullish(),
    presence: z.looseObject({}).optional(),
  }),
  s: z.int().nullish(),
  t: z.string().nullish(),
});

const resumePayload = z.object({
  op: z.literal(6),
  d: z.object({
    token: z.string(),
    session_id: z.string(),
    seq: z.number(),
  }),
  s: z.int().nullish(),
  t: z.string().nullish(),
});

const heartbeatInfoPayload = z.object({
  op: z.literal(10),
  d: z.object({
    heartbeat_interval: z.int(),
    _trace: z.array(z.string()),
  }),
  s: z.int().nullish(),
  t: z.string().nullish(),
});

export const GatewayPayloadSchema = z
  .discriminatedUnion('op', [
    heartbeatPayload,
    identifyPayload,
    resumePayload,
    heartbeatInfoPayload,
  ])
  .catch((ctx) => {
    return ctx.value as any;
  });

export type GatewayPayload = z.infer<typeof GatewayPayloadSchema>;
