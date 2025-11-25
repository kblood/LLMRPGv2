import { describe, it, expect, beforeEach } from 'vitest';
import { TurnManager } from '../src/engine/TurnManager';
import { GameTime } from '../src/types/turn';

describe('TurnManager', () => {
  let manager: TurnManager;
  const mockTime: GameTime = {
    day: 1,
    timeOfDay: 'morning',
    timestamp: 1000,
  };

  beforeEach(() => {
    manager = new TurnManager('session-123');
  });

  it('should start a turn correctly', () => {
    const turn = manager.startTurn('player-1', 'scene-1', mockTime);
    
    expect(turn.turnId).toBe(1);
    expect(turn.actor).toBe('player-1');
    expect(turn.sceneId).toBe('scene-1');
    expect(turn.events).toHaveLength(0);
    expect(manager.getCurrentTurn()).toBe(turn);
  });

  it('should add events to the current turn', () => {
    manager.startTurn('player-1', 'scene-1', mockTime);
    
    const event = manager.addEvent('move', 'walks north', {
      description: 'Player walks north towards the gate',
    });

    expect(event.eventId).toBe('session-123-1-1');
    expect(event.type).toBe('move');
    expect(event.action).toBe('walks north');
    
    const turn = manager.getCurrentTurn();
    expect(turn?.events).toHaveLength(1);
    expect(turn?.events[0]).toBe(event);
  });

  it('should auto-increment event sequence', () => {
    manager.startTurn('player-1', 'scene-1', mockTime);
    
    const e1 = manager.addEvent('move', 'step 1');
    const e2 = manager.addEvent('move', 'step 2');

    expect(e1.sequence).toBe(1);
    expect(e2.sequence).toBe(2);
    expect(e1.eventId).toBe('session-123-1-1');
    expect(e2.eventId).toBe('session-123-1-2');
  });

  it('should finalize turn and clear current state', () => {
    manager.startTurn('player-1', 'scene-1', mockTime);
    manager.addEvent('move', 'done');
    
    const finalized = manager.finalizeTurn();
    
    expect(finalized.events).toHaveLength(1);
    expect(manager.getCurrentTurn()).toBeNull();
  });

  it('should throw if adding event without active turn', () => {
    expect(() => {
      manager.addEvent('move', 'fail');
    }).toThrow('No active turn');
  });
});
