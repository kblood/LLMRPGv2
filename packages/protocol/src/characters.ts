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
