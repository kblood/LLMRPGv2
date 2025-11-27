import { z } from 'zod';

export const MilestoneTypeSchema = z.enum(['minor', 'significant', 'major']);
export type MilestoneType = z.infer<typeof MilestoneTypeSchema>;

export const AdvancementTypeSchema = z.enum([
    'swap_skills',
    'rename_aspect',
    'change_stunt',
    'buy_stunt',
    'increase_skill',
    'buy_skill',
    'rename_consequence',
    'increase_refresh',
    'rename_high_concept',
    'recover_consequence'
]);
export type AdvancementType = z.infer<typeof AdvancementTypeSchema>;

export const AdvancementActionSchema = z.object({
    type: AdvancementTypeSchema,
    milestoneRequired: MilestoneTypeSchema,
    details: z.object({
        skillName: z.string().optional(),
        targetSkillName: z.string().optional(), // For swap
        aspectName: z.string().optional(),
        newAspectName: z.string().optional(),
        stuntName: z.string().optional(),
        newStuntName: z.string().optional(),
        newStuntDescription: z.string().optional(),
        consequenceName: z.string().optional(),
    })
});
export type AdvancementAction = z.infer<typeof AdvancementActionSchema>;
