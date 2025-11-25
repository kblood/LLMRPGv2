import { z } from 'zod';

// JSON path notation
export const JsonPathSchema = z.string().regex(
  /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d+\]|\[\*\])*$/,
  'Invalid JSON path'
);

// Delta operations
export const DeltaOpSchema = z.enum([
  'set',       // Set value at path
  'delete',    // Remove value at path
  'push',      // Add to array
  'pull',      // Remove from array
  'increment', // Add to number
]);

export type DeltaOp = z.infer<typeof DeltaOpSchema>;

// Single delta operation
export const DeltaSchema = z.object({
  // Unique delta ID
  id: z.string().uuid(),
  
  // When this delta was created
  turn: z.number().int().min(0),
  
  // Timestamp
  timestamp: z.string().datetime(),
  
  // What triggered this change
  source: z.enum([
    'player_action',
    'gm_narration',
    'npc_action',
    'conflict_resolution',
    'time_passage',
    'system',
  ]),
  
  // Target state: 'world', 'player', 'npc:{id}', 'scene'
  target: z.string(),
  
  // JSON path within target
  path: JsonPathSchema,
  
  // Operation type
  op: DeltaOpSchema,
  
  // The value (interpretation depends on op)
  value: z.unknown(),
  
  // Previous value (for undo/debugging)
  previousValue: z.unknown().optional(),
  
  // Human-readable description
  description: z.string().optional(),
});

export type Delta = z.infer<typeof DeltaSchema>;

// Batch of deltas from a single turn
export const TurnDeltasSchema = z.object({
  turn: z.number().int().min(0),
  deltas: z.array(DeltaSchema),
  checksum: z.string().optional(), // For integrity verification
});

export type TurnDeltas = z.infer<typeof TurnDeltasSchema>;
