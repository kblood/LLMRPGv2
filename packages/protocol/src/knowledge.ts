import { z } from 'zod';

// Base interface for all knowledge items
const BaseKnowledgeSchema = z.object({
  known: z.boolean().default(false),
  confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  learnedFrom: z.string().optional(), // Source of information
  knownSince: z.number().int().optional(), // Turn number when learned
  lastUpdated: z.number().int().optional(), // Turn number when last updated
});

// Knowledge about a Location
export const LocationKnowledgeSchema = BaseKnowledgeSchema.extend({
  locationId: z.string(),
  name: z.string(), // Known name (might be alias)
  details: z.string().optional(), // What is known about it
  coordinates: z.string().optional(), // If known
  visited: z.boolean().default(false),
});

export type LocationKnowledge = z.infer<typeof LocationKnowledgeSchema>;

// Knowledge about another NPC
export const NPCKnowledgeSchema = BaseKnowledgeSchema.extend({
  npcId: z.string(),
  name: z.string(), // Known name
  role: z.string().optional(), // e.g. "Resistance Leader"
  personality: z.string().optional(), // Known personality traits
  goals: z.string().optional(), // Known goals
  relationship: z.string().optional(), // Perceived relationship
  location: z.string().optional(), // Last known location
  available: z.boolean().optional(), // Is the NPC accessible?
});

export type NPCKnowledge = z.infer<typeof NPCKnowledgeSchema>;

// Knowledge about a Quest
export const QuestKnowledgeSchema = BaseKnowledgeSchema.extend({
  questId: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['unknown', 'rumored', 'active', 'completed', 'failed']).default('unknown'),
  objectives: z.array(z.string()).default([]), // Known objectives
  rewards: z.string().optional(), // Known rewards
});

export type QuestKnowledge = z.infer<typeof QuestKnowledgeSchema>;

// Knowledge about a Faction
export const FactionKnowledgeSchema = BaseKnowledgeSchema.extend({
  factionId: z.string(),
  name: z.string(),
  reputation: z.number().int().default(0), // -100 to 100
  goals: z.string().optional(),
  members: z.array(z.string()).default([]), // Known members
});

export type FactionKnowledge = z.infer<typeof FactionKnowledgeSchema>;

// Knowledge about a specific Secret
export const SecretKnowledgeSchema = BaseKnowledgeSchema.extend({
  secretId: z.string(),
  topic: z.string(), // What is this about?
  content: z.string(), // The secret info
  verified: z.boolean().default(false), // Is it confirmed true?
});

export type SecretKnowledge = z.infer<typeof SecretKnowledgeSchema>;

// Knowledge about an Item
export const ItemKnowledgeSchema = BaseKnowledgeSchema.extend({
  itemId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  location: z.string().optional(), // Where it is thought to be
  properties: z.array(z.string()).default([]), // Known magical/tech properties
});

export type ItemKnowledge = z.infer<typeof ItemKnowledgeSchema>;

// Comprehensive Knowledge Profile
export const KnowledgeProfileSchema = z.object({
  locations: z.record(z.string(), LocationKnowledgeSchema).default({}),
  npcs: z.record(z.string(), NPCKnowledgeSchema).default({}),
  quests: z.record(z.string(), QuestKnowledgeSchema).default({}),
  factions: z.record(z.string(), FactionKnowledgeSchema).default({}),
  secrets: z.record(z.string(), SecretKnowledgeSchema).default({}),
  items: z.record(z.string(), ItemKnowledgeSchema).default({}),
  
  // General topics/lore
  topics: z.record(z.string(), z.object({
    topic: z.string(),
    knowledgeLevel: z.enum(['novice', 'intermediate', 'expert', 'master']),
    details: z.string(),
  })).default({}),
});

export type KnowledgeProfile = z.infer<typeof KnowledgeProfileSchema>;
