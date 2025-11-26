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

export const QuestSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: QuestStatusSchema.default('active'),
  objectives: z.array(ObjectiveSchema).default([]),
  giverId: z.string().optional(), // NPC who gave the quest
  locationId: z.string().optional(), // Location where quest started
  rewards: z.object({
    xp: z.number().optional(),
    items: z.array(z.string()).optional(),
    reputation: z.record(z.string(), z.number()).optional(), // Faction -> amount
  }).optional(),
  isHidden: z.boolean().default(false), // For secret quests/tracking
});

export type Quest = z.infer<typeof QuestSchema>;
