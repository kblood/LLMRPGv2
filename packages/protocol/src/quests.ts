import { z } from 'zod';

export const QuestStatusSchema = z.enum(['active', 'completed', 'failed', 'abandoned']);
export type QuestStatus = z.infer<typeof QuestStatusSchema>;

export const ObjectiveStatusSchema = z.enum(['active', 'completed', 'failed']);
export type ObjectiveStatus = z.infer<typeof ObjectiveStatusSchema>;

export const ObjectiveSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: ObjectiveStatusSchema.default('active'),
  type: z.enum(['visit', 'kill', 'collect', 'talk', 'interact', 'custom']),
  targetId: z.string().optional(), // ID of location, NPC, item, etc.
  currentCount: z.number().default(0),
  requiredCount: z.number().default(1),
  isHidden: z.boolean().default(false),
});

export type Objective = z.infer<typeof ObjectiveSchema>;

export const QuestStageSchema = z.object({
  id: z.string(),
  description: z.string(),
  objectives: z.array(ObjectiveSchema),
  nextStageId: z.string().optional(), // ID of the next stage upon completion
});

export type QuestStage = z.infer<typeof QuestStageSchema>;

// Knowledge prerequisites for quest discovery
export const QuestPrerequisitesSchema = z.object({
  // Required knowledge IDs by category
  locations: z.array(z.string()).optional(),
  npcs: z.array(z.string()).optional(),
  quests: z.array(z.string()).optional(), // Other quests that must be completed
  factions: z.array(z.string()).optional(),
  secrets: z.array(z.string()).optional(),
  items: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  
  // Minimum faction reputation requirements
  factionReputation: z.record(z.string(), z.number()).optional(), // factionId -> minRep
}).optional();

export type QuestPrerequisites = z.infer<typeof QuestPrerequisitesSchema>;

export const QuestSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: QuestStatusSchema.default('active'),
  
  // Current active objectives
  objectives: z.array(ObjectiveSchema).default([]),
  
  // Multi-stage support
  stages: z.record(z.string(), QuestStageSchema).optional(),
  currentStageId: z.string().optional(),

  giverId: z.string().optional(), // NPC who gave the quest
  locationId: z.string().optional(), // Location where quest started
  rewards: z.object({
    xp: z.number().optional(),
    items: z.array(z.string()).optional(),
    reputation: z.record(z.string(), z.number()).optional(), // Faction -> amount
  }).optional(),
  isHidden: z.boolean().default(false), // For secret quests/tracking
  
  // Prerequisites for quest discovery/availability
  prerequisites: QuestPrerequisitesSchema,
});

export type Quest = z.infer<typeof QuestSchema>;
