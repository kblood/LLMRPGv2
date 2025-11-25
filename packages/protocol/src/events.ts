import { z } from 'zod';
import {
  FateDiceRollSchema,
  ActionOutcomeSchema,
  AspectSchema,
  ConsequenceSchema,
} from './fate.js';
import { DeltaSchema } from './delta.js';

// Base event
const BaseEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  turn: z.number().int(),
  sessionId: z.string().uuid(),
});

// Narrative text from GM
export const NarrativeEventSchema = BaseEventSchema.extend({
  type: z.literal('NARRATIVE'),
  text: z.string(),
  speaker: z.string().optional(),  // If it's dialogue
  mood: z.string().optional(),     // Tone/atmosphere
});

// Turn started
export const TurnStartEventSchema = BaseEventSchema.extend({
  type: z.literal('TURN_START'),
  turn: z.number().int(),
  activeCharacter: z.string(),
  sceneContext: z.string(), // Brief scene reminder
});

// Turn ended
export const TurnEndEventSchema = BaseEventSchema.extend({
  type: z.literal('TURN_END'),
  turn: z.number().int(),
  summary: z.string(),
});

// Dice were rolled
export const DiceRolledEventSchema = BaseEventSchema.extend({
  type: z.literal('DICE_ROLLED'),
  roll: FateDiceRollSchema,
  skill: z.string(),
  skillRank: z.number().int(),
  modifiers: z.array(z.object({
    source: z.string(),
    value: z.number().int(),
  })).default([]),
  total: z.number().int(),
  difficulty: z.number().int(),
  difficultyName: z.string(),
  shifts: z.number().int(),
  outcome: ActionOutcomeSchema,
});

// Aspect created
export const AspectCreatedEventSchema = BaseEventSchema.extend({
  type: z.literal('ASPECT_CREATED'),
  aspect: AspectSchema,
  creator: z.string(),
  target: z.string(), // Where the aspect is attached
});

// Aspect invoked
export const AspectInvokedEventSchema = BaseEventSchema.extend({
  type: z.literal('ASPECT_INVOKED'),
  aspectId: z.string().uuid(),
  aspectName: z.string(),
  invoker: z.string(),
  effect: z.enum(['+2', 'reroll']),
  fatePointSpent: z.boolean(),
});

// Aspect compelled
export const AspectCompelledEventSchema = BaseEventSchema.extend({
  type: z.literal('ASPECT_COMPELLED'),
  aspectId: z.string().uuid(),
  aspectName: z.string(),
  target: z.string(),
  complication: z.string(),
  accepted: z.boolean(),
  fatePointAwarded: z.boolean(),
});

// Stress taken
export const StressTakenEventSchema = BaseEventSchema.extend({
  type: z.literal('STRESS_TAKEN'),
  characterId: z.string(),
  characterName: z.string(),
  trackType: z.enum(['physical', 'mental']),
  boxes: z.number().int(),
  remainingBoxes: z.number().int(),
});

// Consequence taken
export const ConsequenceTakenEventSchema = BaseEventSchema.extend({
  type: z.literal('CONSEQUENCE_TAKEN'),
  characterId: z.string(),
  characterName: z.string(),
  consequence: ConsequenceSchema,
  shiftsAbsorbed: z.number().int(),
});

// Character defeated (taken out)
export const CharacterDefeatedEventSchema = BaseEventSchema.extend({
  type: z.literal('CHARACTER_DEFEATED'),
  characterId: z.string(),
  characterName: z.string(),
  method: z.enum(['taken_out', 'conceded']),
  victor: z.string().optional(),
  narrativeResult: z.string(),
});

// Conflict started
export const ConflictStartedEventSchema = BaseEventSchema.extend({
  type: z.literal('CONFLICT_STARTED'),
  conflictId: z.string().uuid(),
  conflictType: z.enum(['physical', 'mental', 'social']),
  participants: z.array(z.string()),
  sceneAspects: z.array(z.string()),
});

// Conflict ended
export const ConflictEndedEventSchema = BaseEventSchema.extend({
  type: z.literal('CONFLICT_ENDED'),
  conflictId: z.string().uuid(),
  winner: z.enum(['player', 'opposition', 'draw']),
  resolution: z.string(),
});

// Scene changed
export const SceneChangedEventSchema = BaseEventSchema.extend({
  type: z.literal('SCENE_CHANGED'),
  previousSceneId: z.string().uuid().optional(),
  newSceneId: z.string().uuid(),
  sceneName: z.string(),
  locationId: z.string(),
  locationName: z.string(),
  description: z.string(),
});

// NPC appeared
export const NPCAppearedEventSchema = BaseEventSchema.extend({
  type: z.literal('NPC_APPEARED'),
  npcId: z.string(),
  npcName: z.string(),
  introduction: z.string(),
  attitude: z.string().optional(),
});

// State delta occurred
export const StateDeltaEventSchema = BaseEventSchema.extend({
  type: z.literal('STATE_DELTA'),
  delta: DeltaSchema,
});

// Fate point changed
export const FatePointEventSchema = BaseEventSchema.extend({
  type: z.literal('FATE_POINT'),
  characterId: z.string(),
  characterName: z.string(),
  change: z.number().int(), // +1 or -1
  reason: z.string(),
  newTotal: z.number().int(),
});

// Error/warning from system
export const SystemMessageEventSchema = BaseEventSchema.extend({
  type: z.literal('SYSTEM_MESSAGE'),
  level: z.enum(['info', 'warning', 'error']),
  message: z.string(),
  details: z.unknown().optional(),
});

// Union of all events
export const GameEventSchema = z.discriminatedUnion('type', [
  NarrativeEventSchema,
  TurnStartEventSchema,
  TurnEndEventSchema,
  DiceRolledEventSchema,
  AspectCreatedEventSchema,
  AspectInvokedEventSchema,
  AspectCompelledEventSchema,
  StressTakenEventSchema,
  ConsequenceTakenEventSchema,
  CharacterDefeatedEventSchema,
  ConflictStartedEventSchema,
  ConflictEndedEventSchema,
  SceneChangedEventSchema,
  NPCAppearedEventSchema,
  StateDeltaEventSchema,
  FatePointEventSchema,
  SystemMessageEventSchema,
]);

export type GameEvent = z.infer<typeof GameEventSchema>;
export type NarrativeEvent = z.infer<typeof NarrativeEventSchema>;
export type DiceRolledEvent = z.infer<typeof DiceRolledEventSchema>;
// ... etc
