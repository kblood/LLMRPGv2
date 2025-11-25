# Session Logging & Replay System - Complete Design

## Overview

The session logging and replay system serves dual purposes:
1. **Save System** - Exit and resume games
2. **Replay System** - Jump to any point and continue from there

Instead of discrete "saves", the game continuously logs every action. The entire session becomes the save data.

**Related Documents:**
- [Session File Architecture](./SESSION_FILE_ARCHITECTURE.md) - Multi-file storage structure
- [Delta and Snapshot System](./DELTA_AND_SNAPSHOT_SYSTEM.md) - State change tracking
- [Turn and Action System](./TURN_AND_ACTION_SYSTEM.md) - Turn/Event definitions
- [Fate Mechanics Reference](./FATE_MECHANICS_REFERENCE.md) - Core RPG mechanics

---

## Core Concept

```
SESSION = Complete Log of All Turns + Deltas

┌────────────────────────────────────────┐
│          GAME SESSION                  │
│                                        │
│  Turn 0:   Game Start                 │
│  Turn 1:   Player moved to location   │
│  Turn 2:   Player talked to NPC       │
│  Turn 3:   Conflict started           │
│  Turn 4:   Player attacked (Overcome) │
│  Turn 5:   NPC conceded               │
│  Turn 6:   Quest completed            │
│  ...                                   │
│  Turn N:   Current turn               │
│                                        │
│  Deltas track every state change       │
│  Snapshots aggregate deltas every 100  │
└────────────────────────────────────────┘

Key Points:
• Every turn contains logged events
• Deltas track all state changes
• State is deterministic (can replay to any turn)
• Can exit/resume at any point
• Can jump to any previous turn and continue
• Multiple saves of same session possible
```

---

## Session Data Structure

Sessions use a **multi-file architecture** rather than a single large file. See [Session File Architecture](./SESSION_FILE_ARCHITECTURE.md) for complete details.

### Directory Structure Overview

```
sessions/active/{sessionId}/
├── session.meta.json      # Session metadata
├── world.state.json       # Current world state
├── player.state.json      # Current player state
├── scenes/                # Scene files
├── turns/                 # Turn log files (JSONL)
├── deltas/                # Delta log files (JSONL)
├── snapshots/             # Full state snapshots
└── indexes/               # Fast lookup indexes
```

### Turn File Format (JSONL)

### Turn File Format (JSONL)

Turns are stored in JSONL format for streaming writes:

```jsonl
{"turnId":1,"sceneId":"scene-001","actor":"player","timestamp":1732557777632,"gameTime":{"day":1,"timeOfDay":"morning"},"actions":[{"type":"travel","destination":"temple-district","fateAction":"overcome"}],"events":[{"eventId":"abc123-1-1","type":"travel","description":"You travel through winding streets..."}],"rollData":{"skill":"Athletics","modifier":2,"difficulty":1,"dice":[1,-1,0,1],"result":3}}
{"turnId":2,"sceneId":"scene-001","actor":"player","timestamp":1732557777750,"gameTime":{"day":1,"timeOfDay":"morning"},"actions":[{"type":"interact","target":"npc-khaosbyte","fateAction":"createAdvantage"}],"events":[{"eventId":"abc123-2-1","type":"npc_interaction","description":"Khaosbyte leans in..."}],"llmDetails":{"seed":445566,"model":"granite4:latest"}}
```

### Delta File Format (JSONL)

Deltas track every state change:

```jsonl
{"deltaId":"delta-abc123-1-1","turnId":1,"eventId":"abc123-1-1","scope":"player","deltas":[{"op":"set","path":"location.id","value":"temple-district","previousValue":"city-starting"}]}
{"deltaId":"delta-abc123-2-1","turnId":2,"eventId":"abc123-2-1","scope":"world","deltas":[{"op":"increment","path":"npcs.npc-khaosbyte.relationship","value":5},{"op":"push","path":"npcs.npc-khaosbyte.knownFacts","value":"met-player"}]}
```

See [Delta and Snapshot System](./DELTA_AND_SNAPSHOT_SYSTEM.md) for complete delta documentation.

---

## Turn Types & Structure

### Session Management Turns

```javascript
// Turn: session_start
{
  turnId: 0,
  type: "session_start",
  events: [{
    eventId: "abc123-0-1",
    type: "session_start",
    data: {
      player: { /* initial player state */ },
      world: { /* initial world state */ }
    }
  }]
}

// Turn: session_end
{
  turnId: 450,
  type: "session_end",
  events: [{
    eventId: "abc123-450-1",
    type: "session_end",
    data: {
      reason: "player_quit" | "death" | "victory",
      finalStats: { /* ... */ }
    }
  }]
}
```

### Player Action Turns

```javascript
// Turn: player_action (using Fate mechanics)
{
  turnId: 15,
  sceneId: "scene-003",
  actor: "player",
  timestamp: 1732557777632,
  gameTime: { day: 1, timeOfDay: "afternoon" },
  
  actions: [{
    type: "travel",
    fateAction: "overcome",  // Fate action type
    destination: "temple-district",
    skill: "Athletics",      // Skill used
    opposition: 1            // Fair (+1) difficulty
  }],
  
  events: [{
    eventId: "abc123-15-1",
    type: "travel",
    description: "You travel through winding streets...",
    outcome: "success"  // Fate outcome
  }],
  
  // Fate dice roll
  rollData: {
    skill: "Athletics",
    skillRating: 2,  // Fair (+2)
    dice: [1, -1, 0, 1],  // 4dF roll
    total: 3,  // 2 + 1 = 3
    difficulty: 1,
    shifts: 2,  // Success with 2 shifts
    aspectsInvoked: []
  },
  
  // LLM narration
  llmUsed: {
    forWhat: "travel_narration",
    seed: 123456,
    model: "granite4:latest",
    response: "You travel through winding streets..."
  }
}
```

### NPC Interaction Turns

```javascript
{
  turnId: 16,
  sceneId: "scene-003",
  actor: "player",
  timestamp: 1732557777750,
  gameTime: { day: 1, timeOfDay: "afternoon" },
  
  actions: [{
    type: "interact",
    fateAction: "createAdvantage",  // Creating an aspect
    target: "npc-khaosbyte",
    skill: "Rapport"
  }],
  
  events: [{
    eventId: "abc123-16-1",
    type: "npc_interaction",
    description: "Khaosbyte leans in conspiratorially...",
    npcResponse: "I heard it's in industrial sector",
    aspectCreated: "Khaosbyte Trusts You"  // New aspect
  }],
  
  rollData: {
    skill: "Rapport",
    skillRating: 2,
    dice: [0, 1, 1, 0],
    total: 4,
    difficulty: 2,
    shifts: 2,
    outcome: "success_with_style"
  },
  
  llmDetails: {
    seed: 445566,
    model: "granite4:latest",
    prompt: "Khaosbyte knows...",
    tokensUsed: 87
  }
}
```

### World Event Turns

```javascript
// Turn: location_generated
{
  turnId: 45,
  actor: "gm",
  type: "world_event",
  events: [{
    eventId: "abc123-45-1",
    type: "location_generated",
    locationId: "temple-district",
    subLocations: [ /* generated */ ],
    npcs: [ /* generated */ ],
    llmSeed: 123456
  }]
}

// Turn: npc_schedule_update (GM turn, no player action)
{
  turnId: 100,
  actor: "gm",
  type: "world_event",
  events: [{
    eventId: "abc123-100-1",
    type: "npc_movement",
    updates: [
      {
        npcId: "npc-khaosbyte",
        oldLocation: "downtown-cafe",
        newLocation: "nightlife-bar",
        reason: "schedule"
      }
    ]
  }]
}

// Turn: quest_progress
{
  turnId: 120,
  actor: "gm",
  type: "world_event",
  events: [{
    eventId: "abc123-120-1",
    type: "quest_progress",
    questId: "main-001",
    oldProgress: 30,
    newProgress: 45,
    objective: "Find the Lab",
    reason: "discovered_location"
  }]
}
```

---

## Snapshots & Delta-Based Replay

### Snapshot Strategy

Snapshots aggregate deltas into complete state. They serve as efficient jump points.

```javascript
// Snapshot triggers:
const SNAPSHOT_TRIGGERS = {
  turnInterval: 100,        // Every 100 turns
  deltaThreshold: 500,      // Every 500 deltas
  sceneEnd: true,           // When scene ends
  conflictEnd: true,        // When conflict resolves
  significantEvent: true,   // Quest completion, etc.
  manual: true,             // Player request
  sessionEnd: true          // Always on exit
};
```

### Snapshot Storage

Snapshots are stored in `snapshots/` directory:

```javascript
// snapshots/snapshot-0100.json
{
  snapshotId: "snapshot-0100",
  turnId: 100,
  timestamp: "2025-11-25T12:00:00Z",
  reason: "turn_interval",
  
  // Delta aggregation metadata
  deltaAggregation: {
    fromSnapshot: null,  // First snapshot
    deltasAggregated: 312,
    turnRange: [1, 100]
  },
  
  // Complete state (result of applying all deltas)
  worldState: { /* full world state */ },
  playerState: { /* full player state */ },
  activeScene: { /* current scene */ },
  
  // Verification
  checksums: {
    worldState: "sha256:abc...",
    playerState: "sha256:def..."
  }
}
```

---

## Replay & Jump System

### Replay Using Deltas

```
User: "Jump to turn 250"
│
├─ Find nearest snapshot (turn 200)
├─ Load snapshot state
├─ Load deltas for turns 201-250
├─ Apply deltas sequentially
│  (fast, deterministic, no re-rolling)
└─ Game state at turn 250 ready

Delta Replay Advantages:
• No need to re-run LLM calls
• No need to re-roll dice
• Just apply recorded state changes
• Very fast (milliseconds)
```

### Jump Implementation

```javascript
async function jumpToTurn(sessionId, targetTurn) {
  // Find nearest snapshot
  const snapshot = await findNearestSnapshot(sessionId, targetTurn);
  
  // Load snapshot as base state
  let worldState = deepClone(snapshot.worldState);
  let playerState = deepClone(snapshot.playerState);
  
  // Load deltas from snapshot to target
  const deltas = await loadDeltasRange(
    sessionId, 
    snapshot.turnId + 1, 
    targetTurn
  );
  
  // Apply each delta
  for (const deltaGroup of deltas) {
    if (deltaGroup.scope === 'world') {
      worldState = applyDeltas(worldState, deltaGroup.deltas);
    } else if (deltaGroup.scope === 'player') {
      playerState = applyDeltas(playerState, deltaGroup.deltas);
    }
  }
  
  return { worldState, playerState, turn: targetTurn };
}
```

### Jump Points

```javascript
// Player can jump to:

1. SNAPSHOT TURNS
   "Jump to snapshot 3" → Turn 300
   
2. MAJOR EVENTS
   "Jump to conflict start" → Turn 123
   
3. TURN NUMBERS
   "Jump to turn 250"
   
4. NAMED SAVE POINTS
   "Jump to: Before Boss Fight"
   
5. QUEST MILESTONES
   "Jump to when I completed: Main Quest Objective 2"
   
6. SCENE STARTS
   "Jump to scene 5"
```

### Replay Modes

```javascript
INSTANT_JUMP: {
  // Delta-based jump (fast, state only)
  fromTurn: 400,
  toTurn: 250,
  method: "delta_replay",
  continueFrom: 250
}

NARRATIVE_REPLAY: {
  // Re-read the story with narration
  fromTurn: 0,
  toTurn: 400,
  speed: "1x" | "2x" | "skip",
  showNarration: true,
  showDiceRolls: true
}

DEBUG_REPLAY: {
  // Detailed replay with turn-by-turn analysis
  fromTurn: 100,
  toTurn: 120,
  showDetails: {
    llmCalls: true,
    diceSeeds: true,
    deltas: true,
    fatePoints: true
  }
}
```

---

## Session Resume

### Exiting a Session

```javascript
// User: "Save and Exit"
│
├─ Flush pending turns to turn file
├─ Flush pending deltas to delta file
├─ Create snapshot at current turn
├─ Update session.meta.json
├─ Move session to paused/ directory
│
└─ Session can be resumed later
```

### Resuming a Session

```javascript
// User: "Load session abc123"
│
├─ Load session.meta.json
├─ Load latest snapshot (or current state files)
├─ Display session summary:
│   "Last played: 2 hours ago"
│   "Turn: 342"
│   "Current objective: Find the hideout"
│   "Location: Industrial Sector"
│
├─ Option: Resume from last turn (342)
├─ Option: Jump to earlier turn/snapshot
└─ Option: Restart from beginning
```

### Multi-Session Support

```javascript
// Player can have multiple sessions in different directories

sessions/
├── active/
│   └── session-cyberpunk-current/   # Currently playing
├── paused/
│   ├── session-cyberpunk-001/       # Turn 342 (paused)
│   └── session-cyberpunk-002/       # Turn 600 (different choices)
└── completed/
    └── session-cyberpunk-003/       # Finished playthrough
```

---

## Delta-Based Replay vs Traditional Replay

### Delta Replay (Recommended)

With the delta system, replay doesn't re-execute anything:

```javascript
// Delta replay: Apply recorded state changes
// • No LLM calls needed
// • No dice re-rolling needed  
// • Just apply delta operations to state
// • Fast: milliseconds to jump anywhere

jumpToTurn(250):
  Load snapshot at turn 200
  Apply 50 turns worth of deltas
  Done in ~10ms
```

### Traditional Replay (For Verification)

Still supported for debugging:

```javascript
// Traditional replay: Re-execute with stored seeds
// • Uses stored LLM seeds for same responses
// • Uses stored dice seeds for same rolls
// • Slower but verifies determinism

1. LLM CALLS
   - Stored seed + prompt → same response
   
2. FATE DICE ROLLS
   - Stored seed → same 4dF result
   
3. NPC BEHAVIOR  
   - Deterministic from game state
```

### Determinism Verification

```javascript
// Compare delta replay vs traditional replay

VERIFICATION_RESULT: {
  turn: 250,
  deltaReplayState: { /* state via deltas */ },
  traditionalReplayState: { /* state via re-execution */ },
  match: true,  // Should always match
  status: "✅ Deterministic"
}
}
```

---

## File Structure

See [Session File Architecture](./SESSION_FILE_ARCHITECTURE.md) for complete details.

```
sessions/
├── active/
│   └── {sessionId}/
│       ├── session.meta.json
│       ├── world.state.json
│       ├── player.state.json
│       ├── scenes/
│       ├── turns/           # Turn logs (JSONL)
│       ├── deltas/          # Delta logs (JSONL)
│       ├── snapshots/       # Full state snapshots
│       └── indexes/
│
├── paused/
│   └── {sessionId}/         # Same structure
│
├── completed/
│   └── {sessionId}/         # Same structure
│
└── archives/
    └── {sessionId}.tar.gz   # Compressed completed sessions
```

---

## Session API

### Core Methods

```javascript
class SessionManager {
  // Start new session
  startSession(worldTheme, playerName, difficulty) {
    // Creates session directory structure
    // Initializes metadata, state files
    // Returns: sessionId
  }

  // Log a turn and its deltas
  logTurn(turn, deltas) {
    // Appends turn to turns file
    // Appends deltas to deltas file
    // Updates indexes
  }

  // Create snapshot (aggregates deltas)
  createSnapshot(reason) {
    // Save full state at current turn
    // Record delta aggregation info
  }

  // Save and exit
  saveSession(sessionId) {
    // Flush pending writes
    // Create final snapshot
    // Move to paused/ directory
  }

  // Load session
  loadSession(sessionId) {
    // Load metadata
    // Load current state files
    // Ready to resume or replay
  }

  // Jump to turn (delta-based)
  jumpToTurn(sessionId, targetTurn) {
    // Find nearest snapshot
    // Apply deltas to reach target
    // Return game state at target turn
  }

  // List all sessions
  listSessions() {
    // Return all sessions with metadata
  }

  // Delete session
  deleteSession(sessionId) {
    // Remove session directory
  }
}
```

### Usage Example

```javascript
// Start new game
const sessionId = sessionManager.startSession(
  "cyberpunk",
  "Protagonist",
  "normal"
);

// Play the game
for (let turn = 1; turn <= 450; turn++) {
  const action = getPlayerAction();
  const result = processAction(action);
  const deltas = collectDeltas();  // State changes
  
  // Log turn and deltas
  sessionManager.logTurn(
    { turnId: turn, ...result },
    deltas
  );
  
  // Snapshot every 100 turns
  if (turn % 100 === 0) {
    sessionManager.createSnapshot('turn_interval');
  }
}

// Save and exit
sessionManager.saveSession(sessionId);

// Later: Load and resume
const session = sessionManager.loadSession(sessionId);
const currentTurn = session.getCurrentTurn();  // 450

// Or jump to earlier turn (uses deltas)
const earlierState = sessionManager.jumpToTurn(sessionId, 250);
```

---

## Benefits of This System

### As Save System
✅ Automatic saving (every turn + deltas logged)
✅ No need to manually save
✅ Exit/resume seamlessly
✅ Multiple sessions with different choices

### As Replay System
✅ Jump to any turn instantly (via deltas)
✅ No re-execution needed for jumps
✅ Full history preserved
✅ Share playthroughs
✅ Debug exact state at any point

### Delta-Specific Benefits
✅ Fast jumps (apply deltas, don't re-execute)
✅ Efficient storage (deltas smaller than full states)
✅ Precise state reconstruction
✅ Easy to verify (compare snapshots)

### Additional Benefits
✅ Session analytics (what choices did player make?)
✅ AI training data (real player/LLM choices)
✅ Bug reproduction (exact state at any turn)
✅ Fate dice analysis (roll distributions)

---

## Comparison: Traditional vs Delta-Based Replay

```
TRADITIONAL REPLAY:
• Re-execute every action
• Need stored seeds for determinism
• Slow for long sessions
• LLM calls may vary

DELTA-BASED REPLAY:
• Apply recorded state changes
• No re-execution needed
• Fast regardless of session length
• Perfect accuracy guaranteed
• Snapshots provide checkpoints
```

---

## Implementation Considerations

### Storage (with Deltas)

```
Average session: ~450 turns
Per turn: ~500 bytes (JSONL line)
Per delta group: ~200 bytes
Total turns: ~225 KB
Total deltas: ~150 KB
Snapshots (5): ~5 MB

Total per session: ~5-6 MB
Compresses well for archives
```

### Performance

```
Active Session Logging:
• Append turn: O(1), ~1ms
• Append deltas: O(1), ~1ms
• Create snapshot: ~50ms

Replay/Jump:
• Load snapshot: ~50ms
• Apply 100 deltas: ~10ms
• Jump anywhere: < 100ms
```

### Data Integrity

```
✓ Multi-file architecture isolates corruption
✓ Snapshots provide recovery points
✓ JSONL allows partial file recovery
✓ Checksums verify state consistency
✓ Delta verification against snapshots
```

---

## Future Extensions

### Analysis Features
```
• "Show all turns where I interacted with Khaosbyte"
• "When did I discover the lab?"
• "What was my Fate point usage?"
• "Which conflicts were closest?"
• "Show me all aspects I created"
```

### Sharing Features
```
• Export session as readable narrative
• Share delta-based replays (small files)
• Compare playthroughs at key turns
• Community challenge verification
```

### Integration Features
```
• AI training from session data
• Automated testing with session playback
• Performance optimization analysis
• Fate mechanics balance analysis
```

---

## Summary

This session logging system provides:

1. **Save System**: Play → log turns/deltas → exit → resume
2. **Delta Replay**: Jump to any turn via state changes
3. **Snapshots**: Fast checkpoints aggregate deltas
4. **Multi-File**: Efficient, recoverable storage
5. **Fate Integration**: All dice rolls and aspects logged

**Key Documents:**
- [Session File Architecture](./SESSION_FILE_ARCHITECTURE.md) - Storage structure
- [Delta and Snapshot System](./DELTA_AND_SNAPSHOT_SYSTEM.md) - State tracking
- [Turn and Action System](./TURN_AND_ACTION_SYSTEM.md) - Turn/Event structure
- [Fate Mechanics Reference](./FATE_MECHANICS_REFERENCE.md) - RPG mechanics
