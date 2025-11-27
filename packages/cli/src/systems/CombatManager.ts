import { TurnManager, FateDice, ActionResolver, CharacterDefinition } from '@llmrpg/core';
import { ConflictState, SceneState, PlayerCharacter } from '@llmrpg/protocol';
import { DecisionEngine } from './DecisionEngine';
import { NarrativeEngine } from './NarrativeEngine';

export class CombatManager {
  constructor(
    private turnManager: TurnManager,
    private decisionEngine: DecisionEngine,
    private narrativeEngine: NarrativeEngine,
    private fateDice: FateDice
  ) {}

  /**
   * Starts a new conflict within the current scene.
   */
  async startConflict(
    scene: SceneState,
    type: 'physical' | 'mental' | 'social',
    opponents: CharacterDefinition[],
    player: PlayerCharacter,
    allies: CharacterDefinition[] = []
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

    const conflict: ConflictState = {
      id: conflictId,
      type,
      name: `${type} Conflict`,
      aspects: [], // Scene aspects apply, plus any new ones
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
   */
  moveCharacter(scene: SceneState, characterId: string, targetZoneId: string): { success: boolean, message: string } {
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

      // Check barrier/cost (TODO: Implement movement rolls if barrier > 0)
      if (connection.barrier > 0) {
        // For now, just allow it but note the difficulty
        // In real game, this would require an Overcome action
      }

      // Move
      currentZone.characterIds = currentZone.characterIds.filter(id => id !== characterId);
    }

    targetZone.characterIds.push(characterId);
    return { success: true, message: `Moved to ${targetZone.name}.` };
  }
}
