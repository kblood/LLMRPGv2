import { FateRollResult } from '../fate/FateDice';

export type EventType =
  | 'move'
  | 'observe'
  | 'interact'
  | 'dialogue'
  | 'combat_attack'
  | 'combat_defend'
  | 'skill_check'
  | 'state_change'
  | 'narrative'
  | 'knowledge_gain'
  | 'quest_update'
  | 'system'
  | 'fate_compel'
  | 'fate_point_spend'
  | 'fate_point_award'
  | 'fate_point_refresh';

export interface GameEvent {
  eventId: string; // Unique: "{sessionId}-{turnId}-{seq}"
  turnId: number;
  sequence: number;

  type: EventType;

  // What happened
  actor: string;
  target?: string | null;
  action: string;

  // Mechanical details
  skill?: string | null;
  difficulty?: number | null;
  roll?: FateRollResult | null;
  shifts?: number | null;

  // Narrative
  description: string;
  
  // Metadata
  metadata?: Record<string, any>;
  timestamp: number;
}
