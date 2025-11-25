# LLMRPGv2 - AI Coding Agent Instructions

## Project Overview

LLMRPGv2 is an **architectural design specification** (documentation-only) for an AI-driven RPG system built on **Fate Core** mechanics (CC BY 3.0). This is NOT an implementation—it's a comprehensive design blueprint for future TypeScript development.

## Architecture Summary

### Core Components
- **GameMaster System** - Orchestrates narrative, generates encounters, controls pacing
- **Delta/Snapshot System** - Tracks all state changes as incremental deltas; snapshots for fast replay
- **Turn/Event System** - Turn-based gameplay replacing "frames" terminology (see `docs/TURN_AND_ACTION_SYSTEM.md`)
- **Knowledge System** - Gates information flow between NPCs/players via relationships, trust, factions
- **Theme System** - Defines world DNA (setting, values, problems, solutions, archetypes)

### Planned Tech Stack (from `docs/TECHNICAL_ARCHITECTURE.md`)
```
Frontend: React/Vue/Svelte/CLI (decoupled)
Backend: Node.js 20+ / Bun, TypeScript 5.x strict
Storage: SQLite + JSONL files for sessions
LLM: OpenAI/Anthropic/Ollama via adapters
Monorepo: pnpm workspaces (packages: core, llm, storage, protocol, debug)
```

## Key Design Patterns

### Delta Operations
All state changes use typed delta operations—never mutate state directly:
```typescript
// From docs/DELTA_AND_SNAPSHOT_SYSTEM.md
type DeltaOperation = "set" | "increment" | "append" | "remove" | "create" | "destroy";
type DeltaTarget = "player" | "npc" | "location" | "scene" | "world" | "quest" | "knowledge";
```

### Fate Core Integration
Actions map to Fate's four actions: `overcome`, `createAdvantage`, `attack`, `defend`. Use the Fate ladder for difficulty (Mediocre +0 to Legendary +8). Reference `docs/FATE_MECHANICS_REFERENCE.md`.

### Session File Structure
Sessions use **multi-file architecture** (not single files):
```
sessions/{sessionId}/
├── session.meta.json     # Load first
├── world.state.json
├── player.state.json
├── turns/*.jsonl         # Append-only turn logs
├── deltas/*.jsonl        # State change logs
├── snapshots/*.json      # Full state captures
└── indexes/*.json        # Fast lookups
```

### LLM Context Layers (5 layers from `docs/LLM_CONTEXT_AND_PROMPTS.md`)
1. **System Prompt** - Role, Fate rules, response format
2. **Character Definition** - Identity, aspects, personality, skills
3. **World State** - Current scene, characters present, active aspects
4. **Conversation History** - Rolling window of recent turns
5. **Immediate Context** - Current action, dice rolls, required response type

## Document Map

| Document | Purpose |
|----------|---------|
| `DELTA_AND_SNAPSHOT_SYSTEM.md` | State tracking, replay engine |
| `TURN_AND_ACTION_SYSTEM.md` | Turn/Event structure, time model |
| `SESSION_FILE_ARCHITECTURE.md` | Multi-file storage specs |
| `LLM_CONTEXT_AND_PROMPTS.md` | Context building, prompt templates |
| `RPG_SYSTEM_INTEGRATION.md` | Component integration diagram |
| `THEME_SYSTEM_AND_WORLD_COHESION.md` | Theme DNA, world consistency |
| `NPC_AND_PLAYER_KNOWLEDGE_SYSTEM.md` | Knowledge gating, discovery |

## Implementation Guidelines

### When Adding New State
1. Define the delta operation type and target
2. Record `previousValue` for undo/verification
3. Link delta to causing event via `eventId`
4. Update relevant indexes

### When Defining Characters/NPCs
Follow `CharacterDefinition` interface: `highConcept`, `trouble`, aspects (3), personality, backstory, skills, stress tracks, relationships, knowledge scope.

### When Implementing Game Actions
1. Map player intent → Fate action type
2. Set opposition (difficulty or opposed roll)
3. Roll 4dF + skill, calculate shifts
4. Generate events based on outcome
5. Collect deltas from events
6. Return `{ turn, events, deltas, narration }`

## Implementation Roadmap

Recommended development order to minimize dependency cycles:

1. **`packages/core`** (High Priority)
   - Pure domain logic, no external dependencies
   - Implement `GameMaster`, `TurnManager`, `FateDice`, `Character`
   - Define all core Interfaces and Types

2. **`packages/storage`**
   - File system and database adapters
   - Implement `SessionWriter`, `SessionLoader`, `DeltaLogger`
   - Depends on `core` types

3. **`packages/llm`**
   - AI provider adapters (OpenAI, Ollama)
   - Context building and prompt management
   - Depends on `core` state definitions

4. **`packages/protocol`** & **`packages/debug`**
   - API schemas and developer tools
   - Can be built in parallel with LLM layer

## Development Standards

### Code Style & Conventions
- **Strong Typing**: Use strict TypeScript. Avoid `any`. Define interfaces for all data structures.
- **Interfaces vs Classes**: Prefer Interfaces for data (State, Config) and Classes for logic/behavior (Managers, Engines).
- **Naming**:
  - Classes/Interfaces/Types: `PascalCase` (e.g., `GameMaster`, `TurnContext`)
  - Variables/Functions: `camelCase` (e.g., `calculateDamage`, `currentTurn`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_ASPECTS`)
- **Brace Style**: While C# uses Allman style (braces on new lines), the TypeScript ecosystem (Prettier/ESLint) strongly defaults to K&R (opening brace on same line). *Recommendation: Use standard TypeScript formatting to ensure compatibility with tooling.*

### Testing Strategy
- **Framework**: Vitest (fast, native TS support)
- **Unit Tests**: Co-locate with source or in `tests/` folder within each package.
- **Mocking**:
  - Mock LLM responses for deterministic tests.
  - Mock File System for storage tests.
- **Coverage**: Focus on complex logic in `core` (Dice math, State transitions) over boilerplate.

## Terminology

| Term | Definition |
|------|------------|
| **Turn** | A player's opportunity to act (contains events) |
| **Event** | Single atomic game occurrence |
| **Scene** | Logical grouping of turns at one location |
| **Delta** | Incremental state change record |
| **Snapshot** | Full state capture at specific turn |
| **Aspect** | Fate narrative tag (can be invoked/compelled) |
| **Shifts** | Margin of success/failure on rolls |

## Notes for AI Agents

- This project is **documentation/specification only**—no source code to run or test
- All examples are pseudocode/JavaScript showing intended patterns
- Cross-reference documents heavily; they're designed to work together
- The Fate Core SRD (https://fate-srd.com) is the mechanical foundation
- "Frames" is deprecated terminology—use "Turns" and "Events"
