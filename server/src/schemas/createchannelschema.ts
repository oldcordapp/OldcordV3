import { z } from 'zod';

export const CreateChannelSchema = z.object({
    name: z.string().min(1).max(100),
    type: z.number().int().min(0).max(15),
    topic: z.string().optional(),
    parent_id: z.string().nullable().optional(),
    nsfw: z.boolean().default(false)
});

export type CreateChannelPayload = z.infer<typeof CreateChannelSchema>;