# Protocol Package Deep Dive

> The foundation layer: shared types, schemas, and message definitions

## Overview

The `@llmrpg/protocol` package contains **all shared types** used across the system. This is the **only package** that both frontend and backend depend on, making it the contract between them.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  Protocol   │◀────│   Backend   │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
              ┌───────────┴───────────┐
              │   Zod Schemas         │
              │   - Runtime validation│
              │   - Type inference    │
              └───────────────────────┘
```

---

## File Structure

```
packages/protocol/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Public exports
│   ├── messages.ts           # Command/Event discriminated unions
│   ├── commands.ts           # Player → Server commands
│   ├── events.ts             # Server → Client events
│   ├── state.ts              # Game state schemas
│   ├── characters.ts         # Character definitions
│   ├── fate.ts               # Fate Core mechanics
│   ├── delta.ts              # Delta operations
│   └── session.ts            # Session metadata
└── tests/
    ├── messages.test.ts
    └── state.test.ts
```

---

## Implementation

### src/fate.ts - Fate Core Types

```typescript
import { z } from 'zod';

// Fate Dice: 4dF where each die is -1, 0, or 1
export const FateDieSchema = z.number().int().min(-1).max(1);

export const FateDiceRollSchema = z.object({
  dice: z.array(FateDieSchema).length(4),
  total: z.number().int().min(-4).max(4),
});

export type FateDiceRoll = z.infer<typeof FateDiceRollSchema>;

// The Ladder - difficulty/result scale
export const LadderValueSchema = z.number().int().min(-2).max(8);

export const LadderNameSchema = z.enum([
  'Terrible',    // -2
  'Poor',        // -1
  'Mediocre',    // 0
  'Average',     // 1
  'Fair',        // 2
  'Good',        // 3
  'Great',       // 4
  'Superb',      // 5
  'Fantastic',   // 6
  'Epic',        // 7
  'Legendary',   // 8
]);

export type LadderName = z.infer<typeof LadderNameSchema>;

export const LADDER_MAP: Record<number, LadderName> = {
  [-2]: 'Terrible',
  [-1]: 'Poor',
  [0]: 'Mediocre',
  [1]: 'Average',
  [2]: 'Fair',
  [3]: 'Good',
  [4]: 'Great',
  [5]: 'Superb',
  [6]: 'Fantastic',
  [7]: 'Epic',
  [8]: 'Legendary',
};

// Four Actions
export const FateActionSchema = z.enum([
  'overcome',
  'create_advantage',
  'attack',
  'defend',
]);

export type FateAction = z.infer<typeof FateActionSchema>;

// Action Outcomes
export const ActionOutcomeSchema = z.enum([
  'fail',              // < difficulty
  'tie',               // == difficulty
  'success',           // 1-2 shifts above
  'success_with_style', // 3+ shifts above
]);

export type ActionOutcome = z.infer<typeof ActionOutcomeSchema>;

// Shifts (degree of success/failure)
export const ShiftsSchema = z.number().int();

// Skills - customizable per theme
export const SkillSchema = z.object({
  name: z.string(),
  rank: LadderValueSchema,
});

export type Skill = z.infer<typeof SkillSchema>;

// Default Fate Core skills
export const DEFAULT_SKILLS = [
  'Athletics', 'Burglary', 'Contacts', 'Crafts', 'Deceive',
  'Drive', 'Empathy', 'Fight', 'Investigate', 'Lore',
  'Notice', 'Physique', 'Provoke', 'Rapport', 'Resources',
  'Shoot', 'Stealth', 'Will',
] as const;

// Aspects
export const AspectTypeSchema = z.enum([
  'high_concept',   // Core character identity
  'trouble',        // Personal struggle/complication
  'relationship',   // Connection to another character
  'background',     // Past experience
  'situational',    // Temporary/scene aspect
  'boost',          // Free invoke, disappears after use
]);

export type AspectType = z.infer<typeof AspectTypeSchema>;

export const AspectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: AspectTypeSchema,
  freeInvokes: z.number().int().min(0).default(0),
  description: z.string().optional(),
  source: z.string().optional(), // Who/what created this aspect
});

export type Aspect = z.infer<typeof AspectSchema>;

// Stress Tracks
export const StressTrackSchema = z.object({
  type: z.enum(['physical', 'mental']),
  boxes: z.array(z.boolean()), // true = checked
  capacity: z.number().int().min(2).max(4),
});

export type StressTrack = z.infer<typeof StressTrackSchema>;

// Consequences
export const ConsequenceSeveritySchema = z.enum([
  'mild',      // -2 shift
  'moderate',  // -4 shift
  'severe',    // -6 shift
  'extreme',   // -8 shift (replaces aspect permanently)
]);

export type ConsequenceSeverity = z.infer<typeof ConsequenceSeveritySchema>;

export const ConsequenceSchema = z.object({
  id: z.string().uuid(),
  severity: ConsequenceSeveritySchema,
  name: z.string(), // The consequence aspect
  recovering: z.boolean().default(false),
  recoveryStartTurn: z.number().int().optional(),
});

export type Consequence = z.infer<typeof ConsequenceSchema>;

export const CONSEQUENCE_SHIFT_ABSORB: Record<ConsequenceSeverity, number> = {
  mild: 2,
  moderate: 4,
  severe: 6,
  extreme: 8,
};

// Stunts
export const StuntSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  skill: z.string().optional(),      // Associated skill
  bonus: z.number().int().optional(), // +2 in specific circumstance
  effect: z.string().optional(),      // Special rule text
});

export type Stunt = z.infer<typeof StuntSchema>;

// Fate Points
export const FatePointsSchema = z.object({
  current: z.number().int().min(0),
  refresh: z.number().int().min(1).default(3),
});

export type FatePoints = z.infer<typeof FatePointsSchema>;

// Complete Action Resolution
export const ActionResolutionSchema = z.object({
  action: FateActionSchema,
  skill: z.string(),
  skillRank: LadderValueSchema,
  roll: FateDiceRollSchema,
  difficulty: LadderValueSchema,
  invokes: z.array(z.object({
    aspectId: z.string().uuid(),
    bonus: z.number().int(), // +2 or reroll
    fatePointSpent: z.boolean(),
  })).default([]),
  opposingRoll: FateDiceRollSchema.optional(), // For opposed actions
  totalResult: z.number().int(),
  shifts: ShiftsSchema,
  outcome: ActionOutcomeSchema,
});

export type ActionResolution = z.infer<typeof ActionResolutionSchema>;
```

### src/characters.ts - Character Definitions

```typescript
import { z } from 'zod';
import {
  AspectSchema,
  SkillSchema,
  StuntSchema,
  StressTrackSchema,
  ConsequenceSchema,
  FatePointsSchema,
} from './fate.js';

// Personality Definition (for LLM context)
export const PersonalitySchema = z.object({
  // Core traits (Big Five inspired but narrative-focused)
  traits: z.array(z.string()).min(2).max(5),
  
  // What they value most
  values: z.array(z.string()).min(1).max(3),
  
  // Behavioral quirks
  quirks: z.array(z.string()).max(3).default([]),
  
  // What they fear
  fears: z.array(z.string()).max(2).default([]),
  
  // What they desire
  desires: z.array(z.string()).min(1).max(2),
});

export type Personality = z.infer<typeof PersonalitySchema>;

// Backstory Structure
export const BackstorySchema = z.object({
  // Where they come from
  origin: z.string(),
  
  // Key life event that shaped them
  formativeEvent: z.string(),
  
  // Something they keep hidden
  secret: z.string().optional(),
  
  // Short summary for context
  summary: z.string().max(500),
});

export type Backstory = z.infer<typeof BackstorySchema>;

// Voice/Speech Patterns (for consistent LLM dialogue)
export const VoiceSchema = z.object({
  // How they speak
  speechPattern: z.string(), // e.g., "formal and precise", "casual with slang"
  
  // Words they favor
  vocabulary: z.enum(['simple', 'moderate', 'sophisticated', 'archaic']),
  
  // Signature phrases
  phrases: z.array(z.string()).max(3).default([]),
  
  // Speech quirks
  quirks: z.array(z.string()).max(2).default([]), // e.g., "clears throat when nervous"
});

export type Voice = z.infer<typeof VoiceSchema>;

// Knowledge - what the character knows
export const KnowledgeSchema = z.object({
  // Facts they know (path → truth)
  facts: z.record(z.string(), z.unknown()),
  
  // Beliefs that may or may not be true
  beliefs: z.record(z.string(), z.unknown()),
  
  // Secrets they know about others
  secrets: z.array(z.object({
    subject: z.string(), // Who the secret is about
    content: z.string(),
    source: z.string(),  // How they learned it
  })).default([]),
  
  // Skills/expertise areas
  expertise: z.array(z.string()).default([]),
});

export type Knowledge = z.infer<typeof KnowledgeSchema>;

// Relationship to another character
export const RelationshipSchema = z.object({
  targetId: z.string().uuid(),
  targetName: z.string(),
  type: z.enum([
    'ally', 'friend', 'acquaintance', 'neutral',
    'rival', 'enemy', 'family', 'romantic', 'mentor', 'student',
  ]),
  trust: z.number().int().min(-3).max(3), // -3 = complete distrust, +3 = absolute trust
  history: z.string().optional(), // Brief relationship history
  lastInteractionTurn: z.number().int().optional(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;

// Base Character (shared by Player and NPC)
export const BaseCharacterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  
  // Fate Core mechanical stats
  aspects: z.array(AspectSchema),
  skills: z.array(SkillSchema),
  stunts: z.array(StuntSchema),
  stressTracks: z.array(StressTrackSchema),
  consequences: z.array(ConsequenceSchema),
  fatePoints: FatePointsSchema,
  
  // Narrative definition
  personality: PersonalitySchema,
  backstory: BackstorySchema,
  voice: VoiceSchema,
  knowledge: KnowledgeSchema,
  
  // Social connections
  relationships: z.array(RelationshipSchema).default([]),
  
  // Physical description
  appearance: z.string(),
  
  // Current state
  currentLocation: z.string(),
  isAlive: z.boolean().default(true),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BaseCharacter = z.infer<typeof BaseCharacterSchema>;

// Player Character - extends base with player-specific fields
export const PlayerCharacterSchema = BaseCharacterSchema.extend({
  type: z.literal('player'),
  
  // Player's long-term goals
  goals: z.array(z.object({
    description: z.string(),
    priority: z.enum(['primary', 'secondary', 'background']),
    progress: z.string().optional(),
  })).default([]),
  
  // Inventory (simplified for now)
  inventory: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    aspectId: z.string().uuid().optional(), // If item grants an aspect
  })).default([]),
  
  // Experience/advancement
  milestones: z.object({
    minor: z.number().int().default(0),
    significant: z.number().int().default(0),
    major: z.number().int().default(0),
  }),
});

export type PlayerCharacter = z.infer<typeof PlayerCharacterSchema>;

// NPC - extends base with NPC-specific fields
export const NPCSchema = BaseCharacterSchema.extend({
  type: z.literal('npc'),
  
  // GM control level
  importance: z.enum([
    'background',   // Minimal detail, can be improvised
    'supporting',   // Has defined personality, may recur
    'major',        // Significant to plot, fully detailed
    'antagonist',   // Opposition force, fully detailed
  ]),
  
  // What the NPC wants in this scene/arc
  currentAgenda: z.string().optional(),
  
  // Faction/group affiliation
  affiliations: z.array(z.object({
    factionId: z.string(),
    factionName: z.string(),
    role: z.string(),
    loyalty: z.number().int().min(0).max(5),
  })).default([]),
  
  // Last time this NPC was active
  lastActiveTurn: z.number().int().optional(),
  
  // For simpler NPCs, condensed stats
  isNameless: z.boolean().default(false), // "Nameless NPCs" in Fate
});

export type NPC = z.infer<typeof NPCSchema>;

// Character type union
export const CharacterSchema = z.discriminatedUnion('type', [
  PlayerCharacterSchema,
  NPCSchema,
]);

export type Character = z.infer<typeof CharacterSchema>;

// Character creation template (for new characters)
export const CharacterTemplateSchema = z.object({
  name: z.string(),
  highConcept: z.string(),
  trouble: z.string(),
  additionalAspects: z.array(z.string()).max(3),
  skills: z.record(z.string(), z.number().int().min(0).max(4)),
  stunts: z.array(z.string()).max(3),
  backstoryPrompt: z.string().optional(),
});

export type CharacterTemplate = z.infer<typeof CharacterTemplateSchema>;
```

### src/state.ts - Game State

```typescript
import { z } from 'zod';
import { PlayerCharacterSchema, NPCSchema } from './characters.js';
import { AspectSchema } from './fate.js';

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
```

### src/delta.ts - Delta Operations

```typescript
import { z } from 'zod';

// JSON path notation
export const JsonPathSchema = z.string().regex(
  /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\]|\[\*\])*$/,
  'Invalid JSON path'
);

// Delta operations
export const DeltaOpSchema = z.enum([
  'set',       // Set value at path
  'delete',    // Remove value at path
  'push',      // Add to array
  'pull',      // Remove from array
  'increment', // Add to number
]);

export type DeltaOp = z.infer<typeof DeltaOpSchema>;

// Single delta operation
export const DeltaSchema = z.object({
  // Unique delta ID
  id: z.string().uuid(),
  
  // When this delta was created
  turn: z.number().int().min(0),
  
  // Timestamp
  timestamp: z.string().datetime(),
  
  // What triggered this change
  source: z.enum([
    'player_action',
    'gm_narration',
    'npc_action',
    'conflict_resolution',
    'time_passage',
    'system',
  ]),
  
  // Target state: 'world', 'player', 'npc:{id}', 'scene'
  target: z.string(),
  
  // JSON path within target
  path: JsonPathSchema,
  
  // Operation type
  op: DeltaOpSchema,
  
  // The value (interpretation depends on op)
  value: z.unknown(),
  
  // Previous value (for undo/debugging)
  previousValue: z.unknown().optional(),
  
  // Human-readable description
  description: z.string().optional(),
});

export type Delta = z.infer<typeof DeltaSchema>;

// Batch of deltas from a single turn
export const TurnDeltasSchema = z.object({
  turn: z.number().int().min(0),
  deltas: z.array(DeltaSchema),
  checksum: z.string().optional(), // For integrity verification
});

export type TurnDeltas = z.infer<typeof TurnDeltasSchema>;

// Snapshot - compressed state at a point in time
export const SnapshotSchema = z.object({
  // Snapshot ID
  id: z.string().uuid(),
  
  // Turn this snapshot was taken at
  turn: z.number().int().min(0),
  
  // Timestamp
  timestamp: z.string().datetime(),
  
  // The complete state (or compressed representation)
  state: z.unknown(), // GameStateSchema at runtime
  
  // Hash of state for integrity
  stateHash: z.string(),
  
  // Deltas since last snapshot (summary)
  deltaSummary: z.object({
    count: z.number().int(),
    paths: z.array(z.string()), // Most frequently changed paths
  }),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;
```

### src/commands.ts - Player Commands

```typescript
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
```

### src/events.ts - Game Events

```typescript
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
```

### src/messages.ts - WebSocket Messages

```typescript
import { z } from 'zod';
import { PlayerCommandSchema } from './commands.js';
import { GameEventSchema } from './events.js';
import { GameStateSchema } from './state.js';

// Client → Server messages
export const ClientMessageSchema = z.discriminatedUnion('type', [
  // Send a command
  z.object({
    type: z.literal('COMMAND'),
    command: PlayerCommandSchema,
  }),
  
  // Request current state
  z.object({
    type: z.literal('GET_STATE'),
  }),
  
  // Request state at specific turn
  z.object({
    type: z.literal('GET_STATE_AT_TURN'),
    turn: z.number().int(),
  }),
  
  // Ping for connection health
  z.object({
    type: z.literal('PING'),
    timestamp: z.number(),
  }),
  
  // Subscribe to specific event types
  z.object({
    type: z.literal('SUBSCRIBE'),
    eventTypes: z.array(z.string()),
  }),
  
  // Request session list
  z.object({
    type: z.literal('LIST_SESSIONS'),
  }),
  
  // Load specific session
  z.object({
    type: z.literal('LOAD_SESSION'),
    sessionId: z.string().uuid(),
  }),
  
  // Create new session
  z.object({
    type: z.literal('NEW_SESSION'),
    themeName: z.string(),
    playerName: z.string(),
    characterTemplate: z.unknown(), // CharacterTemplateSchema
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server → Client messages
export const ServerMessageSchema = z.discriminatedUnion('type', [
  // Game event occurred
  z.object({
    type: z.literal('EVENT'),
    event: GameEventSchema,
  }),
  
  // Multiple events (batch)
  z.object({
    type: z.literal('EVENTS'),
    events: z.array(GameEventSchema),
  }),
  
  // Full state response
  z.object({
    type: z.literal('STATE'),
    state: GameStateSchema,
  }),
  
  // Pong response
  z.object({
    type: z.literal('PONG'),
    timestamp: z.number(),
    serverTime: z.number(),
  }),
  
  // Error response
  z.object({
    type: z.literal('ERROR'),
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  
  // Session list
  z.object({
    type: z.literal('SESSION_LIST'),
    sessions: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      theme: z.string(),
      turn: z.number().int(),
      lastPlayed: z.string().datetime(),
    })),
  }),
  
  // Session loaded
  z.object({
    type: z.literal('SESSION_LOADED'),
    sessionId: z.string().uuid(),
    state: GameStateSchema,
  }),
  
  // Command acknowledged
  z.object({
    type: z.literal('ACK'),
    commandId: z.string().uuid(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
```

### src/session.ts - Session Metadata

```typescript
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
```

### src/index.ts - Public Exports

```typescript
// Fate Core types
export * from './fate.js';

// Character types
export * from './characters.js';

// State types
export * from './state.js';

// Delta types
export * from './delta.js';

// Commands and events
export * from './commands.js';
export * from './events.js';

// WebSocket messages
export * from './messages.js';

// Session types
export * from './session.js';

// Re-export Zod for convenience
export { z } from 'zod';
```

---

## Usage Examples

### Validating Player Input

```typescript
import { PlayerCommandSchema } from '@llmrpg/protocol';

function handlePlayerInput(rawInput: unknown) {
  const result = PlayerCommandSchema.safeParse(rawInput);
  
  if (!result.success) {
    console.error('Invalid command:', result.error.format());
    return null;
  }
  
  return result.data; // Fully typed!
}
```

### Type-Safe Event Handling

```typescript
import { GameEvent, GameEventSchema } from '@llmrpg/protocol';

function handleEvent(event: GameEvent) {
  switch (event.type) {
    case 'NARRATIVE':
      displayNarrative(event.text, event.speaker);
      break;
    case 'DICE_ROLLED':
      animateDiceRoll(event.roll.dice, event.outcome);
      break;
    case 'ASPECT_CREATED':
      addAspectToDisplay(event.aspect);
      break;
    // TypeScript ensures all cases are handled!
  }
}
```

### Creating State Deltas

```typescript
import { Delta, DeltaSchema } from '@llmrpg/protocol';
import { v4 as uuid } from 'uuid';

function createDelta(
  turn: number,
  path: string,
  value: unknown,
  source: Delta['source']
): Delta {
  return DeltaSchema.parse({
    id: uuid(),
    turn,
    timestamp: new Date().toISOString(),
    source,
    target: 'world',
    path,
    op: 'set',
    value,
  });
}
```

---

## Testing

```typescript
// packages/protocol/tests/fate.test.ts
import { describe, it, expect } from 'vitest';
import { FateDiceRollSchema, ActionResolutionSchema } from '../src/fate';

describe('FateDiceRollSchema', () => {
  it('accepts valid dice rolls', () => {
    const roll = { dice: [1, 0, -1, 1], total: 1 };
    expect(FateDiceRollSchema.parse(roll)).toEqual(roll);
  });

  it('rejects invalid dice values', () => {
    const roll = { dice: [2, 0, -1, 1], total: 2 };
    expect(() => FateDiceRollSchema.parse(roll)).toThrow();
  });

  it('rejects wrong number of dice', () => {
    const roll = { dice: [1, 0, -1], total: 0 };
    expect(() => FateDiceRollSchema.parse(roll)).toThrow();
  });
});

describe('ActionResolutionSchema', () => {
  it('validates complete action resolution', () => {
    const resolution = {
      action: 'overcome',
      skill: 'Athletics',
      skillRank: 3,
      roll: { dice: [1, 1, 0, -1], total: 1 },
      difficulty: 2,
      invokes: [],
      totalResult: 4,
      shifts: 2,
      outcome: 'success',
    };
    
    expect(ActionResolutionSchema.parse(resolution)).toBeDefined();
  });
});
```

---

## Next Steps

With the protocol package complete, proceed to:

1. **CORE_PACKAGE.md** - Implement game engine using these types
2. **LLM_PACKAGE.md** - Create LLM adapters
3. **STORAGE_PACKAGE.md** - Implement persistence layer
