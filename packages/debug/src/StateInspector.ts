import { SessionLoader } from '@llmrpg/storage';
import { GameState } from '@llmrpg/protocol';
import { Delta, applyDelta } from '@llmrpg/core';
import { diff, Diff } from 'deep-diff';

export interface ValidationIssue {
  type: string;
  turn: number;
  expected: any;
  actual: any;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export class StateInspector {
  constructor(private loader: SessionLoader) {}

  // Get state at any point in time
  async getStateAtTurn(sessionId: string, turn: number): Promise<GameState> {
    // For now, we assume we start from initial state and apply deltas.
    // In a real implementation, we would find the nearest snapshot.
    
    // Load initial state
    const { world, player } = await this.loader.loadCurrentState(sessionId); 
    // Wait, loadCurrentState loads the *current* state (latest).
    // We need the *initial* state or a snapshot.
    // If we don't have snapshots yet, we might need to rely on the fact that 
    // `world.state.json` and `player.state.json` are the *current* state.
    // To get state at turn X, we might need to replay from turn 0 if we don't have snapshots.
    // Or if we have a snapshot at turn 0.
    
    // Let's assume we can get the initial state. 
    // If `loadCurrentState` returns the *latest* state, we can't use it to go back 
    // unless we have reverse deltas (which we don't).
    
    // We need `loadInitialState` or similar.
    // If `session.meta.json` or similar has initial state, or if we have a snapshot at turn 0.
    // For now, I'll assume we can get a snapshot or start from scratch.
    // Since I haven't implemented snapshots fully in storage, I'll assume we have to replay from 0.
    // But where is the state at turn 0?
    // It should be in `sessions/{id}/snapshots/turn-0.json` or similar.
    
    // I'll add a TODO to implement snapshot loading properly.
    // For now, I'll try to load the "current" state and warn if we can't go back, 
    // OR I'll assume the user wants to inspect the current state if turn is not provided (but it is).
    
    // Let's assume we have a method to get initial state.
    // I'll mock it for now or try to use what's available.
    // `SessionLoader` doesn't have `loadInitialState`.
    
    // I'll implement a basic version that just loads current state if turn matches current,
    // otherwise throws error for now until snapshots are ready.
    
    const metadata = await this.loader.loadSessionMetadata(sessionId);
    if (metadata.currentTurn === turn) {
        const { world, player } = await this.loader.loadCurrentState(sessionId);
        // Construct GameState
        return {
            sessionId,
            turn,
            world,
            player,
            npcs: {}, // TODO: Load NPCs
            seed: 0, // TODO: Load seed
        } as unknown as GameState;
    }
    
    throw new Error("Time travel not yet fully supported without snapshots");
  }

  // Compare two states
  diffStates(before: GameState, after: GameState): Diff<GameState, GameState>[] {
    return diff(before, after) || [];
  }

  // Find what caused a state change
  async findDeltaForChange(
    sessionId: string, 
    path: string, 
    value: unknown
  ): Promise<Delta | null> {
    // This would require searching all deltas.
    // Expensive but useful for debug.
    const metadata = await this.loader.loadSessionMetadata(sessionId);
    const deltas = await this.loader.loadDeltas(sessionId, 1, metadata.currentTurn);
    
    // Simple check: find delta that sets this path to this value
    // Note: path in Delta is array, path arg is string (dot notation)
    const pathArray = path.split('.');
    
    return deltas.find(d => {
        // Compare paths
        if (d.path.length !== pathArray.length) return false;
        for(let i=0; i<d.path.length; i++) {
            if (d.path[i] !== pathArray[i]) return false;
        }
        // Compare value
        return JSON.stringify(d.newValue) === JSON.stringify(value);
    }) ?? null;
  }

  // Validate state integrity
  async validateSession(sessionId: string): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    
    // TODO: Implement full validation when snapshots are available
    
    return { valid: issues.length === 0, issues };
  }
}
