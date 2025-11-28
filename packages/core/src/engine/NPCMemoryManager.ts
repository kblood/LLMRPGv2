import { NPC, InteractionHistory, Relationship } from '@llmrpg/protocol';

/**
 * NPCMemoryManager handles persistent NPC interactions and memory across sessions.
 * It tracks:
 * - What happened between player and NPC in each session
 * - How relationships changed
 * - NPC emotional state and behavior adjustments
 * - Multi-session narrative continuity
 */
export class NPCMemoryManager {
  /**
   * Record an interaction between player and NPC
   */
  recordInteraction(
    npc: NPC,
    action: string,
    outcome: 'success' | 'failure' | 'neutral',
    relationshipDelta: { trust: number; affection: number; respect: number },
    currentTurn: number,
    currentSessionId: string,
    notes?: string
  ): void {
    const interaction: InteractionHistory = {
      turn: currentTurn,
      sessionId: currentSessionId,
      action,
      outcome,
      relationshipDelta,
      notes
    };

    // Add to interaction history
    if (!npc.interactionHistory) {
      npc.interactionHistory = [];
    }
    npc.interactionHistory.push(interaction);

    // Update relationship values - find first relationship in list (usually player)
    // or any relationship to apply the delta
    let targetRelationship = npc.relationships && npc.relationships.length > 0
      ? npc.relationships[0]
      : null;

    if (targetRelationship) {
      targetRelationship.trust = Math.max(-3, Math.min(3, targetRelationship.trust + relationshipDelta.trust));
      targetRelationship.affection = Math.max(-3, Math.min(3, targetRelationship.affection + relationshipDelta.affection));
      targetRelationship.respect = Math.max(-3, Math.min(3, targetRelationship.respect + relationshipDelta.respect));
      targetRelationship.lastInteractionTurn = currentTurn;

      // Record in relationship history
      targetRelationship.history.push({
        turn: currentTurn,
        event: action,
        impact: this.calculateImpact(relationshipDelta)
      });
    }
  }

  /**
   * Get the most recent interaction with the NPC
   */
  getLastInteraction(npc: NPC): InteractionHistory | undefined {
    if (!npc.interactionHistory || npc.interactionHistory.length === 0) {
      return undefined;
    }
    return npc.interactionHistory[npc.interactionHistory.length - 1];
  }

  /**
   * Get all interactions from a specific session
   */
  getInteractionsInSession(npc: NPC, sessionId: string): InteractionHistory[] {
    if (!npc.interactionHistory) return [];
    return npc.interactionHistory.filter(i => i.sessionId === sessionId);
  }

  /**
   * Get interaction count with the NPC across all sessions
   */
  getTotalInteractionCount(npc: NPC): number {
    return npc.interactionHistory?.length ?? 0;
  }

  /**
   * Get cumulative relationship changes from all interactions
   */
  getCumulativeRelationshipImpact(npc: NPC): { trust: number; affection: number; respect: number } {
    if (!npc.interactionHistory || npc.interactionHistory.length === 0) {
      return { trust: 0, affection: 0, respect: 0 };
    }

    return npc.interactionHistory.reduce(
      (acc, interaction) => ({
        trust: acc.trust + interaction.relationshipDelta.trust,
        affection: acc.affection + interaction.relationshipDelta.affection,
        respect: acc.respect + interaction.relationshipDelta.respect
      }),
      { trust: 0, affection: 0, respect: 0 }
    );
  }

  /**
   * Get interaction pattern (success rate, most common actions)
   */
  getInteractionPattern(npc: NPC): {
    totalInteractions: number;
    successRate: number;
    mostCommonAction: string | null;
    recentTrend: 'improving' | 'declining' | 'stable';
  } {
    if (!npc.interactionHistory || npc.interactionHistory.length === 0) {
      return {
        totalInteractions: 0,
        successRate: 0,
        mostCommonAction: null,
        recentTrend: 'stable'
      };
    }

    const interactions = npc.interactionHistory;
    const successCount = interactions.filter(i => i.outcome === 'success').length;
    const successRate = interactions.length > 0 ? successCount / interactions.length : 0;

    // Find most common action
    const actionCounts: Record<string, number> = {};
    for (const interaction of interactions) {
      actionCounts[interaction.action] = (actionCounts[interaction.action] || 0) + 1;
    }
    const mostCommonAction = Object.entries(actionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    // Determine trend (last 5 interactions vs before)
    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (interactions.length >= 5) {
      const oldScore = this.calculateInteractionScore(interactions.slice(0, -5));
      const newScore = this.calculateInteractionScore(interactions.slice(-5));
      if (newScore > oldScore + 0.1) recentTrend = 'improving';
      else if (newScore < oldScore - 0.1) recentTrend = 'declining';
    }

    return {
      totalInteractions: interactions.length,
      successRate: parseFloat(successRate.toFixed(2)),
      mostCommonAction,
      recentTrend
    };
  }

  /**
   * Generate memory context for NPC dialogue (what NPC remembers about player)
   */
  generateMemoryContext(npc: NPC, maxRecentInteractions: number = 3): string {
    const interactions = npc.interactionHistory || [];
    if (interactions.length === 0) {
      return `You have no prior interactions with ${npc.name}.`;
    }

    const recent = interactions.slice(-maxRecentInteractions);
    const totalCount = interactions.length;
    const impact = this.getCumulativeRelationshipImpact(npc);
    const pattern = this.getInteractionPattern(npc);

    let context = `You have interacted with the player ${totalCount} time${totalCount !== 1 ? 's' : ''}.\n`;

    if (impact.trust !== 0) {
      const trustLevel = impact.trust > 0 ? 'You trust them' : 'You distrust them';
      context += `${trustLevel} (${impact.trust > 0 ? '+' : ''}${impact.trust}).\n`;
    }

    if (impact.affection !== 0) {
      const affectLevel = impact.affection > 0 ? 'You like them' : 'You dislike them';
      context += `${affectLevel} (${impact.affection > 0 ? '+' : ''}${impact.affection}).\n`;
    }

    if (impact.respect !== 0) {
      const respectLevel = impact.respect > 0 ? 'You respect them' : 'You look down on them';
      context += `${respectLevel} (${impact.respect > 0 ? '+' : ''}${impact.respect}).\n`;
    }

    if (pattern.mostCommonAction) {
      context += `Their usual approach is to ${pattern.mostCommonAction}.\n`;
    }

    context += `\nRecent interactions:\n`;
    for (const interaction of recent) {
      context += `- Turn ${interaction.turn} (Session ${interaction.sessionId.slice(0, 8)}): ${interaction.action} (${interaction.outcome})`;
      if (interaction.notes) {
        context += ` - ${interaction.notes}`;
      }
      context += '\n';
    }

    if (pattern.recentTrend !== 'stable') {
      context += `\nRecent trend: Things have been ${pattern.recentTrend}.`;
    }

    return context;
  }

  /**
   * Check if NPC should hold a grudge (repeated negative interactions)
   */
  shouldHoldGrudge(npc: NPC, threshold: number = -4): boolean {
    const impact = this.getCumulativeRelationshipImpact(npc);
    return impact.trust + impact.respect <= threshold;
  }

  /**
   * Check if NPC has positive regard (repeated positive interactions)
   */
  hasPositiveRegard(npc: NPC, threshold: number = 4): boolean {
    const impact = this.getCumulativeRelationshipImpact(npc);
    return impact.affection + impact.trust >= threshold;
  }

  /**
   * Get list of grudges the NPC holds (issues from past interactions)
   */
  getGrudges(npc: NPC): string[] {
    if (!npc.interactionHistory) return [];

    const grudges: string[] = [];
    for (const interaction of npc.interactionHistory) {
      if (interaction.outcome === 'failure' || interaction.relationshipDelta.trust < 0) {
        grudges.push(interaction.action);
      }
    }
    return grudges;
  }

  /**
   * Apply interaction history effects on load (adjusts NPC behavior based on history)
   */
  applyMemoryEffects(npc: NPC, playerRelationship: Relationship): void {
    const impact = this.getCumulativeRelationshipImpact(npc);
    const pattern = this.getInteractionPattern(npc);

    // Update relationship values if not already done
    playerRelationship.trust = Math.max(-3, Math.min(3, playerRelationship.trust + impact.trust));
    playerRelationship.affection = Math.max(-3, Math.min(3, playerRelationship.affection + impact.affection));
    playerRelationship.respect = Math.max(-3, Math.min(3, playerRelationship.respect + impact.respect));

    // Adjust NPC agenda based on relationship
    if (this.shouldHoldGrudge(npc)) {
      npc.currentAgenda = `Teach ${playerRelationship.targetName} a lesson`;
    } else if (this.hasPositiveRegard(npc)) {
      npc.currentAgenda = `Help ${playerRelationship.targetName}`;
    }
  }

  // ============ Private Helper Methods ============

  private calculateImpact(delta: { trust: number; affection: number; respect: number }): number {
    return Math.sign(delta.trust + delta.affection + delta.respect);
  }

  private calculateInteractionScore(interactions: InteractionHistory[]): number {
    if (interactions.length === 0) return 0;
    let score = 0;
    for (const interaction of interactions) {
      score += interaction.relationshipDelta.trust / 3;
      score += interaction.relationshipDelta.affection / 3;
      score += interaction.relationshipDelta.respect / 3;
    }
    return score / interactions.length;
  }
}
