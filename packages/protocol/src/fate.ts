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
