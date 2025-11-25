import { z } from 'zod';
import { FateActionSchema } from './fate.js';

// Base command with metadata
const BaseCommandSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  sessionId: z.string().uuid(),
});

// Player takes a Fate action
export const PlayerActionCommandSchema = BaseCommandSchema.extend({
  type: z.literal('PLAYER_ACTION'),
  action: FateActionSchema,
  skill: z.string(),
  target: z.string().optional(),       // Target of action
  description: z.string(),              // Player's narrative description
  createAspect: z.string().optional(), // For Create Advantage
});

// Player invokes an aspect
export const InvokeAspectCommandSchema = BaseCommandSchema.extend({
  type: z.literal('INVOKE_ASPECT'),
  aspectId: z.string().uuid(),
  reroll: z.boolean().default(false), // Reroll vs +2
  actionId: z.string().uuid(),        // Which action this applies to
});

// Player compels an aspect (on NPC or self)
export const CompelAspectCommandSchema = BaseCommandSchema.extend({
  type: z.literal('COMPEL_ASPECT'),
  aspectId: z.string().uuid(),
  targetCharacterId: z.string().uuid(),
  suggestion: z.string(), // What complication the player suggests
});

// Player concedes a conflict
export const ConcedeCommandSchema = BaseCommandSchema.extend({
  type: z.literal('CONCEDE'),
  conflictId: z.string().uuid(),
  terms: z.string().optional(), // What the player wants from conceding
});

// Player speaks/roleplays
export const DialogueCommandSchema = BaseCommandSchema.extend({
  type: z.literal('DIALOGUE'),
  speech: z.string(),
  target: z.string().optional(), // Who they're speaking to
  tone: z.string().optional(),   // How they're saying it
});

// Player examines/investigates
export const ExamineCommandSchema = BaseCommandSchema.extend({
  type: z.literal('EXAMINE'),
  target: z.string(),         // What to examine
  detail: z.string().optional(), // Specific aspect to focus on
});

// Player moves to a new location
export const MoveCommandSchema = BaseCommandSchema.extend({
  type: z.literal('MOVE'),
  destination: z.string(),
  method: z.string().optional(), // How they're moving
});

// Player uses an item
export const UseItemCommandSchema = BaseCommandSchema.extend({
  type: z.literal('USE_ITEM'),
  itemId: z.string().uuid(),
  target: z.string().optional(),
  method: z.string().optional(),
});

// Player requests specific information
export const QueryCommandSchema = BaseCommandSchema.extend({
  type: z.literal('QUERY'),
  query: z.string(),
  context: z.string().optional(),
});

// Free-form player input (fallback)
export const FreeInputCommandSchema = BaseCommandSchema.extend({
  type: z.literal('FREE_INPUT'),
  input: z.string(),
});

// System commands
export const SystemCommandSchema = BaseCommandSchema.extend({
  type: z.literal('SYSTEM'),
  action: z.enum([
    'save',
    'load',
    'quit',
    'help',
    'status',
    'inventory',
    'character',
    'relationships',
    'history',
  ]),
  params: z.record(z.string(), z.unknown()).optional(),
});

// Union of all commands
export const PlayerCommandSchema = z.discriminatedUnion('type', [
  PlayerActionCommandSchema,
  InvokeAspectCommandSchema,
  CompelAspectCommandSchema,
  ConcedeCommandSchema,
  DialogueCommandSchema,
  ExamineCommandSchema,
  MoveCommandSchema,
  UseItemCommandSchema,
  QueryCommandSchema,
  FreeInputCommandSchema,
  SystemCommandSchema,
]);

export type PlayerCommand = z.infer<typeof PlayerCommandSchema>;
export type PlayerActionCommand = z.infer<typeof PlayerActionCommandSchema>;
export type InvokeAspectCommand = z.infer<typeof InvokeAspectCommandSchema>;
export type DialogueCommand = z.infer<typeof DialogueCommandSchema>;
// ... etc
