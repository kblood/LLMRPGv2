# LLMRPGv2 - Game Master-Driven RPG with Session Logging

## Project Overview

LLMRPGv2 is a complete architectural redesign of an autonomous RPG system built on **Fate Core** mechanics (CC BY 3.0):

- **Game Master Control** - Narrative orchestration, encounter generation, pacing
- **Fate Core Foundation** - Four Actions, Aspects, Stress/Consequences
- **Dynamic World** - Locations generated on demand, NPCs with schedules
- **Turn-Based Sessions** - Every turn/event logged with delta tracking
- **Delta System** - State changes tracked for efficient replay
- **Snapshot Checkpoints** - Full state captures for fast jumps
- **Multi-File Storage** - Efficient session storage architecture
- **Resume System** - Exit and resume at any point
- **Deterministic** - Seeded dice rolls ensure reproducible gameplay

---

## ⚡ Recent Updates (Nov 2025)

- **Terminology Change**: "Frames" replaced with **Turns** and **Events**
- **Fate Core Integration**: Using Fate SRD mechanics (CC BY 3.0)
- **Delta System**: All state changes tracked as deltas for replay
- **Snapshot System**: Aggregated deltas into fast checkpoints
- **Multi-File Sessions**: Sessions now stored across multiple files
- **New Documents**: Delta system, turn system, session architecture, Fate reference

---

## Documentation Structure

### 📁 Folder Organization

```
LLMRPGv2/
├── docs/
│   │
│   │── ⭐ NEW DOCUMENTS ────────────────────────────
│   │
│   ├── DELTA_AND_SNAPSHOT_SYSTEM.md        ← NEW
│   │   └─ Delta operations (set, push, increment)
│   │   └─ State change tracking
│   │   └─ Snapshot creation & aggregation
│   │   └─ Replay engine using deltas
│   │
│   ├── LLM_CONTEXT_AND_PROMPTS.md          ← NEW
│   │   └─ Context architecture (5 layers)
│   │   └─ Character definitions (personality, backstory)
│   │   └─ GM, NPC, Player agent contexts
│   │   └─ Knowledge gating and trust
│   │   └─ Prompt templates and response parsing
│   │
│   ├── TECHNICAL_ARCHITECTURE.md            ← NEW
│   │   └─ TypeScript monorepo structure
│   │   └─ Ports and adapters (hexagonal)
│   │   └─ Dependency injection
│   │   └─ Debug tools (StateInspector, ReplayDebugger)
│   │   └─ Frontend/backend decoupling
│   │
│   ├── TURN_AND_ACTION_SYSTEM.md
│   │   └─ Turn/Event structure (replaces frames)
│   │   └─ Fate Core four actions
│   │   └─ Time model (narrative vs structured)
│   │   └─ Scene management
│   │
│   ├── SESSION_FILE_ARCHITECTURE.md
│   │   └─ Multi-file session storage
│   │   └─ JSONL turn + delta files
│   │   └─ Snapshot strategy with deltas
│   │   └─ File specifications
│   │
│   ├── FATE_MECHANICS_REFERENCE.md
│   │   └─ Quick reference for Fate rules
│   │   └─ Dice rolling (4dF)
│   │   └─ Aspects, Stress, Consequences
│   │   └─ The Ladder (difficulty scale)
│   │
│   ├── DOCUMENTATION_UPDATE_SUMMARY.md
│   │   └─ Summary of all changes
│   │   └─ Migration notes
│   │   └─ Remaining work
│   │
│   │── CORE DOCUMENTS (Updated) ───────────────────
│   │
│   ├── GAME_LOOP_FLOWCHART.md              ← UPDATED
│   │   └─ Turn-based game flow with Fate actions
│   │   └─ Overcome, Create Advantage loops
│   │   └─ Conflict system (Fate)
│   │   └─ Delta collection per turn
│   │
│   ├── WORLD_DEFINITION_AND_GENERATION.md
│   │   └─ 3-tier location hierarchy
│   │   └─ Dynamic location generation
│   │   └─ NPC knowledge networks
│   │   └─ Quest structures
│   │
│   ├── RPG_SYSTEM_INTEGRATION.md           ← UPDATED
│   │   └─ Complete system architecture
│   │   └─ Fate-based class designs
│   │   └─ Conflict with stress/consequences
│   │   └─ Delta collection integration
│   │
│   ├── RPG_GAME_MASTER_ARCHITECTURE.md
│   │   └─ Master overview of all systems
│   │   └─ How to read documentation
│   │   └─ Quick reference tables
│   │   └─ Implementation roadmap
│   │
│   ├── SESSION_LOGGING_AND_REPLAY.md       ← UPDATED
│   │   └─ Turn/Event + Delta logging
│   │   └─ Delta-based replay (fast)
│   │   └─ Snapshot checkpoints
│   │   └─ Jump to any turn
│   │   └─ Multi-file architecture
│   │
│   ├── SESSION_IMPLEMENTATION_GUIDE.md
│   │   └─ SessionLogger class design
│   │   └─ SessionLoader class design
│   │   └─ Game loop integration
│   │   └─ Example usage
│   │   └─ Performance notes
│   │
│   ├── THEME_SYSTEM_AND_WORLD_COHESION.md
│   │   └─ Theme architecture and pillars
│   │   └─ How themes define worlds
│   │   └─ Theme expansion during session
│   │   └─ Maintaining thematic coherence
│   │   └─ Theme templates (cyberpunk, fantasy, etc)
│   │
│   ├── NPC_AND_PLAYER_KNOWLEDGE_SYSTEM.md
│   │   └─ NPC knowledge profiles
│   │   └─ Player knowledge discovery
│   │   └─ Knowledge gates and constraints
│   │   └─ Gossip networks and spread
│   │   └─ Knowledge decay and updates
│   │   └─ Integration with sessions
│   │
│   └── SESSION_THEME_EXPANSION_AND_KNOWLEDGE.md
│       └─ Theme initialization from seed
│       └─ World generation from theme
│       └─ Theme expansion as player explores
│       └─ Knowledge discovery deepens theme
│       └─ Complete session flow example
│
├── src/ (will contain implementation)
│   ├── core/
│   ├── systems/
│   ├── services/
│   └── utils/
│
├── tests/ (will contain test suite)
└── README.md (this file)
```

---

## Key Features

### 1. Game Master-Driven Narrative
- GM orchestrates all story elements
- Dynamic encounter generation
- Paced progression
- Story-aware decisions

### 2. Location-Based World
- Pre-defined cities/quests
- Semi-defined district frameworks
- Dynamically generated on visit
- Fleshed out with sub-locations, NPCs, items

### 3. NPC System with Knowledge
- NPCs exist at specific locations
- Daily schedules (morning/noon/evening)
- Knowledge networks (who knows what)
- Relationship tracking

### 4. Multi-Path Quests
- Direct ask method
- Referral chains
- Investigation/exploration
- Gossip/rumors

### 5. Session Logging & Replay
- Every action logged to disk
- Jump to any frame in session
- Resume from any point
- Fully deterministic replay
- No separate "save" files needed

### 6. Deterministic Gameplay
- All LLM calls seeded
- All randomness tracked
- Replay ensures same results
- Verifiable playthroughs

---

## Quick Start Reading Guide

### For Designers (30 minutes)
1. Read: `RPG_GAME_MASTER_ARCHITECTURE.md` (overview)
2. Skim: `GAME_LOOP_FLOWCHART.md` (diagrams)
3. Review: `FATE_MECHANICS_REFERENCE.md` (core rules)

### For Architects (2 hours)
1. Read: `GAME_LOOP_FLOWCHART.md` (complete)
2. Read: `WORLD_DEFINITION_AND_GENERATION.md` (complete)
3. Study: `RPG_SYSTEM_INTEGRATION.md` (architecture)
4. Understand: `DELTA_AND_SNAPSHOT_SYSTEM.md` (state tracking)
5. Review: `SESSION_FILE_ARCHITECTURE.md` (storage)

### For Developers Ready to Code (3+ hours)
1. Study: `FATE_MECHANICS_REFERENCE.md` (rules to implement)
2. Study: `TURN_AND_ACTION_SYSTEM.md` (turn structure)
3. Study: `DELTA_AND_SNAPSHOT_SYSTEM.md` (state management)
4. Study: `RPG_SYSTEM_INTEGRATION.md` (class structures)
5. Study: `SESSION_IMPLEMENTATION_GUIDE.md` (detailed implementation)
6. Reference: `GAME_LOOP_FLOWCHART.md` (for data flows)
4. Use: `WORLD_DEFINITION_AND_GENERATION.md` (for data schemas)

---

## Document Quick Reference

| Document | Purpose | Best For |
|----------|---------|----------|
| RPG_GAME_MASTER_ARCHITECTURE | Master overview | Overview, quick ref |
| GAME_LOOP_FLOWCHART | Game flow structure | Understanding game loop |
| WORLD_DEFINITION_AND_GENERATION | World architecture | Understanding world/NPCs |
| RPG_SYSTEM_INTEGRATION | Technical design | System architecture |
| SESSION_LOGGING_AND_REPLAY | Session system | Understanding logging |
| SESSION_IMPLEMENTATION_GUIDE | Implementation details | Writing actual code |
| THEME_SYSTEM_AND_WORLD_COHESION | Theme design | World coherence |
| NPC_AND_PLAYER_KNOWLEDGE_SYSTEM | Knowledge mechanics | Quest discovery |
| SESSION_THEME_EXPANSION_AND_KNOWLEDGE | Integration | Complete session flow |

---

## Core Concepts

### Game Loop (Each Frame/Turn)

```
1. Get Player Action
   └─ Travel, interact, rest, etc

2. GameMaster Processes
   └─ Decide consequences, generate content

3. Execute Action
   ├─ Travel Loop (with encounters)
   ├─ Interaction Loop (NPC dialogue)
   ├─ Combat Loop (turn-based)
   └─ Other actions

4. Log to Session
   └─ Every action becomes a frame

5. Update World State
   └─ NPCs move, time passes, quests progress

6. Checkpoint (if needed)
   └─ Full state save for fast jump/replay
```

### 3-Tier World System

**Tier 1: Pre-Defined** (You design once)
- Main quest hubs
- Starting location
- Critical NPCs

**Tier 2: Semi-Defined** (Framework)
- District types
- NPC roles
- Quest structures

**Tier 3: Dynamic** (Generated on visit)
- Sub-locations (5-8 per location)
- NPCs (3-5 specific to location)
- Items, encounters, details

### Session Logging

```
Instead of discrete saves:

Every frame becomes a log entry:
├─ Frame 0: Session start
├─ Frame 1: Player action
├─ Frame 2: NPC interaction
├─ Frame 3: Combat round
└─ ... (all the way to current frame)

Session file = complete replay ability
Can jump to any frame and continue
```

---

## Implementation Roadmap

### Phase 1: Game Loop & Travel (1-2 weeks)
- Implement game loop structure
- Travel with narration
- Basic encounter generation

### Phase 2: Location System (1 week)
- Pre-define starter locations
- Dynamic fleshing on visit
- Location caching

### Phase 3: NPC System (1 week)
- Location-based placement
- Schedules
- Interaction loop

### Phase 4: Knowledge & Quests (1 week)
- Knowledge network
- Quest-enhanced data
- Multi-path discovery

### Phase 5: Combat & Polish (1 week)
- Story-aware combat
- Final content generation
- Balance & testing

### Phase 6: Session System (1 week)
- Session logging
- Checkpoint system
- Jump & replay functionality

**Total: 5-7 weeks**

---

## Key Design Principles

1. **Game Master Controls Story**
   - GM makes narrative decisions
   - GM generates content
   - GM paces progression

2. **Locations Are Location-Based**
   - NPCs exist in specific places
   - Must visit to find them
   - Discovered dynamically

3. **Knowledge Is Power**
   - NPCs know different things
   - Information has barriers
   - Knowledge forms networks

4. **Story Flows**
   - Quests guide but don't force
   - Multiple paths to objectives
   - Consequences matter

5. **Sessions Are First-Class**
   - Every action is logged
   - Complete replay ability
   - Deterministic verification

---

## System Architecture

```
┌─────────────────────────────────────────┐
│         GAME MASTER (Orchestrator)     │
└────────┬────────────────┬───────────────┘
         │                │
    ┌────▼────┐      ┌────▼────┐
    │  WORLD  │      │   NPC   │
    │ SYSTEM  │      │ SYSTEM  │
    └────┬────┘      └────┬────┘
         │                │
    ┌────▼────────────────▼────┐
    │    SESSION LOGGER        │
    │  (Logs every action)     │
    └────┬────────────────────┘
         │
    ┌────▼────────────────┐
    │  DISK STORAGE       │
    │ (Sessions & Checks) │
    └─────────────────────┘
```

---

## Example: Quest Discovery

Quest: "Find the Lab"

**Path 1: Ask NPC Directly**
```
Player: "Where is the lab?"
Khaosbyte: "Industrial sector, somewhere"
(Objective progresses)
```

**Path 2: Get Referral**
```
Player: "Who knows about labs?"
Guard: "Try Khaosbyte at the cafe"
(Travel to cafe, talk to her)
```

**Path 3: Explore**
```
Travel to Industrial Sector
└─ GameMaster generates 8 sub-locations
└─ Player explores and discovers lab
(Objective completes)
```

All paths lead to same goal with different experiences.

---

## Development Status

✅ **Design Complete** - All systems fully designed and documented
📋 **Ready for Implementation** - Architectural details provided
⏳ **Next Phase** - Begin coding Phase 1

---

## File Contents Summary

### SESSION_LOGGING_AND_REPLAY.md (18 KB)
- Session vs save concepts
- Frame types and structures
- Checkpoint strategy
- Replay and jump mechanics
- Determinism verification
- File structure and organization
- API overview
- Benefits and comparison

### SESSION_IMPLEMENTATION_GUIDE.md (21 KB)
- Architecture overview diagram
- SessionLogger class (complete)
- SessionLoader class (complete)
- Game loop integration
- Example usage patterns
- Performance analysis
- Error handling
- Implementation checklist

### OTHER_DOCUMENTS (95 KB)
- GAME_LOOP_FLOWCHART.md - Complete game loop flows
- WORLD_DEFINITION_AND_GENERATION.md - World architecture
- RPG_SYSTEM_INTEGRATION.md - System design
- RPG_GAME_MASTER_ARCHITECTURE.md - Master overview

---

## Getting Started

### To Understand the Vision
1. Read `RPG_GAME_MASTER_ARCHITECTURE.md`
2. Review `GAME_LOOP_FLOWCHART.md` diagrams
3. Skim `SESSION_LOGGING_AND_REPLAY.md`

### To Understand the Implementation
1. Study `RPG_SYSTEM_INTEGRATION.md`
2. Study `SESSION_IMPLEMENTATION_GUIDE.md`
3. Reference architecture docs as needed

### To Begin Development
1. Create src/ folder structure
2. Implement core classes (GameMaster, World, NPC)
3. Implement game loop
4. Implement SessionLogger
5. Integrate and test

---

## Next Steps

1. **Review Documentation** - Read through all documents
2. **Create Project Structure** - Set up src/ folders
3. **Implement Phase 1** - Game loop & travel system
4. **Test Core Loop** - Verify frame logging works
5. **Expand to Phase 2** - Location system
6. **Continue Phases** - 3-6 per roadmap

---

## Questions?

Refer to the specific document for your question:

- **"How does the game loop work?"** → GAME_LOOP_FLOWCHART.md
- **"How are locations generated?"** → WORLD_DEFINITION_AND_GENERATION.md
- **"How should I structure the code?"** → RPG_SYSTEM_INTEGRATION.md
- **"How does session logging work?"** → SESSION_LOGGING_AND_REPLAY.md
- **"How do I implement it?"** → SESSION_IMPLEMENTATION_GUIDE.md

---

**Project Status:** ✅ Design Complete - Ready for Implementation
**Last Updated:** November 25, 2025
**Total Documentation:** ~130 KB across 6 comprehensive documents
