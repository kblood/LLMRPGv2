# Technical Architecture

> TypeScript-based modular architecture for LLMRPGv2

## Overview

This document defines the technical stack and architectural patterns that enable:
- **Full decoupling** of backend (game engine) and frontend (UI)
- **High modularity** through dependency injection and clear interfaces
- **Deep debuggability** with structured logging, replay, and state inspection
- **Testability** at every layer

---

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│  Framework: React / Vue / Svelte / CLI / Discord Bot / etc.    │
│  State: Zustand / Pinia / Svelte stores                         │
│  Transport: WebSocket / REST / IPC                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ JSON Messages (Protocol)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER (Optional)                       │
│  Framework: Hono / Fastify / Express                            │
│  WebSocket: ws / Socket.io                                      │
│  Validation: Zod                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ TypeScript Interfaces
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       GAME ENGINE CORE                          │
│  Runtime: Node.js 20+ / Bun                                     │
│  Language: TypeScript 5.x (strict mode)                         │
│  Testing: Vitest                                                │
│  Validation: Zod                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Adapters / Ports
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE                             │
│  Storage: SQLite (better-sqlite3) + JSON files                  │
│  LLM: OpenAI / Anthropic / Ollama (via adapters)                │
│  Logging: Pino (structured JSON logs)                           │
│  Config: dotenv + zod validation                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

Using **pnpm workspaces** for package management:

```
llmrpg/
├── package.json                    # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json              # Shared TS config
├── vitest.workspace.ts             # Shared test config
│
├── packages/
│   ├── core/                       # 🎯 Game engine (no I/O dependencies)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts            # Public exports
│   │   │   ├── engine/
│   │   │   │   ├── GameMaster.ts
│   │   │   │   ├── TurnManager.ts
│   │   │   │   └── ConflictSystem.ts
│   │   │   ├── state/
│   │   │   │   ├── WorldState.ts
│   │   │   │   ├── PlayerState.ts
│   │   │   │   └── DeltaCollector.ts
│   │   │   ├── fate/
│   │   │   │   ├── FateDice.ts
│   │   │   │   ├── AspectManager.ts
│   │   │   │   └── ActionResolver.ts
│   │   │   ├── characters/
│   │   │   │   ├── Character.ts
│   │   │   │   ├── NPC.ts
│   │   │   │   └── Player.ts
│   │   │   ├── context/
│   │   │   │   ├── ContextBuilder.ts
│   │   │   │   ├── PromptTemplates.ts
│   │   │   │   └── KnowledgeGate.ts
│   │   │   └── types/
│   │   │       ├── index.ts
│   │   │       ├── actions.ts
│   │   │       ├── state.ts
│   │   │       └── events.ts
│   │   └── tests/
│   │
│   ├── llm/                        # 🤖 LLM adapters (injectable)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts            # LLMProvider interface
│   │   │   ├── adapters/
│   │   │   │   ├── OpenAIAdapter.ts
│   │   │   │   ├── AnthropicAdapter.ts
│   │   │   │   ├── OllamaAdapter.ts
│   │   │   │   └── MockAdapter.ts  # For testing!
│   │   │   └── middleware/
│   │   │       ├── RetryMiddleware.ts
│   │   │       ├── CacheMiddleware.ts
│   │   │       └── LoggingMiddleware.ts
│   │   └── tests/
│   │
│   ├── storage/                    # 💾 Persistence adapters
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts            # StorageProvider interface
│   │   │   ├── adapters/
│   │   │   │   ├── FileSystemAdapter.ts
│   │   │   │   ├── SQLiteAdapter.ts
│   │   │   │   └── MemoryAdapter.ts  # For testing!
│   │   │   ├── session/
│   │   │   │   ├── SessionWriter.ts
│   │   │   │   ├── SessionLoader.ts
│   │   │   │   └── SnapshotManager.ts
│   │   │   └── replay/
│   │   │       └── ReplayEngine.ts
│   │   └── tests/
│   │
│   ├── protocol/                   # 📡 Shared message types
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── messages.ts         # All message schemas (Zod)
│   │   │   ├── events.ts           # Game events
│   │   │   └── commands.ts         # Player commands
│   │   └── tests/
│   │
│   └── debug/                      # 🔍 Debug utilities
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── StateInspector.ts
│       │   ├── DeltaVisualizer.ts
│       │   ├── ContextDebugger.ts
│       │   └── ReplayDebugger.ts
│       └── tests/
│
├── apps/
│   ├── server/                     # 🖥️ Backend server
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── api/
│   │   │   │   ├── routes.ts
│   │   │   │   └── websocket.ts
│   │   │   └── container.ts        # Dependency injection setup
│   │   └── tests/
│   │
│   ├── cli/                        # ⌨️ Command-line interface
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── repl.ts
│   │
│   └── web/                        # 🌐 Web frontend (if needed)
│       ├── package.json
│       └── src/
│
└── tools/
    ├── session-viewer/             # 📊 Debug tool for sessions
    └── world-editor/               # 🗺️ World definition editor
```

---

## Core Decoupling Patterns

### 1. Ports and Adapters (Hexagonal Architecture)

The core engine defines **interfaces** (ports), and infrastructure provides **implementations** (adapters):

```typescript
// packages/core/src/ports/LLMPort.ts
export interface LLMPort {
  complete(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  streamComplete(prompt: string, options?: LLMOptions): AsyncIterable<string>;
}

// packages/core/src/ports/StoragePort.ts
export interface StoragePort {
  saveSession(session: Session): Promise<void>;
  loadSession(sessionId: string): Promise<Session>;
  appendDelta(sessionId: string, delta: Delta): Promise<void>;
  getDeltas(sessionId: string, fromTurn?: number): Promise<Delta[]>;
}

// packages/core/src/ports/EventBus.ts
export interface EventBus {
  emit<T extends GameEvent>(event: T): void;
  on<T extends GameEvent>(type: T['type'], handler: (event: T) => void): void;
  off<T extends GameEvent>(type: T['type'], handler: (event: T) => void): void;
}
```

### 2. Dependency Injection Container

```typescript
// apps/server/src/container.ts
import { Container } from 'inversify';
import { GameMaster, TurnManager } from '@llmrpg/core';
import { OpenAIAdapter, MockAdapter } from '@llmrpg/llm';
import { FileSystemAdapter, MemoryAdapter } from '@llmrpg/storage';

export function createContainer(config: AppConfig): Container {
  const container = new Container();

  // LLM Provider - swap implementations easily
  if (config.useMockLLM) {
    container.bind<LLMPort>('LLMPort').to(MockAdapter);
  } else {
    container.bind<LLMPort>('LLMPort').to(OpenAIAdapter);
  }

  // Storage - memory for tests, filesystem for production
  if (config.useMemoryStorage) {
    container.bind<StoragePort>('StoragePort').to(MemoryAdapter);
  } else {
    container.bind<StoragePort>('StoragePort').to(FileSystemAdapter);
  }

  // Core services
  container.bind<GameMaster>(GameMaster).toSelf();
  container.bind<TurnManager>(TurnManager).toSelf();

  return container;
}
```

### 3. Event-Driven Communication

Frontend and backend communicate via events, not direct calls:

```typescript
// packages/protocol/src/messages.ts
import { z } from 'zod';

// Commands: Frontend → Backend
export const PlayerCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('PLAYER_ACTION'),
    action: z.enum(['overcome', 'create_advantage', 'attack', 'defend']),
    target: z.string().optional(),
    description: z.string(),
  }),
  z.object({
    type: z.literal('INVOKE_ASPECT'),
    aspectId: z.string(),
    reroll: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('CONCEDE'),
    conflictId: z.string(),
  }),
]);

// Events: Backend → Frontend
export const GameEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TURN_STARTED'),
    turn: z.number(),
    activeCharacter: z.string(),
  }),
  z.object({
    type: z.literal('NARRATIVE'),
    text: z.string(),
    speaker: z.string().optional(),
  }),
  z.object({
    type: z.literal('DICE_ROLLED'),
    dice: z.array(z.number().min(-1).max(1)),
    total: z.number(),
    skill: z.string(),
    difficulty: z.number(),
    outcome: z.enum(['fail', 'tie', 'success', 'success_with_style']),
  }),
  z.object({
    type: z.literal('STATE_DELTA'),
    delta: DeltaSchema,
  }),
]);
```

---

## Debugging Infrastructure

### 1. Structured Logging with Context

```typescript
// packages/core/src/logging/GameLogger.ts
import pino from 'pino';

export interface LogContext {
  sessionId?: string;
  turn?: number;
  character?: string;
  action?: string;
}

export class GameLogger {
  private logger: pino.Logger;
  private context: LogContext = {};

  constructor(options?: pino.LoggerOptions) {
    this.logger = pino({
      ...options,
      formatters: {
        level: (label) => ({ level: label }),
      },
    });
  }

  withContext(ctx: Partial<LogContext>): GameLogger {
    const child = new GameLogger();
    child.logger = this.logger.child(ctx);
    child.context = { ...this.context, ...ctx };
    return child;
  }

  // Specific game events
  turnStart(turn: number, character: string) {
    this.logger.info({ event: 'turn_start', turn, character });
  }

  llmRequest(prompt: string, tokens: number) {
    this.logger.debug({ event: 'llm_request', promptLength: prompt.length, tokens });
  }

  llmResponse(response: string, latencyMs: number) {
    this.logger.debug({ event: 'llm_response', responseLength: response.length, latencyMs });
  }

  deltaApplied(delta: Delta) {
    this.logger.trace({ event: 'delta_applied', path: delta.path, op: delta.op });
  }

  stateSnapshot(turn: number, stateHash: string) {
    this.logger.info({ event: 'snapshot', turn, stateHash });
  }
}
```

### 2. State Inspector (Debug Tool)

```typescript
// packages/debug/src/StateInspector.ts
export class StateInspector {
  constructor(private storage: StoragePort) {}

  // Get state at any point in time
  async getStateAtTurn(sessionId: string, turn: number): Promise<GameState> {
    const snapshots = await this.storage.getSnapshots(sessionId);
    const nearestSnapshot = this.findNearestSnapshot(snapshots, turn);
    
    let state = nearestSnapshot.state;
    const deltas = await this.storage.getDeltas(
      sessionId, 
      nearestSnapshot.turn, 
      turn
    );
    
    for (const delta of deltas) {
      state = applyDelta(state, delta);
    }
    
    return state;
  }

  // Compare two states
  diffStates(before: GameState, after: GameState): StateDiff[] {
    return deepDiff(before, after);
  }

  // Find what caused a state change
  async findDeltaForChange(
    sessionId: string, 
    path: string, 
    value: unknown
  ): Promise<Delta | null> {
    const deltas = await this.storage.getDeltas(sessionId);
    return deltas.find(d => d.path === path && d.value === value) ?? null;
  }

  // Validate state integrity
  async validateSession(sessionId: string): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    
    // Replay from start, compare against snapshots
    const deltas = await this.storage.getDeltas(sessionId);
    const snapshots = await this.storage.getSnapshots(sessionId);
    
    let state = await this.storage.getInitialState(sessionId);
    let deltaIndex = 0;
    
    for (const snapshot of snapshots) {
      while (deltaIndex < deltas.length && deltas[deltaIndex].turn <= snapshot.turn) {
        state = applyDelta(state, deltas[deltaIndex]);
        deltaIndex++;
      }
      
      if (!deepEqual(state, snapshot.state)) {
        issues.push({
          type: 'snapshot_mismatch',
          turn: snapshot.turn,
          expected: snapshot.state,
          actual: state,
        });
      }
    }
    
    return { valid: issues.length === 0, issues };
  }
}
```

### 3. Replay Debugger

```typescript
// packages/debug/src/ReplayDebugger.ts
export class ReplayDebugger {
  private currentTurn: number = 0;
  private breakpoints: Set<number> = new Set();
  private watchedPaths: Set<string> = new Set();

  constructor(
    private session: Session,
    private eventBus: EventBus,
  ) {}

  // Step through turn by turn
  async stepForward(): Promise<TurnResult> {
    this.currentTurn++;
    return this.executeTurn(this.currentTurn);
  }

  async stepBackward(): Promise<TurnResult> {
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
    
    return { ...result, breakReason: 'end' };
  }

  // Get LLM context at current turn (for debugging prompts)
  async getContextAtCurrentTurn(): Promise<DebugContext> {
    const state = await this.rebuildStateAtTurn(this.currentTurn);
    const turn = this.session.turns[this.currentTurn];
    
    return {
      turn: this.currentTurn,
      state,
      gmPrompt: await buildGMContext(state, turn),
      activeNPC: turn.activeNPC ? await buildNPCContext(state, turn.activeNPC) : null,
      playerContext: await buildPlayerContext(state),
    };
  }
}
```

### 4. Context Debugger (LLM Prompts)

```typescript
// packages/debug/src/ContextDebugger.ts
export class ContextDebugger {
  // See exactly what context was sent to LLM
  async inspectContext(
    sessionId: string, 
    turn: number, 
    actor: 'gm' | 'npc' | 'player',
    npcId?: string
  ): Promise<ContextInspection> {
    const state = await this.stateInspector.getStateAtTurn(sessionId, turn);
    const builder = new ContextBuilder(state);
    
    let context: BuiltContext;
    switch (actor) {
      case 'gm':
        context = builder.buildGMContext();
        break;
      case 'npc':
        context = builder.buildNPCContext(npcId!);
        break;
      case 'player':
        context = builder.buildPlayerContext();
        break;
    }

    return {
      actor,
      turn,
      systemPrompt: context.systemPrompt,
      userMessage: context.userMessage,
      tokenCount: countTokens(context),
      breakdown: {
        worldContext: context.layers.world,
        characterContext: context.layers.character,
        sessionContext: context.layers.session,
        immediateContext: context.layers.immediate,
      },
      // What knowledge was filtered out?
      filteredKnowledge: context.filteredKnowledge,
    };
  }

  // Compare context between turns
  diffContext(
    context1: ContextInspection, 
    context2: ContextInspection
  ): ContextDiff {
    return {
      addedKnowledge: diff(context1.breakdown, context2.breakdown).added,
      removedKnowledge: diff(context1.breakdown, context2.breakdown).removed,
      tokenDelta: context2.tokenCount - context1.tokenCount,
    };
  }
}
```

---

## Testing Strategy

### 1. Unit Tests (Core Logic)

```typescript
// packages/core/tests/fate/FateDice.test.ts
import { describe, it, expect } from 'vitest';
import { FateDice } from '../src/fate/FateDice';

describe('FateDice', () => {
  it('rolls 4 dice with values -1, 0, or 1', () => {
    const dice = new FateDice();
    const roll = dice.roll();
    
    expect(roll.dice).toHaveLength(4);
    roll.dice.forEach(d => {
      expect(d).toBeGreaterThanOrEqual(-1);
      expect(d).toBeLessThanOrEqual(1);
    });
  });

  it('calculates correct total', () => {
    const dice = new FateDice(() => [1, 1, -1, 0]); // Seeded for testing
    const roll = dice.roll();
    
    expect(roll.total).toBe(1);
  });
});
```

### 2. Integration Tests (With Mock LLM)

```typescript
// packages/core/tests/integration/GameLoop.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestContainer } from '../helpers/container';
import { MockLLMAdapter } from '@llmrpg/llm';

describe('Game Loop Integration', () => {
  let container: Container;
  let mockLLM: MockLLMAdapter;
  let gameMaster: GameMaster;

  beforeEach(() => {
    container = createTestContainer();
    mockLLM = container.get<MockLLMAdapter>('LLMPort');
    gameMaster = container.get<GameMaster>(GameMaster);
  });

  it('processes player action and generates narrative', async () => {
    // Arrange
    mockLLM.setNextResponse({
      narrative: 'You push against the heavy door...',
      outcome: 'success',
      stateChanges: [
        { path: 'world.locations.dungeon.doors.main', op: 'set', value: 'open' }
      ]
    });

    // Act
    const result = await gameMaster.processAction({
      type: 'overcome',
      description: 'Push open the heavy door',
      skill: 'physique',
    });

    // Assert
    expect(result.narrative).toContain('door');
    expect(result.deltas).toHaveLength(1);
    expect(mockLLM.lastPrompt).toContain('push open');
  });
});
```

### 3. Replay Tests (Deterministic)

```typescript
// packages/storage/tests/replay/ReplayEngine.test.ts
describe('Replay Engine', () => {
  it('replays session to identical final state', async () => {
    const session = await loadTestSession('adventure-001');
    const engine = new ReplayEngine();
    
    const replayedState = await engine.replayToEnd(session);
    const originalState = session.finalState;
    
    expect(replayedState).toEqual(originalState);
  });

  it('replays to specific turn correctly', async () => {
    const session = await loadTestSession('adventure-001');
    const engine = new ReplayEngine();
    
    const stateAtTurn50 = await engine.replayToTurn(session, 50);
    const snapshotAtTurn50 = session.snapshots.find(s => s.turn === 50);
    
    expect(stateAtTurn50).toEqual(snapshotAtTurn50.state);
  });
});
```

---

## Configuration Management

```typescript
// apps/server/src/config.ts
import { z } from 'zod';

const ConfigSchema = z.object({
  // Server
  port: z.number().default(3000),
  host: z.string().default('localhost'),
  
  // LLM
  llm: z.object({
    provider: z.enum(['openai', 'anthropic', 'ollama', 'mock']),
    model: z.string(),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    maxTokens: z.number().default(4096),
    temperature: z.number().default(0.7),
  }),
  
  // Storage
  storage: z.object({
    type: z.enum(['filesystem', 'sqlite', 'memory']),
    basePath: z.string().default('./data'),
    snapshotInterval: z.number().default(10), // turns
  }),
  
  // Debug
  debug: z.object({
    enabled: z.boolean().default(false),
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
    savePrompts: z.boolean().default(false),
    saveResponses: z.boolean().default(false),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    port: parseInt(process.env.PORT ?? '3000'),
    llm: {
      provider: process.env.LLM_PROVIDER ?? 'openai',
      model: process.env.LLM_MODEL ?? 'gpt-4o',
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_BASE_URL,
    },
    storage: {
      type: process.env.STORAGE_TYPE ?? 'filesystem',
      basePath: process.env.STORAGE_PATH ?? './data',
    },
    debug: {
      enabled: process.env.DEBUG === 'true',
      logLevel: process.env.LOG_LEVEL ?? 'info',
    },
  });
}
```

---

## Frontend Independence

The frontend is **completely independent** of the backend implementation:

```
Frontend knows about:
├── @llmrpg/protocol         # Message types only (Zod schemas)
└── WebSocket/REST API       # Transport layer

Frontend does NOT know about:
├── @llmrpg/core             # Game engine internals
├── @llmrpg/llm              # LLM adapters
├── @llmrpg/storage          # Persistence
└── Any backend logic
```

### Example Frontend Connection

```typescript
// apps/web/src/connection.ts
import { GameEventSchema, PlayerCommandSchema } from '@llmrpg/protocol';

export class GameConnection {
  private ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = this.handleMessage.bind(this);
  }

  private handleMessage(event: MessageEvent) {
    const parsed = GameEventSchema.safeParse(JSON.parse(event.data));
    if (parsed.success) {
      this.emit(parsed.data);
    }
  }

  sendCommand(command: PlayerCommand) {
    const validated = PlayerCommandSchema.parse(command);
    this.ws.send(JSON.stringify(validated));
  }
}
```

---

## Key Benefits Summary

| Concern | Solution |
|---------|----------|
| **Backend/Frontend Decoupling** | Protocol package with Zod schemas; event-driven communication |
| **Modularity** | Monorepo with isolated packages; dependency injection |
| **Testability** | Mock adapters for LLM and storage; pure core logic |
| **Debuggability** | Structured logging; state inspector; replay debugger; context debugger |
| **LLM Swapping** | Adapter pattern; all providers implement same interface |
| **Storage Flexibility** | Adapter pattern; memory for tests, SQLite/files for production |
| **Type Safety** | Strict TypeScript; Zod runtime validation |
| **Replay Verification** | Delta-based state; snapshot validation; deterministic replay |

---

## Getting Started

```bash
# Initialize monorepo
pnpm init
pnpm add -Dw typescript vitest @types/node

# Create workspace config
echo 'packages:\n  - "packages/*"\n  - "apps/*"' > pnpm-workspace.yaml

# Bootstrap packages
pnpm create @llmrpg/core
pnpm create @llmrpg/protocol
# etc.
```

See `PROJECT_SETUP.md` for detailed setup instructions.
