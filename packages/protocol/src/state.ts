import { z } from 'zod';
import { PlayerCharacterSchema, NPCSchema } from './characters.js';
import { AspectSchema } from './fate.js';
import { QuestSchema } from './quests.js';
import { FactionSchema } from './factions.js';

// Location in the world
export const LocationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  
  // Location aspects
  aspects: z.array(AspectSchema).default([]),
  
  // Connected locations
  connections: z.array(z.object({
    targetId: z.string(),
    direction: z.string().optional(),
    description: z.string().optional(),
    isBlocked: z.boolean().default(false),
    blockReason: z.string().optional(),
  })).default([]),
  
  // NPCs currently here
  presentNPCs: z.array(z.string()).default([]),
  
  // Items/objects of interest
  features: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    interactable: z.boolean().default(true),
    aspectId: z.string().optional(),
  })).default([]),
  
  // Is this location discovered by player?
  discovered: z.boolean().default(false),
  
  // Tier in world hierarchy
  tier: z.enum(['world', 'region', 'locale']),
  parentId: z.string().optional(),
});

export type Location = z.infer<typeof LocationSchema>;

// Active conflict (combat/challenge)
export const ConflictStateSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['physical', 'mental', 'social']),
  name: z.string(),
  
  // Scene aspects
  aspects: z.array(AspectSchema),
  
  // Participants
  participants: z.array(z.object({
    characterId: z.string(),
    side: z.enum(['player', 'opposition', 'neutral']),
    hasActed: z.boolean().default(false),
    hasConceded: z.boolean().default(false),
  })),
  
  // Turn order
  turnOrder: z.array(z.string()),
  currentTurnIndex: z.number().int().default(0),
  
  // Exchange tracking
  currentExchange: z.number().int().default(1),
  
  // Resolution
  isResolved: z.boolean().default(false),
  winner: z.enum(['player', 'opposition', 'draw']).optional(),
  resolution: z.string().optional(),
});

export type ConflictState = z.infer<typeof ConflictStateSchema>;

// Scene state
export const SceneStateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  
  // Where the scene takes place
  locationId: z.string(),
  
  // Scene aspects
  aspects: z.array(AspectSchema),
  
  // Active conflict if any
  conflict: ConflictStateSchema.optional(),
  
  // Scene metadata
  startTurn: z.number().int(),
  endTurn: z.number().int().optional(),
  
  // Scene type
  type: z.enum(['exploration', 'social', 'conflict', 'downtime']),
});

export type SceneState = z.infer<typeof SceneStateSchema>;

// World state - the "truth" of the game world
export const WorldStateSchema = z.object({
  // Theme information
  theme: z.object({
    name: z.string(),
    genre: z.string(),
    tone: z.string(),
    keywords: z.array(z.string()),
  }),
  
  // All locations
  locations: z.record(z.string(), LocationSchema),
  
  // Global world aspects
  aspects: z.array(AspectSchema),
  
  // Current in-game time
  time: z.object({
    value: z.string(), // Flexible format based on theme
    period: z.string().optional(), // "dawn", "night", etc.
  }),
  
  // Active plot threads
  plotThreads: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string(),
    status: z.enum(['active', 'paused', 'resolved']),
    priority: z.enum(['main', 'side', 'background']),
  })).default([]),

  // Active quests
  quests: z.array(QuestSchema).default([]),
  
  // Factions in the world
  factions: z.record(z.string(), FactionSchema).default({}),
  
  // World-level facts that have been established
  establishedFacts: z.record(z.string(), z.unknown()),
});

export type WorldState = z.infer<typeof WorldStateSchema>;

// Complete game state
export const GameStateSchema = z.object({
  // Unique session identifier
  sessionId: z.string().uuid(),
  
  // Current turn number
  turn: z.number().int().min(0),
  
  // World state
  world: WorldStateSchema,
  
  // Player character
  player: PlayerCharacterSchema,
  
  // All NPCs (indexed by ID)
  npcs: z.record(z.string(), NPCSchema),
  
  // Current scene
  currentScene: SceneStateSchema.optional(),
  
  // Session-level aspects (temporary)
  sessionAspects: z.array(AspectSchema).default([]),
  
  // Random seed for deterministic replay
  seed: z.number().int(),
});

export type GameState = z.infer<typeof GameStateSchema>;
