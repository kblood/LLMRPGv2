import { z } from 'zod';
import { AspectSchema } from './fate.js';

export const ZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  aspects: z.array(AspectSchema).default([]),
  characterIds: z.array(z.string()).default([]), // Characters currently in this zone
});

export type Zone = z.infer<typeof ZoneSchema>;

export const ZoneConnectionSchema = z.object({
  fromZoneId: z.string(),
  toZoneId: z.string(),
  description: z.string().optional(),
  barrier: z.number().int().min(0).default(0), // Difficulty to move (0 = free)
  aspects: z.array(AspectSchema).default([]), // e.g., "Blocked by Rubble"
});

export type ZoneConnection = z.infer<typeof ZoneConnectionSchema>;

export const ZoneMapSchema = z.object({
  zones: z.array(ZoneSchema),
  connections: z.array(ZoneConnectionSchema),
});

export type ZoneMap = z.infer<typeof ZoneMapSchema>;

// Movement action result
export const MovementResultSchema = z.object({
  success: z.boolean(),
  fromZoneId: z.string(),
  toZoneId: z.string(),
  cost: z.number().int(), // Shifts/Action spent
  events: z.array(z.string()), // Narrative events
});

export type MovementResult = z.infer<typeof MovementResultSchema>;
