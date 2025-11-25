import { EventEmitter } from 'events';
import { GameState } from '@llmrpg/protocol';
import { Turn, Delta, applyDelta } from '@llmrpg/core';

// Simple EventBus interface
export interface EventBus {
  emit(event: string, data: any): void;
  on(event: string, handler: (data: any) => void): void;
}

export interface SessionData {
    metadata: any;
    turns: Turn[];
    deltas: Delta[];
    initialState: GameState;
    totalTurns: number;
}

export interface TurnResult {
    turn: number;
    state: GameState;
    events: any[]; // GameEvent[]
    changedPaths: string[];
    breakReason?: 'breakpoint' | 'watch' | 'end';
    watchedPath?: string;
}

export class ReplayDebugger {
  private currentTurn: number = 0;
  private breakpoints: Set<number> = new Set();
  private watchedPaths: Set<string> = new Set();
  private currentState: GameState;

  constructor(
    private session: SessionData,
    private eventBus: EventBus = new EventEmitter(),
  ) {
      this.currentState = JSON.parse(JSON.stringify(session.initialState));
  }

  // Step through turn by turn
  async stepForward(): Promise<TurnResult> {
    if (this.currentTurn >= this.session.totalTurns) {
        return {
            turn: this.currentTurn,
            state: this.currentState,
            events: [],
            changedPaths: [],
            breakReason: 'end'
        };
    }

    this.currentTurn++;
    return this.executeTurn(this.currentTurn);
  }

  async stepBackward(): Promise<TurnResult> {
    if (this.currentTurn <= 0) {
         return {
            turn: 0,
            state: this.currentState,
            events: [],
            changedPaths: [],
        };
    }
    this.currentTurn--;
    return this.rebuildStateAtTurn(this.currentTurn);
  }

  // Jump to specific turn
  async goToTurn(turn: number): Promise<TurnResult> {
    this.currentTurn = turn;
    return this.rebuildStateAtTurn(turn);
  }

  // Breakpoints
  setBreakpoint(turn: number) {
    this.breakpoints.add(turn);
  }

  // Watch specific state paths
  watchPath(path: string) {
    this.watchedPaths.add(path);
  }

  // Run until breakpoint or watched path changes
  async runUntilBreak(): Promise<TurnResult> {
    while (this.currentTurn < this.session.totalTurns) {
      const result = await this.stepForward();
      
      if (this.breakpoints.has(this.currentTurn)) {
        return { ...result, breakReason: 'breakpoint' };
      }
      
      for (const path of this.watchedPaths) {
        if (result.changedPaths.includes(path)) {
          return { ...result, breakReason: 'watch', watchedPath: path };
        }
      }
    }
    
    return { 
        turn: this.currentTurn,
        state: this.currentState,
        events: [],
        changedPaths: [],
        breakReason: 'end' 
    };
  }

  private async executeTurn(turnId: number): Promise<TurnResult> {
      // Find deltas for this turn
      const deltas = this.session.deltas.filter(d => d.turnId === turnId);
      const changedPaths: string[] = [];

      // Apply deltas
      for (const delta of deltas) {
          this.currentState = applyDelta(this.currentState, delta);
          changedPaths.push(delta.path.join('.'));
      }

      // Emit events (simulated)
      this.eventBus.emit('turn_executed', { turnId, state: this.currentState });

      return {
          turn: turnId,
          state: this.currentState,
          events: [], // TODO: Load events for this turn
          changedPaths
      };
  }

  private async rebuildStateAtTurn(turnId: number): Promise<TurnResult> {
      // Reset to initial
      this.currentState = JSON.parse(JSON.stringify(this.session.initialState));
      
      // Replay all turns up to turnId
      const changedPaths: string[] = [];
      
      for (let i = 1; i <= turnId; i++) {
          const deltas = this.session.deltas.filter(d => d.turnId === i);
          for (const delta of deltas) {
              this.currentState = applyDelta(this.currentState, delta);
              if (i === turnId) {
                  changedPaths.push(delta.path.join('.'));
              }
          }
      }
      
      return {
          turn: turnId,
          state: this.currentState,
          events: [],
          changedPaths
      };
  }
}
