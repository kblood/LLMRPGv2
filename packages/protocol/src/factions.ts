import { z } from 'zod';
import { AspectSchema } from './fate.js';

export const FactionRankSchema = z.enum([
  'hostile',
  'unfriendly',
  'neutral',
  'friendly',
  'allied'
]);

export type FactionRank = z.infer<typeof FactionRankSchema>;

export const FactionResourceSchema = z.object({
  type: z.string(), // e.g., "wealth", "influence", "military", "magic"
  level: z.number().int().min(0).max(5), // 0-5 scale
});

export type FactionResource = z.infer<typeof FactionResourceSchema>;

export const FactionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  
  // Fate aspects defining the faction
  aspects: z.array(AspectSchema).default([]),
  
  // Faction goals (short and long term)
  goals: z.array(z.string()).default([]),
  
  // Member NPC IDs
  members: z.array(z.string()).default([]),
  
  // Relationships with other entities (Faction IDs or Player ID)
  // Value from -100 to 100
  relationships: z.record(z.string(), z.number().int()).default({}),
  
  // Controlled locations
  territory: z.array(z.string()).default([]),
  
  // Resources/Assets
  resources: z.array(FactionResourceSchema).default([]),
  
  // Hidden/Secret status
  isHidden: z.boolean().default(false),
});

export type Faction = z.infer<typeof FactionSchema>;

// Helper to convert numerical reputation to rank
export function getFactionRank(reputation: number): FactionRank {
  if (reputation <= -50) return 'hostile';
  if (reputation <= -10) return 'unfriendly';
  if (reputation < 10) return 'neutral';
  if (reputation < 50) return 'friendly';
  return 'allied';
}
