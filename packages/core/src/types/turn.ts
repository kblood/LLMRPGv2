import { GameEvent } from './events';

export interface GameTime {
  day: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  timestamp: number; // Abstract game timestamp
}

export interface TurnContext {
  prompt: string;
  response: string;
  seed: number;
  model: string;
}

export interface Turn {
  turnId: number;
  turnNumber: number; // Within scene
  actor: string;
  sceneId: string;
  
  timestamp: number; // Real world
  gameTime: GameTime;

  events: GameEvent[];
  
  llmContext?: TurnContext;
}
