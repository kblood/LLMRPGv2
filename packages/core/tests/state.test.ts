import { describe, it, expect } from 'vitest';
import { DeltaCollector } from '../src/state/DeltaCollector';

describe('DeltaCollector', () => {
  it('should collect deltas with correct metadata', () => {
    const collector = new DeltaCollector('session-1', 42);
    
    const delta = collector.collect({
      target: 'player',
      operation: 'set',
      path: ['stress', 'physical', '0'],
      previousValue: false,
      newValue: true,
      cause: 'attack',
      eventId: 'event-1',
    });

    expect(delta.deltaId).toBe('session-1-42-1');
    expect(delta.turnId).toBe(42);
    expect(delta.sequence).toBe(1);
    expect(delta.target).toBe('player');
    expect(delta.newValue).toBe(true);
  });

  it('should maintain sequence numbers', () => {
    const collector = new DeltaCollector('session-1', 42);
    
    const d1 = collector.collect({
      target: 'player',
      operation: 'set',
      path: ['a'],
      previousValue: 0,
      newValue: 1,
      cause: 'test',
      eventId: 'e1',
    });

    const d2 = collector.collect({
      target: 'player',
      operation: 'set',
      path: ['b'],
      previousValue: 0,
      newValue: 1,
      cause: 'test',
      eventId: 'e2',
    });

    expect(d1.sequence).toBe(1);
    expect(d2.sequence).toBe(2);
    expect(d1.deltaId).toBe('session-1-42-1');
    expect(d2.deltaId).toBe('session-1-42-2');
  });

  it('should return all collected deltas', () => {
    const collector = new DeltaCollector('session-1', 42);
    collector.collect({
      target: 'player',
      operation: 'set',
      path: ['a'],
      previousValue: 0,
      newValue: 1,
      cause: 'test',
      eventId: 'e1',
    });

    expect(collector.getDeltas()).toHaveLength(1);
  });
});
