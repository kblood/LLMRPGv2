import { PlayerCharacter, AdvancementAction, Skill } from '@llmrpg/protocol';

export class AdvancementManager {
    
    static validateAdvancement(player: PlayerCharacter, action: AdvancementAction): { valid: boolean; reason?: string } {
        // 1. Check Milestone Availability
        const milestoneType = action.milestoneRequired as keyof typeof player.milestones;
        if (player.milestones[milestoneType] <= 0) {
            return { valid: false, reason: `You do not have a ${action.milestoneRequired} milestone available.` };
        }

        // 2. Validate Action Specifics
        switch (action.type) {
            case 'swap_skills':
                return this.validateSwapSkills(player, action);
            case 'rename_aspect':
                return this.validateRenameAspect(player, action);
            case 'change_stunt':
                return this.validateChangeStunt(player, action);
            case 'buy_stunt':
                return this.validateBuyStunt(player, action);
            case 'increase_skill':
                return this.validateIncreaseSkill(player, action);
            case 'buy_skill':
                return this.validateBuySkill(player, action);
            case 'rename_consequence':
                return this.validateRenameConsequence(player, action);
            case 'increase_refresh':
                return { valid: true }; // Always valid if you have the milestone
            case 'rename_high_concept':
                return { valid: true }; // Always valid if you have the milestone
            case 'recover_consequence':
                return this.validateRecoverConsequence(player, action);
            default:
                return { valid: false, reason: `Unknown advancement type: ${action.type}` };
        }
    }

    private static validateSwapSkills(player: PlayerCharacter, action: AdvancementAction): { valid: boolean; reason?: string } {
        const { skillName, targetSkillName } = action.details;
        if (!skillName || !targetSkillName) return { valid: false, reason: "Both skills must be specified." };
        
        const skill1 = player.skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
        const skill2 = player.skills.find(s => s.name.toLowerCase() === targetSkillName.toLowerCase());

        if (!skill1 || !skill2) return { valid: false, reason: "One or both skills not found." };
        
        // Fate Core: You can swap the ratings of any two skills.
        return { valid: true };
    }

    private static validateRenameAspect(player: PlayerCharacter, action: AdvancementAction): { valid: boolean; reason?: string } {
        const { aspectName, newAspectName } = action.details;
        if (!aspectName || !newAspectName) return { valid: false, reason: "Aspect name and new name must be specified." };

        const aspect = player.aspects.find(a => a.name.toLowerCase() === aspectName.toLowerCase());
        if (!aspect) return { valid: false, reason: `Aspect '${aspectName}' not found.` };

        return { valid: true };
    }

    private static validateChangeStunt(player: PlayerCharacter, action: AdvancementAction): { valid: boolean; reason?: string } {
        const { stuntName, newStuntName } = action.details;
        if (!stuntName || !newStuntName) return { valid: false, reason: "Stunt name and new stunt name must be specified." };

        const stunt = player.stunts.find(s => s.name.toLowerCase() === stuntName.toLowerCase());
        if (!stunt) return { valid: false, reason: `Stunt '${stuntName}' not found.` };

        return { valid: true };
    }

    private static validateBuyStunt(player: PlayerCharacter, action: AdvancementAction): { valid: boolean; reason?: string } {
        const { newStuntName } = action.details;
        if (!newStuntName) return { valid: false, reason: "New stunt name must be specified." };

        // Check Refresh cost
        // Fate Core: Buying a stunt reduces refresh by 1.
        // You must have at least 1 refresh remaining.
        if (player.fatePoints.refresh <= 1) {
            return { valid: false, reason: "Cannot reduce refresh below 1." };
        }

        return { valid: true };
    }

    private static validateIncreaseSkill(player: PlayerCharacter, action: AdvancementAction): { valid: boolean; reason?: string } {
        const { skillName } = action.details;
        if (!skillName) return { valid: false, reason: "Skill name must be specified." };

        const skill = player.skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
        if (!skill) return { valid: false, reason: `Skill '${skillName}' not found.` };

        // Cap check (e.g., +5)
        if (skill.rank >= 5) {
            return { valid: false, reason: "Cannot increase skill beyond +5 (Superb)." };
        }

        return { valid: true };
    }

    private static validateBuySkill(player: PlayerCharacter, action: AdvancementAction): { valid: boolean; reason?: string } {
        const { skillName } = action.details;
        if (!skillName) return { valid: false, reason: "Skill name must be specified." };

        const existing = player.skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
        if (existing) return { valid: false, reason: `You already have the skill '${skillName}'. Use 'increase_skill' instead.` };

        return { valid: true };
    }

    private static validateRenameConsequence(player: PlayerCharacter, action: AdvancementAction): { valid: boolean; reason?: string } {
        // Logic for renaming a consequence (usually part of recovery)
        return { valid: true };
    }

    private static validateRecoverConsequence(player: PlayerCharacter, action: AdvancementAction): { valid: boolean; reason?: string } {
        const { consequenceName } = action.details;
        if (!consequenceName) return { valid: false, reason: "Consequence name must be specified." };
        
        const consequence = player.consequences.find(c => c.name.toLowerCase() === consequenceName.toLowerCase());
        if (!consequence) return { valid: false, reason: `Consequence '${consequenceName}' not found.` };

        return { valid: true };
    }
}
