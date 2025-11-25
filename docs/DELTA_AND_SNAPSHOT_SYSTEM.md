# Delta and Snapshot System

## Overview

The game state is tracked through **Deltas** (incremental changes) and **Snapshots** (full state captures). This provides efficient storage, fast replay, and reliable recovery.

---

## Core Concepts

### Delta

A **Delta** is a record of what changed between states. Every turn generates deltas.

```
Turn N → [Delta A, Delta B, Delta C] → State changes applied
```

### Snapshot

A **Snapshot** is a complete game state at a specific turn. Created periodically from accumulated deltas.

```
Snapshot(Turn 0) + Delta(1) + Delta(2) + ... + Delta(N) = State(Turn N)
```

### Relationship

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SESSION TIMELINE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Snapshot 0    Deltas 1-50         Snapshot 50    Deltas 51-100    │
│  (Initial)     ●●●●●●●●●●●●●●●●●   (Full state)   ●●●●●●●●●●●●●●●  │
│      │                                   │                          │
│      ▼                                   ▼                          │
│  ┌────────┐   ┌─┬─┬─┬─┬─┬─┬─┬─┐   ┌────────┐   ┌─┬─┬─┬─┬─┬─┬─┬─┐  │
│  │ STATE  │ + │δ│δ│δ│δ│δ│δ│δ│δ│ = │ STATE  │ + │δ│δ│δ│δ│δ│δ│δ│δ│  │
│  │ Turn 0 │   │1│2│3│4│5│.│.│.│   │Turn 50 │   │ │ │ │ │ │.│.│.│  │
│  └────────┘   └─┴─┴─┴─┴─┴─┴─┴─┘   └────────┘   └─┴─┴─┴─┴─┴─┴─┴─┘  │
│                                                                     │
│  To get to Turn 75:                                                │
│  1. Load Snapshot 50 (nearest before 75)                           │
│  2. Apply Deltas 51-75                                             │
│  3. Result: State at Turn 75                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Delta Structure

### Delta Object

```typescript
interface Delta {
  // Identity
  deltaId: string;          // Unique: "{sessionId}-{turnId}-{seq}"
  turnId: number;           // Which turn generated this delta
  sequence: number;         // Order within turn (1, 2, 3...)
  timestamp: number;        // When delta was created
  
  // What changed
  target: DeltaTarget;      // What entity was modified
  operation: DeltaOperation;// What kind of change
  path: string[];           // Path to the changed property
  
  // Change details
  previousValue: any;       // Value before change (for undo/verification)
  newValue: any;            // Value after change
  
  // Metadata
  cause: string;            // What caused this change (event type)
  eventId: string;          // Which event generated this delta
}

type DeltaTarget = 
  | "player"           // Player character state
  | "npc"              // Specific NPC state
  | "location"         // Location data
  | "scene"            // Current scene
  | "world"            // Global world state
  | "quest"            // Quest state
  | "relationship"     // Relationship values
  | "knowledge"        // Knowledge/discovery
  | "inventory"        // Items
  | "time";            // Game time

type DeltaOperation =
  | "set"              // Set value (replace)
  | "increment"        // Add to numeric value
  | "decrement"        // Subtract from numeric value
  | "append"           // Add to array
  | "remove"           // Remove from array
  | "insert"           // Insert at position in array
  | "delete"           // Delete property entirely
  | "create"           // Create new entity
  | "destroy";         // Remove entity entirely
```

### Delta Examples

**Player moves to new zone:**
```javascript
{
  deltaId: "abc123-42-1",
  turnId: 42,
  sequence: 1,
  timestamp: 1732557777531,
  target: "player",
  operation: "set",
  path: ["location", "zone"],
  previousValue: "market-stalls",
  newValue: "temple-entrance",
  cause: "move",
  eventId: "abc123-42-1"
}
```

**Player takes stress:**
```javascript
{
  deltaId: "abc123-58-3",
  turnId: 58,
  sequence: 3,
  timestamp: 1732558000000,
  target: "player",
  operation: "set",
  path: ["stress", "physical", 1],  // Box index 1
  previousValue: false,
  newValue: true,
  cause: "attack",
  eventId: "abc123-58-2"
}
```

**NPC relationship changes:**
```javascript
{
  deltaId: "abc123-45-2",
  turnId: 45,
  sequence: 2,
  timestamp: 1732557800000,
  target: "npc",
  operation: "increment",
  path: ["npc-khaosbyte", "relationship"],
  previousValue: 10,
  newValue: 15,
  cause: "interact",
  eventId: "abc123-45-1"
}
```

**Player gains knowledge:**
```javascript
{
  deltaId: "abc123-67-1",
  turnId: 67,
  sequence: 1,
  timestamp: 1732558500000,
  target: "knowledge",
  operation: "append",
  path: ["player", "locations"],
  previousValue: ["loc-001", "loc-002"],
  newValue: ["loc-001", "loc-002", "loc-003"],
  cause: "knowledge_gain",
  eventId: "abc123-67-1"
}
```

**New aspect created:**
```javascript
{
  deltaId: "abc123-89-2",
  turnId: 89,
  sequence: 2,
  timestamp: 1732559000000,
  target: "scene",
  operation: "append",
  path: ["aspects"],
  previousValue: [{ name: "Crowded Market" }],
  newValue: [{ name: "Crowded Market" }, { name: "Smoke Filling Room", freeInvokes: 2 }],
  cause: "create_advantage",
  eventId: "abc123-89-1"
}
```

---

## Snapshot Structure

### Snapshot Object

```typescript
interface Snapshot {
  // Identity
  snapshotId: string;       // "snapshot-{turnId}"
  sessionId: string;
  turnId: number;           // Turn this snapshot represents
  timestamp: string;        // ISO timestamp
  
  // Why created
  reason: SnapshotReason;
  
  // Complete state
  state: {
    player: PlayerState;
    world: WorldState;
    scene: SceneState;
    npcs: Map<string, NPCState>;
    quests: Map<string, QuestState>;
    gameTime: GameTime;
  };
  
  // Verification
  checksums: {
    player: string;
    world: string;
    scene: string;
    combined: string;       // Hash of all state
  };
  
  // Delta reference
  deltaRange: {
    fromSnapshot: string;   // Previous snapshot ID
    deltaCount: number;     // How many deltas since last snapshot
    firstDeltaId: string;
    lastDeltaId: string;
  };
}

type SnapshotReason =
  | "initial"              // Session start
  | "interval"             // Regular interval (every N turns)
  | "scene_end"            // Scene completed
  | "conflict_end"         // Combat/conflict resolved
  | "milestone"            // Significant event
  | "manual"               // Player-requested save point
  | "session_end";         // Closing session
```

### Snapshot Creation

```javascript
async function createSnapshot(reason: SnapshotReason): Promise<Snapshot> {
  const currentTurn = gameState.currentTurn;
  
  // Collect all current state
  const state = {
    player: deepClone(gameState.player),
    world: deepClone(gameState.world),
    scene: deepClone(gameState.currentScene),
    npcs: deepClone(gameState.npcs),
    quests: deepClone(gameState.quests),
    gameTime: deepClone(gameState.gameTime)
  };
  
  // Generate checksums for verification
  const checksums = {
    player: hash(state.player),
    world: hash(state.world),
    scene: hash(state.scene),
    combined: hash(state)
  };
  
  // Find delta range since last snapshot
  const lastSnapshot = await getLastSnapshot();
  const deltaRange = {
    fromSnapshot: lastSnapshot?.snapshotId ?? "initial",
    deltaCount: currentTurn - (lastSnapshot?.turnId ?? 0),
    firstDeltaId: `${sessionId}-${(lastSnapshot?.turnId ?? 0) + 1}-1`,
    lastDeltaId: `${sessionId}-${currentTurn}-latest`
  };
  
  const snapshot: Snapshot = {
    snapshotId: `snapshot-${currentTurn}`,
    sessionId,
    turnId: currentTurn,
    timestamp: new Date().toISOString(),
    reason,
    state,
    checksums,
    deltaRange
  };
  
  await writeSnapshot(snapshot);
  return snapshot;
}
```

---

## Delta Storage

### Turn File with Deltas

Each turn record includes its deltas:

```javascript
// turns/turns-0001-0050.jsonl
// One JSON object per line

{"turnId":1,"actor":"player","events":[...],"deltas":[
  {"deltaId":"abc-1-1","target":"player","operation":"set","path":["location","id"],"previousValue":"loc-start","newValue":"loc-market","cause":"move"}
]}

{"turnId":2,"actor":"player","events":[...],"deltas":[
  {"deltaId":"abc-2-1","target":"player","operation":"set","path":["location","zone"],"previousValue":"entrance","newValue":"stalls","cause":"move"},
  {"deltaId":"abc-2-2","target":"npc","operation":"increment","path":["npc-vendor","relationship"],"previousValue":0,"newValue":5,"cause":"interact"}
]}
```

### Dedicated Delta Index

For fast delta lookup:

```javascript
// indexes/delta-index.json
{
  "sessionId": "abc123",
  "totalDeltas": 1247,
  
  // By target (for filtering)
  "byTarget": {
    "player": { count: 312, turnRange: [1, 150] },
    "npc": { count: 456, turnRange: [5, 148] },
    "world": { count: 89, turnRange: [10, 140] },
    "scene": { count: 234, turnRange: [1, 150] },
    "quest": { count: 67, turnRange: [20, 145] },
    "knowledge": { count: 89, turnRange: [15, 150] }
  },
  
  // Snapshot boundaries
  "snapshots": [
    { snapshotId: "snapshot-0", turnId: 0, deltasBefore: 0 },
    { snapshotId: "snapshot-50", turnId: 50, deltasBefore: 127 },
    { snapshotId: "snapshot-100", turnId: 100, deltasBefore: 134 },
    { snapshotId: "snapshot-150", turnId: 150, deltasBefore: 156 }
  ]
}
```

---

## Replay System

### Replay to Specific Turn

```javascript
async function replayToTurn(sessionId: string, targetTurn: number): Promise<GameState> {
  // 1. Find nearest snapshot before target
  const snapshot = await findNearestSnapshot(sessionId, targetTurn);
  
  console.log(`Loading snapshot at turn ${snapshot.turnId}`);
  
  // 2. Start with snapshot state
  let state = deepClone(snapshot.state);
  
  // 3. If already at target, return
  if (snapshot.turnId === targetTurn) {
    return state;
  }
  
  // 4. Load deltas from snapshot to target
  const deltas = await loadDeltaRange(
    sessionId, 
    snapshot.turnId + 1, 
    targetTurn
  );
  
  console.log(`Applying ${deltas.length} deltas`);
  
  // 5. Apply each delta in order
  for (const delta of deltas) {
    state = applyDelta(state, delta);
  }
  
  // 6. Verify state (optional, for debugging)
  if (DEBUG_MODE) {
    await verifyState(state, targetTurn);
  }
  
  return state;
}
```

### Delta Application

```javascript
function applyDelta(state: GameState, delta: Delta): GameState {
  // Get the target object
  let target = getTarget(state, delta.target);
  
  // Navigate to the path
  let obj = target;
  for (let i = 0; i < delta.path.length - 1; i++) {
    obj = obj[delta.path[i]];
  }
  const finalKey = delta.path[delta.path.length - 1];
  
  // Apply operation
  switch (delta.operation) {
    case "set":
      obj[finalKey] = delta.newValue;
      break;
      
    case "increment":
      obj[finalKey] = (obj[finalKey] || 0) + (delta.newValue - delta.previousValue);
      break;
      
    case "decrement":
      obj[finalKey] = (obj[finalKey] || 0) - (delta.previousValue - delta.newValue);
      break;
      
    case "append":
      if (!Array.isArray(obj[finalKey])) obj[finalKey] = [];
      const newItems = delta.newValue.filter(
        item => !delta.previousValue.includes(item)
      );
      obj[finalKey].push(...newItems);
      break;
      
    case "remove":
      if (Array.isArray(obj[finalKey])) {
        const removedItems = delta.previousValue.filter(
          item => !delta.newValue.includes(item)
        );
        obj[finalKey] = obj[finalKey].filter(
          item => !removedItems.includes(item)
        );
      }
      break;
      
    case "insert":
      if (Array.isArray(obj[finalKey])) {
        // newValue contains { index, item }
        obj[finalKey].splice(delta.newValue.index, 0, delta.newValue.item);
      }
      break;
      
    case "delete":
      delete obj[finalKey];
      break;
      
    case "create":
      obj[finalKey] = delta.newValue;
      break;
      
    case "destroy":
      delete obj[finalKey];
      break;
  }
  
  return state;
}

function getTarget(state: GameState, target: DeltaTarget): any {
  switch (target) {
    case "player": return state.player;
    case "npc": return state.npcs;
    case "location": return state.world.locations;
    case "scene": return state.scene;
    case "world": return state.world;
    case "quest": return state.quests;
    case "relationship": return state.npcs;  // Relationships stored on NPCs
    case "knowledge": return state;  // Knowledge on player and NPCs
    case "inventory": return state.player.inventory;
    case "time": return state.gameTime;
    default: throw new Error(`Unknown delta target: ${target}`);
  }
}
```

### Undo (Reverse Delta)

```javascript
function reverseDelta(state: GameState, delta: Delta): GameState {
  // Create reverse delta by swapping previous/new values
  const reverseDelta: Delta = {
    ...delta,
    previousValue: delta.newValue,
    newValue: delta.previousValue,
    // Reverse operations
    operation: reverseOperation(delta.operation)
  };
  
  return applyDelta(state, reverseDelta);
}

function reverseOperation(op: DeltaOperation): DeltaOperation {
  switch (op) {
    case "append": return "remove";
    case "remove": return "append";
    case "increment": return "decrement";
    case "decrement": return "increment";
    case "create": return "destroy";
    case "destroy": return "create";
    default: return op;  // set, insert work with swapped values
  }
}
```

---

## Snapshot Strategy

### When to Create Snapshots

| Trigger | Interval | Priority |
|---------|----------|----------|
| Turn interval | Every 50 turns | Normal |
| Scene end | When scene completes | High |
| Conflict end | Combat resolution | High |
| Quest milestone | Major quest progress | High |
| Session pause | Player exits | Critical |
| Session end | Session complete | Critical |
| Manual request | Player saves | High |

### Snapshot Retention Policy

```javascript
const SNAPSHOT_POLICY = {
  // Keep snapshots by age/importance
  retention: {
    // Always keep
    always: ["initial", "session_end", "milestone"],
    
    // Keep recent
    recent: {
      maxAge: 10,  // Keep last 10 snapshots regardless
    },
    
    // Thin older snapshots
    thin: {
      afterTurns: 500,     // After 500 turns from current
      keepEvery: 100,      // Keep every 100th turn snapshot
    }
  },
  
  // Storage limits
  limits: {
    maxSnapshots: 50,      // Maximum snapshots per session
    maxSnapshotSize: 5,    // MB per snapshot
    maxTotalSize: 100      // MB total snapshot storage
  }
};
```

### Snapshot Compression

For older snapshots, store only diffs from previous:

```javascript
interface CompressedSnapshot {
  snapshotId: string;
  baseSnapshot: string;     // Reference to full snapshot
  turnId: number;
  
  // Only store what changed since base
  stateDiffs: {
    player?: Partial<PlayerState>;
    world?: Partial<WorldState>;
    scene?: SceneState;      // Scenes change completely, store full
    npcs?: Map<string, Partial<NPCState>>;
    quests?: Map<string, Partial<QuestState>>;
  };
}
```

---

## File Structure Update

### Updated Session Directory

```
sessions/{sessionId}/
├── session.meta.json       # Session metadata
├── state/
│   ├── current.json        # Current live state (updated each turn)
│   └── verified.json       # Last verified state (from snapshot)
├── turns/
│   ├── turns-0001-0050.jsonl   # Turns with embedded deltas
│   ├── turns-0051-0100.jsonl
│   └── turns-0101-current.jsonl
├── snapshots/
│   ├── snapshot-0000.json      # Initial state
│   ├── snapshot-0050.json      # Full snapshot
│   ├── snapshot-0100.json      # Full snapshot
│   └── snapshot-0150.json      # Latest snapshot
├── indexes/
│   ├── turn-index.json
│   ├── delta-index.json        # Delta lookup index
│   └── snapshot-index.json     # Snapshot lookup index
└── scenes/
    ├── scene-001.json
    ├── scene-002.json
    └── scene-003.json
```

### Delta-Aware Turn Record

```javascript
// Updated turn structure with deltas
interface TurnRecord {
  // Turn identity
  turnId: number;
  sessionId: string;
  sceneId: string;
  actor: string;
  timestamp: number;
  gameTime: GameTime;
  
  // What happened
  actions: Action[];
  events: Event[];
  
  // State changes (THE KEY ADDITION)
  deltas: Delta[];
  
  // LLM context
  llmContext?: {
    prompt: string;
    response: string;
    seed: number;
    model: string;
  };
  
  // Quick reference
  summary: {
    deltaCount: number;
    targetsModified: DeltaTarget[];
    significantChanges: string[];  // Human-readable
  };
}
```

---

## Verification System

### State Verification

```javascript
async function verifyState(
  currentState: GameState, 
  turnId: number
): Promise<VerificationResult> {
  // Find the snapshot that should lead to this state
  const snapshot = await findNearestSnapshot(sessionId, turnId);
  
  // Rebuild state from snapshot + deltas
  const rebuiltState = await replayToTurn(sessionId, turnId);
  
  // Compare
  const differences = deepCompare(currentState, rebuiltState);
  
  if (differences.length === 0) {
    return { valid: true, turnId };
  } else {
    return {
      valid: false,
      turnId,
      differences,
      suggestion: "State drift detected. Consider creating recovery snapshot."
    };
  }
}
```

### Checksum Verification

```javascript
function verifyDeltaChain(
  startSnapshot: Snapshot,
  deltas: Delta[],
  endSnapshot: Snapshot
): boolean {
  // Apply all deltas to start snapshot
  let state = deepClone(startSnapshot.state);
  for (const delta of deltas) {
    state = applyDelta(state, delta);
  }
  
  // Hash should match end snapshot
  const computedHash = hash(state);
  return computedHash === endSnapshot.checksums.combined;
}
```

---

## Performance Characteristics

### Storage Efficiency

| Approach | 100 Turns | 1000 Turns | 10000 Turns |
|----------|-----------|------------|-------------|
| Full state each turn | 50 MB | 500 MB | 5 GB |
| Deltas + snapshots/50 | 2 MB | 15 MB | 120 MB |
| Deltas + snapshots/100 | 1.5 MB | 12 MB | 100 MB |

### Replay Speed

| Target Turn | Snapshots/50 | Snapshots/100 |
|-------------|--------------|---------------|
| Turn 50 | Instant (snapshot) | 50 deltas |
| Turn 75 | 25 deltas | 75 deltas |
| Turn 500 | 0 deltas | 0 deltas |
| Turn 525 | 25 deltas | 25 deltas |

### Recommended Configuration

```javascript
const DELTA_CONFIG = {
  // Snapshot frequency
  snapshotInterval: 50,        // Every 50 turns
  
  // Delta batching
  deltaBatchSize: 10,          // Write deltas in batches of 10
  
  // Verification
  verifyEveryNTurns: 100,      // Verify state integrity
  
  // Compression
  compressSnapshotsOlderThan: 200,  // Compress old snapshots
  
  // Cleanup
  pruneOrphanedDeltas: true,   // Remove deltas with no snapshot
};
```

---

## Integration with Turn System

### Turn Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TURN PROCESSING                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Player Action Received                                      │
│     └─ "Move to temple entrance"                                │
│                                                                  │
│  2. GameMaster Processes                                        │
│     └─ Validate action                                          │
│     └─ Determine outcomes                                       │
│                                                                  │
│  3. Generate Events                                             │
│     └─ Event: { type: "move", zone: "temple-entrance" }        │
│                                                                  │
│  4. Generate Deltas from Events  ◄── NEW STEP                   │
│     └─ Delta: { target: "player", path: ["location","zone"],   │
│                 operation: "set", newValue: "temple-entrance" } │
│                                                                  │
│  5. Apply Deltas to State                                       │
│     └─ state.player.location.zone = "temple-entrance"          │
│                                                                  │
│  6. Log Turn (includes deltas)                                  │
│     └─ Write to turns/*.jsonl                                   │
│                                                                  │
│  7. Check Snapshot Trigger                                      │
│     └─ If turnId % 50 === 0 → Create Snapshot                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Event to Delta Mapping

```javascript
function generateDeltasFromEvent(event: Event, currentState: GameState): Delta[] {
  const deltas: Delta[] = [];
  
  switch (event.type) {
    case "move":
      deltas.push({
        deltaId: `${event.eventId}-d1`,
        turnId: event.turnId,
        sequence: 1,
        timestamp: Date.now(),
        target: "player",
        operation: "set",
        path: ["location", "zone"],
        previousValue: currentState.player.location.zone,
        newValue: event.data.zone,
        cause: "move",
        eventId: event.eventId
      });
      break;
      
    case "stress_taken":
      deltas.push({
        deltaId: `${event.eventId}-d1`,
        turnId: event.turnId,
        sequence: 1,
        timestamp: Date.now(),
        target: event.data.target === "player" ? "player" : "npc",
        operation: "set",
        path: event.data.target === "player" 
          ? ["stress", event.data.track, event.data.box]
          : [event.data.target, "stress", event.data.track, event.data.box],
        previousValue: false,
        newValue: true,
        cause: "stress_taken",
        eventId: event.eventId
      });
      break;
      
    case "knowledge_gain":
      const currentKnowledge = currentState.player.knowledge[event.data.category];
      deltas.push({
        deltaId: `${event.eventId}-d1`,
        turnId: event.turnId,
        sequence: 1,
        timestamp: Date.now(),
        target: "knowledge",
        operation: "append",
        path: ["player", "knowledge", event.data.category],
        previousValue: [...currentKnowledge],
        newValue: [...currentKnowledge, event.data.item],
        cause: "knowledge_gain",
        eventId: event.eventId
      });
      break;
      
    // ... more event types
  }
  
  return deltas;
}
```

---

## Summary

### Key Benefits

1. **Efficient Storage**: Only changes stored, not full state each turn
2. **Fast Replay**: Load snapshot + apply deltas (not full replay)
3. **Undo Support**: Reverse deltas to go backward
4. **Verification**: Can verify state integrity at any point
5. **Debugging**: See exactly what changed and when
6. **Branching**: Could support "what if" branches from any point

### Delta System Rules

1. **Every state change must have a delta**
2. **Deltas are immutable once created**
3. **Deltas must be idempotent** (applying twice = same result)
4. **Previous value must be captured** (for undo/verification)
5. **Snapshots are the source of truth** (deltas are derived)

### File Responsibilities

| File | Contains | Updated |
|------|----------|---------|
| `turns/*.jsonl` | Turn records with embedded deltas | Every turn |
| `state/current.json` | Current applied state | Every turn |
| `snapshots/*.json` | Full state captures | Every N turns |
| `indexes/delta-index.json` | Delta lookup | Periodically |
| `indexes/snapshot-index.json` | Snapshot lookup | On snapshot |
