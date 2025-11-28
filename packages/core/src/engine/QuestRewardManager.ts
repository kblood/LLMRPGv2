import { Quest, PlayerCharacter, WorldState } from '@llmrpg/protocol';
import { FactionManager } from './FactionManager';
import { QuestGiverManager } from './QuestGiverManager';

/**
 * QuestRewardManager handles applying quest rewards to players
 * when quests are completed, including:
 * - Reputation changes with factions
 * - Item rewards
 * - XP/milestone tracking
 * - Persistent tracking across sessions
 */
export class QuestRewardManager {
  private factionManager: FactionManager;
  private questGiverManager: QuestGiverManager;

  constructor(worldState: WorldState) {
    this.factionManager = new FactionManager(worldState);
    this.questGiverManager = new QuestGiverManager();
  }

  /**
   * Apply quest rewards to the player
   * Returns true if rewards were applied, false if already applied or quest not found
   */
  applyQuestRewards(
    player: PlayerCharacter,
    quest: Quest,
    questGiver: any,
    worldState: WorldState
  ): { success: boolean; appliedRewards: { reputation?: Record<string, number>; xp?: number; items?: string[] } } {
    if (!player.appliedRewardQuestIds) {
      player.appliedRewardQuestIds = [];
    }

    // Check if rewards were already applied
    if (player.appliedRewardQuestIds.includes(quest.id)) {
      return { success: false, appliedRewards: {} };
    }

    if (quest.status !== 'completed') {
      return { success: false, appliedRewards: {} };
    }

    const appliedRewards: { reputation?: Record<string, number>; xp?: number; items?: string[] } = {};

    // Apply reputation changes (only if faction exists)
    if (quest.rewards?.reputation) {
      appliedRewards.reputation = {};
      for (const [factionId, reputationGain] of Object.entries(quest.rewards.reputation)) {
        const faction = this.factionManager.getFaction(factionId);
        if (faction) {
          const newRep = this.factionManager.updateReputation(factionId, player.id, reputationGain as number);
          appliedRewards.reputation[factionId] = newRep;
        }
      }
    }

    // Apply XP (milestone tracking in Fate Core)
    if (quest.rewards?.xp) {
      appliedRewards.xp = quest.rewards.xp;
      this.applyXPReward(player, quest.rewards.xp);
    }

    // Apply items
    if (quest.rewards?.items && quest.rewards.items.length > 0) {
      appliedRewards.items = quest.rewards.items;
      // Items would be added to inventory, but we don't have item implementation yet
      // This is a placeholder for future inventory system
    }

    // Mark as applied
    player.appliedRewardQuestIds.push(quest.id);

    // Update quest giver if present
    if (questGiver) {
      this.questGiverManager.updateQuestStatus(questGiver, quest.id, 'completed');
    }

    return { success: true, appliedRewards };
  }

  /**
   * Apply XP reward by advancing milestones
   * In Fate Core, advancement is tracked via milestone achievements
   * Uses a simple linear mapping for milestone types
   */
  private applyXPReward(player: PlayerCharacter, xp: number): void {
    if (!player.milestones) {
      player.milestones = { minor: 0, significant: 0, major: 0 };
    }

    // Milestone conversion: treat each type as independent rewards
    // Rather than hierarchical thresholds, award directly based on quest rewards
    // Quests typically award in ranges: 50-200 (minor), 300+ (significant), 900+ (major)
    // This is a simplified model - in real Fate, milestones are earned narratively
    if (xp >= 900) {
      player.milestones.major += 1;
    } else if (xp >= 300) {
      player.milestones.significant += 1;
    } else if (xp >= 100) {
      player.milestones.minor += 1;
    }
  }

  /**
   * Check for unapplied quest rewards on session load
   * This handles cases where a quest was completed in a previous session
   * but rewards were not yet applied
   */
  applyPendingQuestRewards(
    player: PlayerCharacter,
    worldState: WorldState,
    npcMap?: Record<string, any>
  ): Array<{ questId: string; success: boolean }> {
    const results: Array<{ questId: string; success: boolean }> = [];

    for (const quest of worldState.quests) {
      if (quest.status === 'completed' && !player.appliedRewardQuestIds?.includes(quest.id)) {
        const questGiver = quest.giverId && npcMap ? npcMap[quest.giverId] : undefined;
        const result = this.applyQuestRewards(player, quest, questGiver, worldState);
        results.push({ questId: quest.id, success: result.success });
      }
    }

    return results;
  }

  /**
   * Track a quest as completed by the player
   * (separate from actually applying rewards)
   */
  trackQuestCompletion(player: PlayerCharacter, questId: string): void {
    if (!player.completedQuestIds) {
      player.completedQuestIds = [];
    }

    if (!player.completedQuestIds.includes(questId)) {
      player.completedQuestIds.push(questId);
    }
  }

  /**
   * Get all completed quests that have not had rewards applied
   */
  getPendingRewardQuests(player: PlayerCharacter, worldState: WorldState): Quest[] {
    const appliedIds = new Set(player.appliedRewardQuestIds || []);
    return worldState.quests.filter(
      q => q.status === 'completed' && !appliedIds.has(q.id)
    );
  }

  /**
   * Get summary of quest rewards for dialogue/narrative context
   */
  generateRewardContext(player: PlayerCharacter, worldState: WorldState): string {
    const pendingQuests = this.getPendingRewardQuests(player, worldState);
    if (pendingQuests.length === 0) {
      return 'You have no pending quest rewards.';
    }

    let context = `You have ${pendingQuests.length} quest${pendingQuests.length !== 1 ? 's' : ''} with pending rewards:\n`;

    for (const quest of pendingQuests) {
      context += `\n- ${quest.title}`;
      if (quest.rewards) {
        const rewardParts: string[] = [];
        if (quest.rewards.xp) rewardParts.push(`${quest.rewards.xp} XP`);
        if (quest.rewards.reputation) {
          const repEntries = Object.entries(quest.rewards.reputation)
            .map(([factionId, amount]) => `${factionId}: +${amount}`)
            .join(', ');
          rewardParts.push(`Reputation: ${repEntries}`);
        }
        if (quest.rewards.items?.length) rewardParts.push(`${quest.rewards.items.length} item(s)`);

        if (rewardParts.length > 0) {
          context += ` (${rewardParts.join(', ')})`;
        }
      }
      context += '\n';
    }

    return context;
  }
}
