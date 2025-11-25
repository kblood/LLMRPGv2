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
    player: PlayerCharacter
  ): Promise<ConflictState> {
    const conflictId = `conflict-${Date.now()}`;
    
    // 1. Determine Participants
    const participants = [
      { characterId: player.id, side: 'player' as const, hasActed: false, hasConceded: false },
      ...opponents.map(npc => ({
        characterId: npc.id,
        side: 'opposition' as const,
        hasActed: false,
        hasConceded: false
      }))
    ];

    // 2. Roll Initiative (Simplified: Player goes first for now, or based on Notice)
    // In a full implementation, we'd compare skills.
    // Let's just alternate for now: Player, then NPCs.
    const turnOrder = [player.id, ...opponents.map(o => o.id)];

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
    // Check if player is taken out
    const playerTakenOut = player.stressTracks.every(t => t.boxes.every(b => b)) && player.consequences.length >= 3; // Simplified check
    
    if (playerTakenOut) {
      conflict.isResolved = true;
      conflict.winner = 'opposition';
      conflict.resolution = "Player was defeated.";
      return true;
    }

    // Check if all opponents are taken out
    const allOpponentsDefeated = opponents.every(npc => 
      npc.stress.physical.every(b => b) // Simplified check
    );

    if (allOpponentsDefeated) {
      conflict.isResolved = true;
      conflict.winner = 'player';
      conflict.resolution = "All opponents defeated.";
      return true;
    }

    return false;
  }
}
