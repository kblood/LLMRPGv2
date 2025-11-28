import { NPC, Quest, QuestGiven } from '@llmrpg/protocol';

/**
 * QuestGiverManager manages bidirectional quest giver relationships.
 * It maintains:
 * - Which quests an NPC has given
 * - Quest status from the NPC's perspective
 * - Multi-session quest context (NPC remembers if quest was completed)
 * - Quest giver dialogue context
 */
export class QuestGiverManager {
  /**
   * Link a quest to the NPC who gave it
   */
  assignQuestToNPC(npc: NPC, quest: Quest, currentTurn: number, sessionId: string): void {
    if (!quest.giverId) {
      throw new Error('Quest must have a giverId before assigning to NPC');
    }

    if (!npc.questsGiven) {
      npc.questsGiven = [];
    }

    // Check if this quest is already linked
    const existing = npc.questsGiven.find(q => q.questId === quest.id);
    if (!existing) {
      const questGiven: QuestGiven = {
        questId: quest.id,
        givenTurn: currentTurn,
        givenSessionId: sessionId,
        currentStatus: quest.status as 'active' | 'completed' | 'failed' | 'abandoned'
      };
      npc.questsGiven.push(questGiven);
    }
  }

  /**
   * Update quest status from NPC's perspective
   */
  updateQuestStatus(npc: NPC, questId: string, newStatus: Quest['status'], currentTurn?: number, sessionId?: string): boolean {
    if (!npc.questsGiven) return false;

    const questGiven = npc.questsGiven.find(q => q.questId === questId);
    if (!questGiven) return false;

    questGiven.currentStatus = newStatus as 'active' | 'completed' | 'failed' | 'abandoned';

    // Update last action if provided
    if (currentTurn !== undefined && sessionId !== undefined) {
      questGiven.playerLastAction = {
        turn: currentTurn,
        sessionId,
        description: `Quest status changed to ${newStatus}`
      };
    }

    return true;
  }

  /**
   * Record player action on a quest from NPC's perspective
   */
  recordQuestAction(
    npc: NPC,
    questId: string,
    action: string,
    currentTurn: number,
    sessionId: string
  ): boolean {
    if (!npc.questsGiven) return false;

    const questGiven = npc.questsGiven.find(q => q.questId === questId);
    if (!questGiven) return false;

    questGiven.playerLastAction = {
      turn: currentTurn,
      sessionId,
      description: action
    };

    return true;
  }

  /**
   * Get all active quests given by this NPC
   */
  getActiveQuests(npc: NPC): QuestGiven[] {
    if (!npc.questsGiven) return [];
    return npc.questsGiven.filter(q => q.currentStatus === 'active');
  }

  /**
   * Get all completed quests given by this NPC
   */
  getCompletedQuests(npc: NPC): QuestGiven[] {
    if (!npc.questsGiven) return [];
    return npc.questsGiven.filter(q => q.currentStatus === 'completed');
  }

  /**
   * Get total quests given by this NPC (across all sessions)
   */
  getTotalQuestsGiven(npc: NPC): number {
    return npc.questsGiven?.length ?? 0;
  }

  /**
   * Generate dialogue context for NPC based on their quests
   */
  generateQuestContext(npc: NPC, questId?: string): string {
    if (!npc.questsGiven || npc.questsGiven.length === 0) {
      return `You have not given any quests to this player yet.`;
    }

    let context = `You have given ${npc.questsGiven.length} quest${npc.questsGiven.length !== 1 ? 's' : ''} to this player.\n`;

    // Specific quest context if requested
    if (questId) {
      const quest = npc.questsGiven.find(q => q.questId === questId);
      if (quest) {
        context += `\nSpecific quest (${questId}):\n`;
        context += `- Status: ${quest.currentStatus}\n`;
        context += `- Given in session: ${quest.givenSessionId}\n`;
        if (quest.playerLastAction) {
          context += `- Last player action: "${quest.playerLastAction.description}" (Turn ${quest.playerLastAction.turn})\n`;
        }
      }
    } else {
      // General quest summary
      const active = this.getActiveQuests(npc);
      const completed = this.getCompletedQuests(npc);

      if (active.length > 0) {
        context += `\nActive quests: ${active.length}\n`;
        for (const quest of active) {
          context += `- Quest: ${quest.questId}`;
          if (quest.playerLastAction) {
            context += ` (last: ${quest.playerLastAction.description})`;
          }
          context += '\n';
        }
      }

      if (completed.length > 0) {
        context += `\nCompleted quests: ${completed.length}\n`;
        for (const quest of completed) {
          context += `- Quest: ${quest.questId}\n`;
        }
      }
    }

    return context;
  }

  /**
   * Check if NPC has an ongoing relationship with player through quests
   */
  hasOngoingQuestRelationship(npc: NPC): boolean {
    const activeQuests = this.getActiveQuests(npc);
    return activeQuests.length > 0;
  }

  /**
   * Get NPC's reaction based on quest status
   * (Used for dialogue and behavior)
   */
  getNPCQuestReaction(npc: NPC, questId: string): 'eager' | 'anxious' | 'satisfied' | 'disappointed' | 'neutral' {
    if (!npc.questsGiven) return 'neutral';

    const questGiven = npc.questsGiven.find(q => q.questId === questId);
    if (!questGiven) return 'neutral';

    switch (questGiven.currentStatus) {
      case 'active':
        // Eager if quest was just given, anxious if overdue
        const sessionsSinceGiven = 1; // Would need to calculate from sessionId
        return sessionsSinceGiven <= 1 ? 'eager' : 'anxious';
      case 'completed':
        return 'satisfied';
      case 'failed':
      case 'abandoned':
        return 'disappointed';
      default:
        return 'neutral';
    }
  }

  /**
   * Get all NPCs who have given quests (for quest tracking)
   */
  static getAllQuestGivers(npcs: NPC[]): NPC[] {
    return npcs.filter(npc => npc.questsGiven && npc.questsGiven.length > 0);
  }

  /**
   * Find NPC by quest they gave
   */
  static findNPCByQuest(npcs: NPC[], questId: string): NPC | undefined {
    return npcs.find(npc =>
      npc.questsGiven && npc.questsGiven.some(q => q.questId === questId)
    );
  }

  /**
   * Get summary of quest givers for player knowledge base
   */
  static generateQuestGiverSummary(npcs: NPC[]): Record<string, { questCount: number; completedCount: number }> {
    const summary: Record<string, { questCount: number; completedCount: number }> = {};

    for (const npc of npcs) {
      if (npc.questsGiven && npc.questsGiven.length > 0) {
        summary[npc.id] = {
          questCount: npc.questsGiven.length,
          completedCount: npc.questsGiven.filter(q => q.currentStatus === 'completed').length
        };
      }
    }

    return summary;
  }
}
