import { TurnManager, FateDice, ActionResolver, CharacterDefinition } from '@llmrpg/core';
import { ConflictState, SceneState, PlayerCharacter, Faction } from '@llmrpg/protocol';
import { DecisionEngine } from './DecisionEngine';
import { NarrativeEngine } from './NarrativeEngine';
import { TeamTacticsManager } from './TeamTacticsManager';

export class CombatManager {
  private teamTacticsManager: TeamTacticsManager;

  constructor(
    private turnManager: TurnManager,
    private decisionEngine: DecisionEngine,
    private narrativeEngine: NarrativeEngine,
    private fateDice: FateDice
  ) {
    this.teamTacticsManager = new TeamTacticsManager();
  }

  /**
   * Starts a new conflict within the current scene.
   */
  async startConflict(
    scene: SceneState,
    type: 'physical' | 'mental' | 'social',
    opponents: CharacterDefinition[],
    player: PlayerCharacter,
    allies: CharacterDefinition[] = [],
    factions?: Faction[]
  ): Promise<ConflictState> {
    const conflictId = `conflict-${Date.now()}`;
    
    // 1. Determine Participants
    const participants = [
      { characterId: player.id, side: 'player' as const, hasActed: false, hasConceded: false },
      ...allies.map(npc => ({
        characterId: npc.id,
        side: 'player' as const,
        hasActed: false,
        hasConceded: false
      })),
      ...opponents.map(npc => ({
        characterId: npc.id,
        side: 'opposition' as const,
        hasActed: false,
        hasConceded: false
      }))
    ];

    // 2. Roll Initiative (Simplified: Player -> Allies -> Opponents)
    // In a full implementation, we'd compare skills.
    const turnOrder = [
        player.id, 
        ...allies.map(a => a.id),
        ...opponents.map(o => o.id)
    ];

    // 3. For social conflicts, add relationship-based aspects
    const socialAspects = type === 'social' ? this.generateSocialAspects(player, opponents, factions) : [];

    const conflict: ConflictState = {
      id: conflictId,
      type,
      name: `${type} Conflict`,
      aspects: [...scene.aspects.filter(a => typeof a === 'object' && a !== null) as any[], ...socialAspects], // Scene aspects apply, plus any new ones
      participants,
      turnOrder,
      currentTurnIndex: 0,
      currentExchange: 1,
      isResolved: false
    };

    scene.conflict = conflict;
    scene.type = 'conflict';

    return conflict;
  }

  /**
   * Advances the conflict to the next turn.
   * Returns the ID of the character whose turn it is.
   */
  nextTurn(conflict: ConflictState): string {
    // Mark current actor as having acted (if we were tracking that strictly per turn)
    // But we just move the index.
    
    conflict.currentTurnIndex++;
    
    // Check if we need to start a new exchange (round)
    if (conflict.currentTurnIndex >= conflict.turnOrder.length) {
      conflict.currentTurnIndex = 0;
      conflict.currentExchange++;
      
      // Reset "hasActed" flags if we were using them
      conflict.participants.forEach(p => p.hasActed = false);
    }

    const nextActorId = conflict.turnOrder[conflict.currentTurnIndex];
    
    // Skip if actor has conceded or is taken out (TODO: Check state)
    
    return nextActorId;
  }

  /**
   * Checks if the conflict is resolved.
   */
  checkResolution(conflict: ConflictState, opponents: CharacterDefinition[], player: PlayerCharacter): boolean {
    const stressType = conflict.type;
    const npcStressProp = conflict.type === 'physical' ? 'physical' : 'mental';

    // Check if player is taken out
    const playerTrack = player.stressTracks.find(t => t.type === stressType);
    const playerTakenOut = playerTrack 
        ? playerTrack.boxes.every(b => b) && player.consequences.length >= 3 
        : false;
    
    if (playerTakenOut) {
      conflict.isResolved = true;
      conflict.winner = 'opposition';
      return true;
    }

    // Check if all opponents are taken out
    const activeOpponents = opponents.filter(npc => {
        // Simple check: if they have stress tracks, check them. If not (mobs), maybe check a simple "stress" value?
        // For now, assume NPCs follow same rules or are just "active"
        return true; // TODO: Implement NPC taken out logic
    });

    if (activeOpponents.length === 0) {
      conflict.isResolved = true;
      conflict.winner = 'player';
      return true;
    }

    return false;
  }

  /**
   * Ends the conflict with a specific resolution.
   */
  endConflict(conflict: ConflictState, winner: 'player' | 'opposition' | 'draw', resolution: string) {
    conflict.isResolved = true;
    conflict.winner = winner;
    conflict.resolution = resolution;
  }

  /**
   * Move a character between zones.
   * In active combat, this requires an Overcome action against the barrier difficulty.
   */
  moveCharacter(
    scene: SceneState,
    characterId: string,
    targetZoneId: string,
    skillRating: number = 0,
    diceRoll: number = 0,
    inCombat: boolean = false
  ): { success: boolean; message: string; costShifts?: number; difficulty?: number } {
    if (!scene.zones) {
      return { success: false, message: "No zones defined in this scene." };
    }

    const currentZone = scene.zones.zones.find(z => z.characterIds.includes(characterId));
    const targetZone = scene.zones.zones.find(z => z.id === targetZoneId);

    if (!targetZone) {
      return { success: false, message: "Target zone not found." };
    }

    if (currentZone?.id === targetZoneId) {
      return { success: false, message: "Already in that zone." };
    }

    // Check connection
    if (currentZone) {
      const connection = scene.zones.connections.find(c =>
        (c.fromZoneId === currentZone.id && c.toZoneId === targetZone.id) ||
        (c.fromZoneId === targetZone.id && c.toZoneId === currentZone.id)
      );

      if (!connection) {
        return { success: false, message: "No direct path to that zone." };
      }

      // In combat: Check barrier/cost requires Overcome action
      if (inCombat && connection.barrier > 0) {
        const roll = skillRating + diceRoll;
        const difficulty = connection.barrier;
        const shifts = roll - difficulty;

        if (shifts < 0) {
          return {
            success: false,
            message: `Movement blocked! You needed ${difficulty} but got ${roll}. You cannot reach ${targetZone.name} this turn.`,
            difficulty,
            costShifts: 0,
          };
        }

        // Movement succeeded, but cost shifts (Fate Core: 1 shift to move with barrier)
        // Move
        currentZone.characterIds = currentZone.characterIds.filter(id => id !== characterId);
        targetZone.characterIds.push(characterId);

        return {
          success: true,
          message: `Successfully moved to ${targetZone.name} (cost: 1 shift for movement with barrier).`,
          difficulty,
          costShifts: 1,
        };
      }

      // No barrier or not in combat: free movement
      currentZone.characterIds = currentZone.characterIds.filter(id => id !== characterId);
    }

    targetZone.characterIds.push(characterId);
    return { success: true, message: `Moved to ${targetZone.name}.` };
  }

  /**
   * Get the TeamTacticsManager instance
   */
  getTeamTacticsManager(): TeamTacticsManager {
    return this.teamTacticsManager;
  }

  /**
   * Get all characters in a specific zone
   */
  getCharactersInZone(scene: SceneState, zoneId: string): string[] {
    const zone = scene.zones?.zones.find(z => z.id === zoneId);
    return zone?.characterIds || [];
  }

  /**
   * Get zone information including aspects and connections
   */
  getZoneInfo(scene: SceneState, zoneId: string): any {
    if (!scene.zones) return null;

    const zone = scene.zones.zones.find(z => z.id === zoneId);
    if (!zone) return null;

    const connections = scene.zones.connections.filter(
      c => c.fromZoneId === zoneId || c.toZoneId === zoneId
    );

    return {
      id: zone.id,
      name: zone.name,
      description: zone.description,
      aspects: zone.aspects,
      characterIds: zone.characterIds,
      connections: connections.map(c => ({
        targetZoneId: c.fromZoneId === zoneId ? c.toZoneId : c.fromZoneId,
        barrier: c.barrier,
        description: c.description,
        aspects: c.aspects,
      })),
    };
  }

  /**
   * Determine advantageous positioning
   * Returns tactical analysis for combat decision-making
   */
  analyzeCombatPositioning(
    scene: SceneState,
    conflict: ConflictState,
    playerSide: 'player' | 'opposition'
  ): {
    controlledZones: string[];
    numericalAdvantage: boolean;
    tightFormation: boolean;
    recommendation: string;
  } {
    if (!scene.zones) {
      return {
        controlledZones: [],
        numericalAdvantage: false,
        tightFormation: false,
        recommendation: 'No zone information available',
      };
    }

    // Count participants in each zone by side
    const zoneControl: Record<string, { player: number; opposition: number }> = {};

    for (const zone of scene.zones.zones) {
      zoneControl[zone.id] = { player: 0, opposition: 0 };

      for (const characterId of zone.characterIds) {
        const participant = conflict.participants.find(p => p.characterId === characterId);
        if (participant) {
          if (participant.side === 'player') zoneControl[zone.id].player++;
          else if (participant.side === 'opposition') zoneControl[zone.id].opposition++;
        }
      }
    }

    // Find controlled zones (more allies than enemies)
    const controlledZones = Object.entries(zoneControl)
      .filter(([_, counts]) => {
        if (playerSide === 'player') return counts.player > counts.opposition;
        else return counts.opposition > counts.player;
      })
      .map(([zoneId, _]) => zoneId);

    // Check numerical advantage
    const sideParticipants = conflict.participants.filter(p => p.side === playerSide && !p.hasConceded);
    const otherSide = playerSide === 'player' ? 'opposition' : 'player';
    const otherParticipants = conflict.participants.filter(p => p.side === otherSide && !p.hasConceded);
    const numericalAdvantage = sideParticipants.length > otherParticipants.length;

    // Check tight formation
    const playerZoneIds = new Map(
      conflict.participants
        .filter(p => p.side === playerSide)
        .map(p => [p.characterId, this.getCharacterZone(scene, p.characterId)])
        .filter(([_, zoneId]) => zoneId !== undefined) as [string, string][]
    );

    const primaryZone = Array.from(playerZoneIds.values())[0];
    const inPrimaryZone = Array.from(playerZoneIds.values()).filter(z => z === primaryZone).length;
    const tightFormation = inPrimaryZone >= Math.ceil(sideParticipants.length / 2);

    let recommendation = '';
    if (controlledZones.length > 0 && numericalAdvantage) {
      recommendation = 'Strong position - press the advantage with coordinated attacks';
    } else if (tightFormation) {
      recommendation = 'Team is well-positioned - maintain formation and support allies';
    } else if (numericalAdvantage) {
      recommendation = 'Numerical advantage - spread out to control more zones';
    } else {
      recommendation = 'Outnumbered - maintain tight formation and defensive posture';
    }

    return { controlledZones, numericalAdvantage, tightFormation, recommendation };
  }

  /**
   * Get the current zone of a character
   */
  private getCharacterZone(scene: SceneState, characterId: string): string | undefined {
    return scene.zones?.zones.find(z => z.characterIds.includes(characterId))?.id;
  }

  /**
   * Generate combat narration based on zone positioning
   */
  generateZoneNarration(
    scene: SceneState,
    conflict: ConflictState,
    characterId: string,
    action: string
  ): string {
    if (!scene.zones) {
      return action;
    }

    const zone = scene.zones.zones.find(z => z.characterIds.includes(characterId));
    if (!zone) return action;

    const alliesInZone = conflict.participants.filter(
      p =>
        p.side === 'player' &&
        zone.characterIds.includes(p.characterId) &&
        p.characterId !== characterId
    ).length;

    const enemiesInZone = conflict.participants.filter(
      p =>
        p.side === 'opposition' &&
        zone.characterIds.includes(p.characterId)
    ).length;

    let narrative = action;

    if (alliesInZone > 0) {
      narrative += ` (With ${alliesInZone} ally(allies) in ${zone.name})`;
    } else if (enemiesInZone > 0) {
      narrative += ` (Facing ${enemiesInZone} opponent(s) in ${zone.name})`;
    }

    // Add zone aspect descriptions
    if (zone.aspects.length > 0) {
      narrative += `. The area is ${zone.aspects.map(a => a.name).join(', ')}`;
    }

    return narrative;
  }

  /**
   * Generates social aspects based on relationships and faction reputation.
   */
  private generateSocialAspects(player: PlayerCharacter, opponents: CharacterDefinition[], factions?: Faction[]): string[] {
    const aspects: string[] = [];

    for (const opponent of opponents) {
      // Check relationship
      const relationship = player.relationships.find(r => r.targetId === opponent.id);
      if (relationship) {
        if (relationship.trust >= 2) aspects.push(`${opponent.name} Trusts You`);
        else if (relationship.trust <= -2) aspects.push(`${opponent.name} Distrusts You`);

        if (relationship.affection >= 2) aspects.push(`${opponent.name} Likes You`);
        else if (relationship.affection <= -2) aspects.push(`${opponent.name} Dislikes You`);

        if (relationship.respect >= 2) aspects.push(`${opponent.name} Respects You`);
        else if (relationship.respect <= -2) aspects.push(`${opponent.name} Disrespects You`);
      }

      // Check faction reputation - factions is a Record, not an array
      if (factions && typeof factions === 'object') {
        const factionValues = Object.values(factions);
        for (const faction of factionValues) {
          if (faction && opponent.affiliations?.some(a => a.factionId === faction.id)) {
            const rep = faction.relationships?.[player.id] || 0;
            if (rep >= 50) aspects.push(`Allied with ${faction.name}`);
            else if (rep <= -50) aspects.push(`Hostile to ${faction.name}`);
          }
        }
      }
    }

    return aspects;
  }
}
