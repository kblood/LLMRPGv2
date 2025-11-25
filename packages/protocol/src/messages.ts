import { z } from 'zod';
import { PlayerCommandSchema } from './commands.js';
import { GameEventSchema } from './events.js';
import { GameStateSchema } from './state.js';

// Client → Server messages
export const ClientMessageSchema = z.discriminatedUnion('type', [
  // Send a command
  z.object({
    type: z.literal('COMMAND'),
    command: PlayerCommandSchema,
  }),
  
  // Request current state
  z.object({
    type: z.literal('GET_STATE'),
  }),
  
  // Request state at specific turn
  z.object({
    type: z.literal('GET_STATE_AT_TURN'),
    turn: z.number().int(),
  }),
  
  // Ping for connection health
  z.object({
    type: z.literal('PING'),
    timestamp: z.number(),
  }),
  
  // Subscribe to specific event types
  z.object({
    type: z.literal('SUBSCRIBE'),
    eventTypes: z.array(z.string()),
  }),
  
  // Request session list
  z.object({
    type: z.literal('LIST_SESSIONS'),
  }),
  
  // Load specific session
  z.object({
    type: z.literal('LOAD_SESSION'),
    sessionId: z.string().uuid(),
  }),
  
  // Create new session
  z.object({
    type: z.literal('NEW_SESSION'),
    themeName: z.string(),
    playerName: z.string(),
    characterTemplate: z.unknown(), // CharacterTemplateSchema
  }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// Server → Client messages
export const ServerMessageSchema = z.discriminatedUnion('type', [
  // Game event occurred
  z.object({
    type: z.literal('EVENT'),
    event: GameEventSchema,
  }),
  
  // Multiple events (batch)
  z.object({
    type: z.literal('EVENTS'),
    events: z.array(GameEventSchema),
  }),
  
  // Full state response
  z.object({
    type: z.literal('STATE'),
    state: GameStateSchema,
  }),
  
  // Pong response
  z.object({
    type: z.literal('PONG'),
    timestamp: z.number(),
    serverTime: z.number(),
  }),
  
  // Error response
  z.object({
    type: z.literal('ERROR'),
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  
  // Session list
  z.object({
    type: z.literal('SESSION_LIST'),
    sessions: z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      theme: z.string(),
      turn: z.number().int(),
      lastPlayed: z.string().datetime(),
    })),
  }),
  
  // Session loaded
  z.object({
    type: z.literal('SESSION_LOADED'),
    sessionId: z.string().uuid(),
    state: GameStateSchema,
  }),
  
  // Command acknowledged
  z.object({
    type: z.literal('ACK'),
    commandId: z.string().uuid(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;
