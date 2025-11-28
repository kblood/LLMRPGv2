import { ConflictState, PlayerCharacter } from '@llmrpg/protocol';
import { CharacterDefinition } from '@llmrpg/core';

/**
 * TeamTacticsManager handles team-based combat mechanics including:
 * - Coordinated attacks and boosts
 * - Team positioning and spacing
 * - Combined action benefits
 * - Morale and teamwork tracking
 */
export class TeamTacticsManager {
  /**
   * Tracks which allies have coordinated with current action
   */
  private coordinationMap: Map<string, Set<string>> = new Map();

  /**
   * Records team morale/coordination bonus
   */
  private teamMorale: Map<string, number> = new Map();

  /**
   * Check if allies can coordinate on a player action
   * Returns list of allies who can provide boost
   */
  getAvailableCoordinators(
    conflict: ConflictState,
    playerId: string,
    playerZoneId: string,
    allies: CharacterDefinition[]
  ): CharacterDefinition[] {
    const availableAllies: CharacterDefinition[] = [];

    for (const ally of allies) {
      // Ally must be on player's side
      const participant = conflict.participants.find(p => p.characterId === ally.id);
      if (!participant || participant.side !== 'player') continue;

      // Ally must not have conceded
      if (participant.hasConceded) continue;

      // Ally should be in same or adjacent zone for bonus
      // (For now, same zone for simplicity - could extend to adjacent zones)
      // This would require tracking zone positions during conflict

      availableAllies.push(ally);
    }

    return availableAllies;
  }

  /**
   * Calculate coordination bonus for combined action
   * Fate Core: Allies can help with +1 shift per helper if they're in position
   */
  calculateCoordinationBonus(coordinators: CharacterDefinition[]): number {
    // In Fate Core, each helper provides +1 to the roll
    // But only up to a reasonable number (suggested 1-3)
    return Math.min(coordinators.length, 3);
  }

  /**
   * Record a coordinated action for future tracking
   */
  recordCoordination(playerId: string, coordinatorIds: string[]): void {
    if (!this.coordinationMap.has(playerId)) {
      this.coordinationMap.set(playerId, new Set());
    }

    const coordSet = this.coordinationMap.get(playerId)!;
    coordinatorIds.forEach(id => coordSet.add(id));
  }

  /**
   * Get allies who have recently coordinated with player
   * This can influence NPC morale and decision-making
   */
  getRecentCoordinators(playerId: string): string[] {
    return Array.from(this.coordinationMap.get(playerId) || []);
  }

  /**
   * Apply teamwork boost to action
   * Returns narrative description of the teamwork
   */
  generateCoordinationNarrative(
    playerId: string,
    coordinators: CharacterDefinition[],
    action: string
  ): string {
    if (coordinators.length === 0) {
      return '';
    }

    const coordinatorNames = coordinators.map(c => c.name).join(' and ');

    switch (coordinators.length) {
      case 1:
        return `With ${coordinatorNames}'s support, you ${action}.`;
      case 2:
        return `With ${coordinatorNames} backing you up, you ${action}.`;
      default:
        return `With your team's coordinated effort, you ${action}.`;
    }
  }

  /**
   * Check if team is in tight formation (affects defense bonuses)
   * Requires allies to be in same zone
   */
  isTightFormation(
    playerZoneId: string,
    allyZoneIds: Map<string, string>
  ): boolean {
    // Check if majority of allies are in same zone as player
    const zoneCount = new Map<string, number>();

    for (const zoneId of allyZoneIds.values()) {
      zoneCount.set(zoneId, (zoneCount.get(zoneId) || 0) + 1);
    }

    const maxAlliesInAnyZone = Math.max(0, ...Array.from(zoneCount.values()));
    const totalAllies = allyZoneIds.size;

    // Tight formation if 50%+ of allies in same zone (any single zone)
    return totalAllies > 0 && maxAlliesInAnyZone >= Math.ceil(totalAllies / 2);
  }

  /**
   * Get morale modifier based on team coordination
   * Affects opposition's difficulty when facing well-coordinated team
   */
  getTeamMoraleBonus(teamSize: number, recentCoordinations: number): number {
    // Start with team size bonus (larger team = better morale)
    let bonus = 0;

    if (teamSize >= 3) bonus += 1;
    if (teamSize >= 5) bonus += 1;

    // Add bonus for recent successful coordinations
    if (recentCoordinations >= 2) bonus += 1;
    if (recentCoordinations >= 4) bonus += 1;

    return bonus;
  }

  /**
   * Determine if a combined attack can be used
   * Fate Core: Multiple characters can attack same target for +1 per attacker (up to 3)
   */
  canPerformCombinedAttack(
    conflict: ConflictState,
    playerSide: 'player' | 'opposition',
    targetId: string
  ): { canAttack: boolean; combinedAttackers: string[] } {
    const combinedAttackers: string[] = [];

    // Find all participants on player's side
    const sideParticipants = conflict.participants.filter(
      p => p.side === playerSide && !p.hasConceded
    );

    // Check which ones could theoretically attack the target
    // (In real implementation, would check zones, skills, etc.)
    for (const participant of sideParticipants) {
      combinedAttackers.push(participant.characterId);
    }

    // Return up to 3 attackers for bonus (Fate Core guideline)
    return {
      canAttack: combinedAttackers.length > 0,
      combinedAttackers: combinedAttackers.slice(0, 3),
    };
  }

  /**
   * Get tactical analysis for NPC decision-making
   * Evaluates team strength and recommends actions
   */
  getTacticalAnalysis(
    conflict: ConflictState,
    npcSide: 'player' | 'opposition'
  ): {
    teamStrength: 'weak' | 'moderate' | 'strong';
    recommendation: string;
    coordinationLevel: number;
  } {
    const sideParticipants = conflict.participants.filter(
      p => p.side === npcSide && !p.hasConceded
    );

    const teamStrength =
      sideParticipants.length >= 3
        ? 'strong'
        : sideParticipants.length === 2
          ? 'moderate'
          : 'weak';

    let recommendation = '';
    switch (teamStrength) {
      case 'strong':
        recommendation = 'Team has numerical advantage - consider coordinated attacks';
        break;
      case 'moderate':
        recommendation = 'Team is balanced - focus on strategy and positioning';
        break;
      case 'weak':
        recommendation = 'Team is outnumbered - consider tactical retreat or defensive focus';
        break;
    }

    // Count recent coordinations as proxy for team morale
    const coordinationLevel = sideParticipants.length; // Simplified

    return { teamStrength, recommendation, coordinationLevel };
  }

  /**
   * Reset coordination tracking (e.g., at start of new exchange)
   */
  resetCoordinationTracking(): void {
    this.coordinationMap.clear();
    this.teamMorale.clear();
  }

  /**
   * Get summary of team composition for narrative
   */
  generateTeamComposition(
    player: PlayerCharacter,
    allies: CharacterDefinition[]
  ): string {
    if (allies.length === 0) {
      return `You stand alone against the opposition.`;
    }

    const allyNames = allies.map(a => a.name).join(', ');

    if (allies.length === 1) {
      return `You and ${allies[0].name} face the opposition together.`;
    } else {
      return `You lead a team: ${allyNames}. Together, you face the opposition.`;
    }
  }
}
