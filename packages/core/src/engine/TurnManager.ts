import { Turn, GameTime } from '../types/turn';
import { GameEvent, EventType } from '../types/events';

export class TurnManager {
  private currentTurn: Turn | null = null;
  private turnCounter = 0;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  startTurn(actor: string, sceneId: string, gameTime: GameTime): Turn {
    this.turnCounter++;
    
    this.currentTurn = {
      turnId: this.turnCounter,
      turnNumber: 0, // TODO: Track scene turn numbers
      actor,
      sceneId,
      timestamp: Date.now(),
      gameTime,
      events: [],
    };

    return this.currentTurn;
  }

  addEvent(
    type: EventType,
    action: string,
    details: Partial<Omit<GameEvent, 'eventId' | 'turnId' | 'sequence' | 'type' | 'action'>> = {}
  ): GameEvent {
    if (!this.currentTurn) {
      throw new Error('No active turn. Call startTurn() first.');
    }

    const sequence = this.currentTurn.events.length + 1;
    const eventId = `${this.sessionId}-${this.currentTurn.turnId}-${sequence}`;

    const event: GameEvent = {
      eventId,
      turnId: this.currentTurn.turnId,
      sequence,
      type,
      action,
      actor: this.currentTurn.actor, // Default to turn actor
      timestamp: Date.now(),
      description: '',
      ...details,
    };

    this.currentTurn.events.push(event);
    return event;
  }

  finalizeTurn(): Turn {
    if (!this.currentTurn) {
      throw new Error('No active turn to finalize.');
    }

    const turn = this.currentTurn;
    this.currentTurn = null;
    return turn;
  }

  getCurrentTurn(): Turn | null {
    return this.currentTurn;
  }
}
