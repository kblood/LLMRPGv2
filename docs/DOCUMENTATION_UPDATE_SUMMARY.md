# Documentation Update Summary

## November 25, 2025 - Major Revisions

This document summarizes the key changes made to the LLMRPGv2 architecture.

---

## Key Changes

### 1. Terminology: Frames → Turns + Events

**Old Model (Frames)**
- Every action was a "frame"
- Frames were numbered sequentially
- Unclear relationship between time and actions

**New Model (Turns + Events)**
- **Turn**: A player's (or NPC's) opportunity to act
- **Event**: An atomic thing that happened (multiple per turn)
- **Scene**: A logical grouping of turns in one location
- **Round**: A complete cycle in structured conflict (combat)

### 2. Time Model

**Old Model**
- Vague frame-based progression
- Time passed implicitly

**New Model**
- **Narrative Time**: Flexible, story-driven (exploration)
- **Structured Time**: Precise, round-based (conflict)
- **GameTime Object**: Tracks day, time of day, hours
- **Time Costs**: Different actions advance time differently

### 3. Session Storage: Single File → Multi-File

**Old Model**
- One massive JSON file per session
- All data loaded at once
- Checkpoints embedded in same file

**New Model**
```
sessions/{sessionId}/
├── session.meta.json     # Metadata, quick load
├── world.state.json      # Current world state
├── player.state.json     # Current character state
├── scenes/               # One file per scene
├── turns/                # JSONL files (streaming)
├── deltas/               # Delta logs (JSONL) ← NEW
├── snapshots/            # Full state captures
└── indexes/              # Fast lookups
```

### 4. RPG System Foundation: Fate Core

We now build on **Fate Core** (CC BY 3.0 license):

**Four Actions**
- **Overcome**: Get past obstacles
- **Create Advantage**: Set up bonuses/aspects
- **Attack**: Harm in conflict
- **Defend**: Prevent harm

**Key Concepts Adopted**
- Aspects (narrative tags)
- Stress & Consequences (damage system)
- The Ladder (difficulty scale: -2 to +8)
- Fudge Dice (4dF: -4 to +4 range)
- Zones (movement in conflict)

### 5. Delta-Based State Tracking (NEW)

**Delta System**
- Every state change is recorded as a delta
- Deltas are atomic operations: set, delete, push, pull, increment
- Deltas enable fast replay without re-execution
- Path-based targeting (e.g., "player.stress.physical[0]")

**Snapshot System**
- Snapshots aggregate deltas into complete state
- Created every 100 turns or 500 deltas
- Also created at scene ends, conflict ends, significant events
- Enable fast jumps to any point in session

---

## New Documents Created

### `TURN_AND_ACTION_SYSTEM.md`
- Defines Turn/Event/Scene structure
- Maps Fate Core actions to our system
- Time model (narrative vs structured)
- Event types and schemas
- GameTime object specification

### `SESSION_FILE_ARCHITECTURE.md`
- Multi-file session structure
- File type specifications (including deltas/)
- Read/write operations with delta support
- Snapshot strategy integrated with deltas
- Error recovery
- Migration guide

### `FATE_MECHANICS_REFERENCE.md` ✅
- Quick reference for Fate rules we use
- Dice rolling (4dF implementation)
- Action resolution
- Stress/Consequences
- Aspects and invocation

### `DELTA_AND_SNAPSHOT_SYSTEM.md` ✅ (NEW)
- Delta operations and interfaces
- DeltaCollector class
- SnapshotManager class
- Replay engine using deltas
- File storage format
- Integration with turns and events

### `LLM_CONTEXT_AND_PROMPTS.md` ✅ (NEW)
- Context architecture (5 layers)
- Character definition system (personality, backstory, aspects)
- GM, NPC, and Player agent context structures
- Token budget and compression strategies
- Knowledge gating based on trust
- Prompt templates for each actor type
- Response parsing and validation
- Memory management

### `TECHNICAL_ARCHITECTURE.md` ✅ (NEW)
- TypeScript monorepo structure (pnpm workspaces)
- Packages: core, llm, storage, protocol, debug
- Ports and adapters (hexagonal architecture)
- Dependency injection with Inversify
- Event-driven frontend/backend communication
- Debug infrastructure (StateInspector, ReplayDebugger, ContextDebugger)
- Structured logging with Pino
- Testing strategy (unit, integration, replay)
- Configuration management with Zod

---

## Documents Updated

| Document | Changes Made |
|----------|-------------|
| `GAME_LOOP_FLOWCHART.md` | ✅ Replaced "frame" with "turn/event", added Fate actions |
| `SESSION_LOGGING_AND_REPLAY.md` | ✅ Updated to multi-file + delta model |
| `SESSION_FILE_ARCHITECTURE.md` | ✅ Added deltas/ directory, delta integration |
| `RPG_SYSTEM_INTEGRATION.md` | ✅ Added Fate mechanics, delta tracking |
| `README.md` | ✅ Updated terminology, added new docs |

---

## Documents Still Needed

### Priority 1 (Important)

1. **`PLAYER_CHARACTER_SYSTEM.md`**
   - Character creation using Fate
   - Skills and approaches
   - Stunts
   - Character advancement

3. **`COMBAT_SYSTEM_DEEP_DIVE.md`** (or merge into existing)
   - Fate conflict mechanics
   - Zones and movement
   - Attack/Defend actions
   - Concessions vs defeat

4. **`TESTING_STRATEGY.md`**
   - Unit tests
   - Integration tests
   - Replay verification via deltas

### Priority 2 (Nice to Have)

5. **`CONFIGURATION_AND_MODDING.md`**
6. **`ERROR_HANDLING_AND_RECOVERY.md`**
7. **`GLOSSARY.md`**

---

## Implementation Roadmap Update

### Phase 1: Core Systems (2 weeks)
1. Turn/Event logging system
2. Multi-file session management
3. Basic Fate dice rolling
4. GameTime tracking

### Phase 2: Character & Actions (1 week)
1. Player character (Fate-style)
2. Four Actions implementation
3. Skill checks

### Phase 3: World & NPCs (1 week)
1. Scene management
2. NPC system with schedules
3. Location generation

### Phase 4: Conflict System (1 week)
1. Structured time (rounds)
2. Zones and movement
3. Stress/Consequences
4. AI opponent behavior

### Phase 5: Knowledge & Quests (1 week)
1. Knowledge networks
2. Quest system
3. Aspect creation/discovery

### Phase 6: Polish (1 week)
1. Snapshot/recovery system
2. Replay functionality
3. Testing
4. Documentation

**Total: 7-8 weeks**

---

## Fate Core Attribution

This project incorporates mechanics from **Fate Core System**, a product of Evil Hat Productions, LLC, licensed under the [Creative Commons Attribution 3.0 Unported license](https://creativecommons.org/licenses/by/3.0/).

Fate™ is a trademark of Evil Hat Productions, LLC.

---

## Next Actions

1. ✅ Create `TURN_AND_ACTION_SYSTEM.md`
2. ✅ Create `SESSION_FILE_ARCHITECTURE.md`
3. ⏳ Create `FATE_MECHANICS_REFERENCE.md`
4. ⏳ Create `PLAYER_CHARACTER_SYSTEM.md`
5. ⏳ Update existing documents with new terminology
6. ⏳ Begin implementation

---

## Questions to Resolve

1. **Dice simulation**: Use actual random or seeded pseudo-random?
   - Recommendation: Seeded for determinism, logged for replay

2. **Fate Point economy**: How does AI GM compel aspects?
   - Needs design for automated compels

3. **Scene pacing**: How does GM know when to end scenes?
   - Needs heuristics for scene transition

4. **NPC skill levels**: Standard arrays or generated?
   - Recommendation: Templates with variation ranges
