import { z } from 'zod';

export const SessionMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  
  // Theme info
  theme: z.object({
    name: z.string(),
    version: z.string(),
  }),
  
  // Player info
  player: z.object({
    name: z.string(),
    characterName: z.string(),
  }),
  
  // Progress
  currentTurn: z.number().int(),
  currentSceneId: z.string().uuid().optional(),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastPlayedAt: z.string().datetime(),
  
  // File info
  version: z.string(),
  files: z.object({
    worldState: z.string(),
    playerState: z.string(),
    turnsDir: z.string(),
    deltasDir: z.string(),
    snapshotsDir: z.string(),
    scenesDir: z.string(),
  }),
  
  // Stats
  stats: z.object({
    totalTurns: z.number().int(),
    totalDeltas: z.number().int(),
    totalSnapshots: z.number().int(),
    conflictsResolved: z.number().int(),
    npcsEncountered: z.number().int(),
  }),
});

export type SessionMetadata = z.infer<typeof SessionMetadataSchema>;
