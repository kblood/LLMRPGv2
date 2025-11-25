export type DeltaTarget =
  | 'player'
  | 'npc'
  | 'location'
  | 'scene'
  | 'world'
  | 'quest'
  | 'relationship'
  | 'knowledge'
  | 'inventory'
  | 'time';

export type DeltaOperation =
  | 'set'
  | 'increment'
  | 'decrement'
  | 'append'
  | 'remove'
  | 'insert'
  | 'delete'
  | 'create'
  | 'destroy';

export interface Delta {
  // Identity
  deltaId: string; // Unique: "{sessionId}-{turnId}-{seq}"
  turnId: number;
  sequence: number;
  timestamp: number;

  // What changed
  target: DeltaTarget;
  operation: DeltaOperation;
  path: string[];

  // Change details
  previousValue: any;
  newValue: any;

  // Metadata
  cause: string;
  eventId: string;
}
