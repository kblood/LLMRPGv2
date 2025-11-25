# Session File Architecture

## Overview

Sessions are stored across **multiple files** for better performance, organization, and partial loading. This replaces the single-file approach with a structured directory system.

**Related Documents:**
- [Delta and Snapshot System](./DELTA_AND_SNAPSHOT_SYSTEM.md) - How state changes are tracked
- [Turn and Action System](./TURN_AND_ACTION_SYSTEM.md) - Turn/Event structure
- [Session Logging and Replay](./SESSION_LOGGING_AND_REPLAY.md) - Replay implementation

---

## Why Multiple Files?

### Problems with Single File
- **Large files** - A long session could be 10+ MB
- **Slow loading** - Must parse entire file to access any data
- **Memory pressure** - Entire session must fit in memory
- **Corruption risk** - One bad write corrupts everything
- **No partial access** - Can't load just what you need

### Benefits of Multi-File
- **Fast access** - Load only the files you need
- **Streaming writes** - Append to separate files
- **Partial recovery** - Corruption isolated to one file
- **Better caching** - Keep hot files in memory
- **Parallel loading** - Load multiple files simultaneously
- **Size management** - Each file stays small

---

## Directory Structure

```
sessions/
├── active/
│   └── {sessionId}/           # Currently playing session
│       ├── session.meta.json  # Session metadata
│       ├── world.state.json   # Current world state
│       ├── player.state.json  # Current player state
│       ├── scenes/
│       │   ├── scene-001.json
│       │   ├── scene-002.json
│       │   └── scene-003.json # Current scene
│       ├── turns/
│       │   ├── turns-0001-0100.jsonl   # Turns 1-100
│       │   ├── turns-0101-0200.jsonl   # Turns 101-200
│       │   └── turns-0201-current.jsonl # Current turns
│       ├── deltas/
│       │   ├── deltas-0001-0100.jsonl  # Deltas for turns 1-100
│       │   ├── deltas-0101-0200.jsonl  # Deltas for turns 101-200
│       │   └── deltas-current.jsonl    # Current deltas
│       ├── snapshots/
│       │   ├── snapshot-0100.json
│       │   └── snapshot-0200.json
│       └── indexes/
│           ├── turn-index.json
│           ├── scene-index.json
│           ├── delta-index.json
│           └── event-index.json
│
├── paused/
│   └── {sessionId}/           # Paused sessions (same structure)
│
├── completed/
│   └── {sessionId}/           # Finished sessions (same structure)
│
└── archives/
    └── {sessionId}.tar.gz     # Compressed completed sessions
```

---

## File Types

### 1. Session Metadata (`session.meta.json`)

Core session information, loaded first:

```javascript
{
  "sessionId": "session-abc123",
  "version": "1.0.0",
  "created": "2025-11-25T10:30:00Z",
  "lastModified": "2025-11-25T14:45:00Z",
  "status": "active",  // "active" | "paused" | "completed"
  
  // Session configuration
  "config": {
    "theme": "cyberpunk",
    "difficulty": "normal",
    "seed": 12345,
    "llmModel": "granite4:latest"
  },
  
  // Player info (minimal)
  "player": {
    "name": "Protagonist",
    "characterId": "char-xyz789"
  },
  
  // Current position
  "current": {
    "turnId": 247,
    "sceneId": "scene-012",
    "locationId": "loc-temple-district",
    "gameDay": 3,
    "gameTimeOfDay": "evening"
  },
  
  // File references
  "files": {
    "worldState": "world.state.json",
    "playerState": "player.state.json",
    "currentScene": "scenes/scene-012.json",
    "currentTurns": "turns/turns-0201-current.jsonl",
    "currentDeltas": "deltas/deltas-current.jsonl",
    "latestSnapshot": "snapshots/snapshot-0200.json"
  },
  
  // Delta tracking stats
  "deltaStats": {
    "totalDeltas": 1523,
    "deltasSinceSnapshot": 287,
    "lastSnapshotTurn": 200
  },
  
  // Statistics
  "stats": {
    "totalTurns": 247,
    "totalScenes": 12,
    "totalEvents": 892,
    "playTimeMinutes": 180,
    "conflictsResolved": 5,
    "npcsEncountered": 23
  }
}
```

### 2. World State (`world.state.json`)

Current state of the world (mutable):

```javascript
{
  "worldId": "world-abc123",
  "sessionId": "session-abc123",
  "lastUpdated": "2025-11-25T14:45:00Z",
  
  // Generated/discovered content
  "locations": {
    "discovered": ["loc-001", "loc-002", "loc-003"],
    "generated": {
      "loc-003": {
        "generatedAtTurn": 150,
        "data": { /* full location data */ }
      }
    }
  },
  
  // NPC states (positions, relationships, etc.)
  "npcs": {
    "npc-khaosbyte": {
      "currentLocation": "loc-hacker-cafe",
      "relationship": 15,
      "knownFacts": ["quest-main-001", "location-lab"],
      "lastInteraction": 230
    }
    // ... more NPCs
  },
  
  // Active quests
  "quests": {
    "quest-main-001": {
      "status": "active",
      "progress": 0.4,
      "objectivesComplete": ["find-contact"],
      "objectivesRemaining": ["locate-lab", "retrieve-data"]
    }
  },
  
  // World aspects (Fate concept)
  "aspects": [
    { "name": "Corporate Lockdown", "scope": "global", "since": 100 },
    { "name": "Rising Tensions", "scope": "district-slums", "since": 180 }
  ],
  
  // Time-based events scheduled
  "scheduledEvents": [
    { "atTurn": 300, "type": "npc_arrives", "data": { "npc": "npc-boss" } }
  ]
}
```

### 3. Player State (`player.state.json`)

Current player character state:

```javascript
{
  "characterId": "char-xyz789",
  "sessionId": "session-abc123",
  "lastUpdated": "2025-11-25T14:45:00Z",
  
  // Identity
  "name": "Vex",
  "highConcept": "Street-Smart Netrunner",  // Fate aspect
  "trouble": "Hunted by Zaibatsu",          // Fate aspect
  
  // Skills (Fate ladder)
  "skills": {
    "great": ["Hack"],           // +4
    "good": ["Notice", "Stealth"], // +3
    "fair": ["Athletics", "Shoot", "Contacts"], // +2
    "average": ["Fight", "Will", "Rapport", "Investigate"] // +1
  },
  
  // Stress tracks
  "stress": {
    "physical": [false, false, false],  // 3 boxes
    "mental": [false, false, false, false] // 4 boxes (high Will)
  },
  
  // Consequences
  "consequences": {
    "mild": null,
    "moderate": null,
    "severe": null
  },
  
  // Additional aspects
  "aspects": [
    "Military-Grade Cyberdeck",
    "Owes Luna a Big Favor"
  ],
  
  // Stunts (special abilities)
  "stunts": [
    {
      "name": "Ghost in the System",
      "description": "+2 to Hack when avoiding detection"
    }
  ],
  
  // Refresh (Fate points)
  "refresh": 3,
  "fatePoints": 2,
  
  // Inventory
  "inventory": [
    { "id": "item-cyberdeck", "name": "Military Cyberdeck", "aspect": true },
    { "id": "item-pistol", "name": "Light Pistol", "weapon": 1 },
    { "id": "item-credstick", "name": "Credstick", "value": 500 }
  ],
  
  // Knowledge discovered
  "knowledge": {
    "locations": ["loc-001", "loc-002"],
    "npcs": ["npc-khaosbyte", "npc-luna"],
    "secrets": ["secret-implant-control"],
    "rumors": ["rumor-ai-uprising"]
  },
  
  // Current location
  "location": {
    "id": "loc-temple-district",
    "zone": "main-plaza",  // Zone within location
    "arrived": 245
  }
}
```

### 4. Scene Files (`scenes/scene-{id}.json`)

One file per scene:

```javascript
{
  "sceneId": "scene-012",
  "sessionId": "session-abc123",
  
  // Scene basics
  "type": "exploration",  // "exploration" | "social" | "conflict" | "travel"
  "status": "active",     // "active" | "completed"
  
  // Location
  "location": {
    "id": "loc-temple-district",
    "name": "Temple District",
    "description": "Holographic prayer wheels flicker..."
  },
  
  // Time span
  "time": {
    "started": { "day": 3, "timeOfDay": "afternoon", "hour": 15 },
    "ended": null,  // Still active
    "turnRange": [230, null]  // Turns 230 to current
  },
  
  // Scene aspects
  "aspects": [
    { "name": "Incense-Filled Air", "freeInvokes": 1 },
    { "name": "Watchful Monks", "freeInvokes": 0 }
  ],
  
  // NPCs in scene
  "npcsPresent": [
    { "id": "npc-monk-01", "zone": "temple-entrance" },
    { "id": "npc-vendor-incense", "zone": "main-plaza" }
  ],
  
  // Zones (for movement)
  "zones": [
    { "id": "main-plaza", "name": "Main Plaza", "adjacent": ["temple-entrance", "market-stalls"] },
    { "id": "temple-entrance", "name": "Temple Entrance", "adjacent": ["main-plaza", "inner-sanctum"] },
    { "id": "market-stalls", "name": "Market Stalls", "adjacent": ["main-plaza"] },
    { "id": "inner-sanctum", "name": "Inner Sanctum", "adjacent": ["temple-entrance"], "restricted": true }
  ],
  
  // If conflict
  "conflict": null,  // or ConflictData object
  
  // Summary (for replay/review)
  "summary": {
    "majorEvents": [
      "Player arrived at Temple District",
      "Spoke with incense vendor about local rumors"
    ],
    "outcomePreview": null  // Filled when scene ends
  }
}
```

### 5. Turn Files (`turns/turns-{start}-{end}.jsonl`)

Turns stored in JSONL format (one JSON object per line) for efficient streaming:

```jsonl
{"turnId":201,"sceneId":"scene-011","actor":"player","timestamp":1732557000000,"gameTime":{"day":3,"timeOfDay":"afternoon"},"actions":[{"type":"travel","destination":"loc-temple-district"}],"events":[{"eventId":"abc123-201-1","type":"travel","description":"You make your way through the crowded streets..."}],"stateChanges":[{"type":"scene_end","sceneId":"scene-011"}]}
{"turnId":202,"sceneId":"scene-012","actor":"gm","timestamp":1732557001000,"gameTime":{"day":3,"timeOfDay":"afternoon"},"actions":[],"events":[{"eventId":"abc123-202-1","type":"scene_start","description":"Temple District unfolds before you..."}],"stateChanges":[{"type":"scene_start","sceneId":"scene-012"}]}
{"turnId":203,"sceneId":"scene-012","actor":"player","timestamp":1732557005000,"gameTime":{"day":3,"timeOfDay":"afternoon"},"actions":[{"type":"move","zone":"market-stalls"},{"type":"interact","target":"npc-vendor-incense"}],"events":[{"eventId":"abc123-203-1","type":"move","description":"You walk toward the market stalls"},{"eventId":"abc123-203-2","type":"interact","description":"The vendor greets you warmly..."}],"stateChanges":[{"type":"player_zone","zone":"market-stalls"}]}
```

**Why JSONL?**
- Append-only (fast writes)
- Stream processing (read line by line)
- No need to parse entire file
- Each line is valid JSON

### 6. Delta Files (`deltas/deltas-*.jsonl`)

State changes tracked per event in JSONL format:

```jsonl
{"deltaId":"delta-abc123-201-1","turnId":201,"eventId":"abc123-201-1","timestamp":1732557000000,"scope":"world","deltas":[{"op":"set","path":"npcs.npc-khaosbyte.currentLocation","value":"loc-temple-district","previousValue":"loc-hacker-cafe"}]}
{"deltaId":"delta-abc123-203-1","turnId":203,"eventId":"abc123-203-1","timestamp":1732557005000,"scope":"player","deltas":[{"op":"set","path":"location.zone","value":"market-stalls","previousValue":"main-plaza"}]}
{"deltaId":"delta-abc123-203-2","turnId":203,"eventId":"abc123-203-2","timestamp":1732557006000,"scope":"world","deltas":[{"op":"push","path":"npcs.npc-vendor-incense.knownFacts","value":"met-player"},{"op":"increment","path":"npcs.npc-vendor-incense.relationship","value":5}]}
```

**Delta Operations:**
- `set` - Set a value at path
- `delete` - Remove a value at path
- `push` - Add to array
- `pull` - Remove from array
- `increment` - Add to number

See [Delta and Snapshot System](./DELTA_AND_SNAPSHOT_SYSTEM.md) for full documentation.

### 7. Snapshot Files (`snapshots/snapshot-{turnId}.json`)

Full game state at a point in time (aggregated from deltas):

```javascript
{
  "snapshotId": "snapshot-0200",
  "sessionId": "session-abc123",
  "turnId": 200,
  "timestamp": "2025-11-25T13:30:00Z",
  
  // Why this snapshot exists
  "reason": "checkpoint_interval",  // or "scene_end", "conflict_end", "manual"
  
  // Delta aggregation info
  "deltaAggregation": {
    "fromSnapshot": "snapshot-0100",  // Previous snapshot
    "deltasAggregated": 523,          // Number of deltas summarized
    "turnRange": [101, 200]           // Turns covered
  },
  
  // Complete state copies
  "worldState": { /* full world.state.json content */ },
  "playerState": { /* full player.state.json content */ },
  "activeScene": { /* full scene file content */ },
  
  // For verification
  "checksums": {
    "worldState": "sha256:abc...",
    "playerState": "sha256:def...",
    "activeScene": "sha256:ghi..."
  }
}
```

### 8. Index Files (`indexes/*.json`)

Fast lookup indexes:

**Turn Index (`turn-index.json`)**
```javascript
{
  "sessionId": "session-abc123",
  "totalTurns": 247,
  
  // Which file contains which turns
  "files": [
    { "file": "turns-0001-0100.jsonl", "range": [1, 100], "eventCount": 312 },
    { "file": "turns-0101-0200.jsonl", "range": [101, 200], "eventCount": 389 },
    { "file": "turns-0201-current.jsonl", "range": [201, 247], "eventCount": 191 }
  ],
  
  // Quick turn lookup
  "turnOffsets": {
    "1": { "file": "turns-0001-0100.jsonl", "line": 0 },
    "50": { "file": "turns-0001-0100.jsonl", "line": 49 },
    "100": { "file": "turns-0001-0100.jsonl", "line": 99 },
    "150": { "file": "turns-0101-0200.jsonl", "line": 49 },
    "200": { "file": "turns-0101-0200.jsonl", "line": 99 },
    "247": { "file": "turns-0201-current.jsonl", "line": 46 }
  }
}
```

**Scene Index (`scene-index.json`)**
```javascript
{
  "sessionId": "session-abc123",
  "totalScenes": 12,
  
  "scenes": [
    { "sceneId": "scene-001", "type": "exploration", "turnRange": [1, 25], "location": "loc-starting" },
    { "sceneId": "scene-002", "type": "travel", "turnRange": [26, 32], "location": "loc-route-1" },
    { "sceneId": "scene-003", "type": "conflict", "turnRange": [33, 50], "location": "loc-route-1" },
    // ...
    { "sceneId": "scene-012", "type": "exploration", "turnRange": [230, null], "location": "loc-temple-district" }
  ]
}
```

**Event Index (`event-index.json`)**
```javascript
{
  "sessionId": "session-abc123",
  "totalEvents": 892,
  
  // Event type counts
  "byType": {
    "move": 156,
    "interact": 89,
    "overcome": 45,
    "attack": 67,
    "defend": 52,
    "knowledge_gain": 34,
    // ...
  },
  
  // Significant events for quick reference
  "significant": [
    { "eventId": "abc123-45-1", "type": "knowledge_gain", "summary": "Learned about Zaibatsu conspiracy" },
    { "eventId": "abc123-89-2", "type": "conflict_end", "summary": "Defeated gang leader" },
    { "eventId": "abc123-156-1", "type": "quest_progress", "summary": "Found lab location" }
  ]
}
```

**Delta Index (`delta-index.json`)**
```javascript
{
  "sessionId": "session-abc123",
  "totalDeltas": 1523,
  
  // Which file contains which turn range
  "files": [
    { "file": "deltas-0001-0100.jsonl", "turnRange": [1, 100], "deltaCount": 498 },
    { "file": "deltas-0101-0200.jsonl", "turnRange": [101, 200], "deltaCount": 523 },
    { "file": "deltas-current.jsonl", "turnRange": [201, 247], "deltaCount": 502 }
  ],
  
  // Snapshot checkpoints
  "snapshots": [
    { "snapshotId": "snapshot-0100", "turnId": 100, "file": "snapshots/snapshot-0100.json" },
    { "snapshotId": "snapshot-0200", "turnId": 200, "file": "snapshots/snapshot-0200.json" }
  ],
  
  // Delta statistics by scope
  "byScope": {
    "world": 743,
    "player": 512,
    "scene": 268
  },
  
  // Delta statistics by operation
  "byOperation": {
    "set": 1089,
    "increment": 234,
    "push": 156,
    "pull": 34,
    "delete": 10
  }
}
```

---

## File Operations

### Writing (During Play)

```javascript
class SessionWriter {
  // Append a turn to current turns file
  async appendTurn(turn) {
    const turnsFile = this.getCurrentTurnsFile();
    await fs.appendFile(turnsFile, JSON.stringify(turn) + '\n');
    
    // Update indexes
    await this.updateTurnIndex(turn);
    
    // Check if we should rotate to new file
    if (this.shouldRotateTurnsFile()) {
      await this.rotateTurnsFile();
    }
  }
  
  // Append deltas generated from a turn's events
  async appendDeltas(deltas) {
    const deltasFile = this.getCurrentDeltasFile();
    for (const delta of deltas) {
      await fs.appendFile(deltasFile, JSON.stringify(delta) + '\n');
    }
    
    // Update delta index
    await this.updateDeltaIndex(deltas);
    
    // Check if we should create a snapshot
    if (this.shouldCreateSnapshot()) {
      await this.createSnapshot('delta_threshold');
    }
    
    // Rotate delta file if needed
    if (this.shouldRotateDeltasFile()) {
      await this.rotateDeltasFile();
    }
  }
  
  // Update state files (periodic, not every turn)
  async updateState(worldState, playerState) {
    await fs.writeFile('world.state.json', JSON.stringify(worldState, null, 2));
    await fs.writeFile('player.state.json', JSON.stringify(playerState, null, 2));
    await this.updateMetadata();
  }
  
  // Create snapshot (aggregates deltas since last snapshot)
  async createSnapshot(reason) {
    const lastSnapshot = await this.getLatestSnapshot();
    const deltasSinceSnapshot = await this.getDeltasSince(lastSnapshot?.turnId || 0);
    
    const snapshot = {
      snapshotId: `snapshot-${this.currentTurn}`,
      turnId: this.currentTurn,
      timestamp: new Date().toISOString(),
      reason: reason,
      deltaAggregation: {
        fromSnapshot: lastSnapshot?.snapshotId || null,
        deltasAggregated: deltasSinceSnapshot.length,
        turnRange: [lastSnapshot?.turnId + 1 || 1, this.currentTurn]
      },
      worldState: await this.loadWorldState(),
      playerState: await this.loadPlayerState(),
      activeScene: await this.loadActiveScene()
    };
    
    await fs.writeFile(
      `snapshots/snapshot-${this.currentTurn.toString().padStart(4, '0')}.json`,
      JSON.stringify(snapshot, null, 2)
    );
    
    // Update delta index with new snapshot
    await this.updateDeltaIndexWithSnapshot(snapshot);
  }
  
  // Check if we should create a snapshot
  shouldCreateSnapshot() {
    const deltasSinceSnapshot = this.metadata.deltaStats.deltasSinceSnapshot;
    const turnsSinceSnapshot = this.currentTurn - this.metadata.deltaStats.lastSnapshotTurn;
    
    // Snapshot every 100 turns or 500 deltas, whichever comes first
    return turnsSinceSnapshot >= 100 || deltasSinceSnapshot >= 500;
  }
  
  // Rotate turns file when it gets too large
  async rotateTurnsFile() {
    const oldFile = this.getCurrentTurnsFile();
    const newStart = this.currentTurn + 1;
    const newFile = `turns/turns-${newStart.toString().padStart(4, '0')}-current.jsonl`;
    
    // Rename old file to show its final range
    const oldRange = this.currentTurnsRange;
    await fs.rename(oldFile, `turns/turns-${oldRange[0]}-${oldRange[1]}.jsonl`);
    
    // Create new current file
    await fs.writeFile(newFile, '');
    
    // Update index
    await this.updateTurnIndex();
  }
}
```

### Reading (Resume/Replay)

```javascript
class SessionLoader {
  // Quick resume - load minimal state
  async quickResume(sessionId) {
    // Load metadata
    const meta = await this.loadMetadata(sessionId);
    
    // Load current state files
    const worldState = await this.loadFile(meta.files.worldState);
    const playerState = await this.loadFile(meta.files.playerState);
    const currentScene = await this.loadFile(meta.files.currentScene);
    
    // Ready to play - turns and deltas loaded on demand
    return { meta, worldState, playerState, currentScene };
  }
  
  // Jump to specific turn using delta replay
  async jumpToTurn(sessionId, targetTurn) {
    // Find nearest snapshot before target
    const snapshot = await this.findNearestSnapshot(sessionId, targetTurn);
    
    // Load snapshot state as starting point
    let worldState = JSON.parse(JSON.stringify(snapshot.worldState));
    let playerState = JSON.parse(JSON.stringify(snapshot.playerState));
    
    // Load and apply deltas from snapshot to target turn
    const deltas = await this.loadDeltasRange(sessionId, snapshot.turnId + 1, targetTurn);
    for (const deltaGroup of deltas) {
      for (const delta of deltaGroup.deltas) {
        if (deltaGroup.scope === 'world') {
          worldState = this.applyDelta(worldState, delta);
        } else if (deltaGroup.scope === 'player') {
          playerState = this.applyDelta(playerState, delta);
        }
      }
    }
    
    return { worldState, playerState, turn: targetTurn };
  }
  
  // Apply a single delta operation
  applyDelta(state, delta) {
    const pathParts = delta.path.split('.');
    let current = state;
    
    // Navigate to parent of target
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]];
    }
    
    const key = pathParts[pathParts.length - 1];
    
    switch (delta.op) {
      case 'set':
        current[key] = delta.value;
        break;
      case 'delete':
        delete current[key];
        break;
      case 'push':
        current[key].push(delta.value);
        break;
      case 'pull':
        current[key] = current[key].filter(v => v !== delta.value);
        break;
      case 'increment':
        current[key] += delta.value;
        break;
    }
    
    return state;
  }
  
  // Load deltas for a turn range
  async loadDeltasRange(sessionId, startTurn, endTurn) {
    const index = await this.loadDeltaIndex(sessionId);
    const relevantFiles = this.findDeltaFilesForRange(index, startTurn, endTurn);
    
    const deltas = [];
    for (const file of relevantFiles) {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const deltaGroup = JSON.parse(line);
        if (deltaGroup.turnId >= startTurn && deltaGroup.turnId <= endTurn) {
          deltas.push(deltaGroup);
        }
      }
    }
    
    return deltas.sort((a, b) => a.turnId - b.turnId);
  }
  
  // Load specific turn range (for replay display)
  async loadTurnsRange(sessionId, startTurn, endTurn) {
  async loadTurnsRange(sessionId, startTurn, endTurn) {
    const index = await this.loadTurnIndex(sessionId);
    const relevantFiles = this.findFilesForRange(index, startTurn, endTurn);
    
    const turns = [];
    for (const file of relevantFiles) {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        const turn = JSON.parse(line);
        if (turn.turnId >= startTurn && turn.turnId <= endTurn) {
          turns.push(turn);
        }
      }
    }
    
    return turns.sort((a, b) => a.turnId - b.turnId);
  }
}
```

---

## Performance Characteristics

### File Size Targets

| File Type | Target Size | Max Size |
|-----------|-------------|----------|
| session.meta.json | < 10 KB | 50 KB |
| world.state.json | < 500 KB | 2 MB |
| player.state.json | < 50 KB | 200 KB |
| scene-*.json | < 50 KB | 200 KB |
| turns-*.jsonl | < 1 MB | 2 MB |
| deltas-*.jsonl | < 1 MB | 2 MB |
| snapshot-*.json | < 1 MB | 5 MB |
| *-index.json | < 100 KB | 500 KB |

### Access Patterns

| Operation | Files Accessed | Load Time Target |
|-----------|----------------|------------------|
| Quick Resume | 4 files | < 100ms |
| Jump to Turn | 2-5 files (snapshot + deltas) | < 500ms |
| Full Replay | All turn + delta files | < 2s per 1000 turns |
| Save Turn | 1 turn append + 1 delta append | < 10ms |
| Create Snapshot | 4 writes + delta aggregation | < 100ms |

---

## Snapshot Strategy

Snapshots aggregate deltas into complete state. See [Delta and Snapshot System](./DELTA_AND_SNAPSHOT_SYSTEM.md) for detailed implementation.

### When to Create Snapshots

1. **Interval-based**: Every 100 turns
2. **Delta threshold**: Every 500 deltas
3. **Scene transitions**: When scene ends
4. **Conflict resolution**: When conflict ends
5. **Significant events**: Quest completion, major discovery
6. **Manual**: Player requests save point
7. **Session end**: Always snapshot on exit

### Snapshot Retention

- Keep **last 10 snapshots** always
- Keep **scene transition snapshots** for current session
- Archive older snapshots when session completes
- Minimum: snapshot every 100 turns

---

## Error Recovery

### Corruption Handling

```javascript
class SessionRecovery {
  async validateSession(sessionId) {
    const issues = [];
    
    // Check metadata
    try {
      const meta = await this.loadMetadata(sessionId);
      if (!meta.sessionId) issues.push('Missing sessionId in metadata');
    } catch (e) {
      issues.push('Metadata file corrupted or missing');
    }
    
    // Check state files
    for (const file of ['world.state.json', 'player.state.json']) {
      try {
        JSON.parse(await fs.readFile(file));
      } catch (e) {
        issues.push(`${file} corrupted`);
      }
    }
    
    // Check turn files (validate each line)
    const turnFiles = await this.listTurnFiles(sessionId);
    for (const file of turnFiles) {
      const lines = (await fs.readFile(file, 'utf8')).split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim()) {
          try {
            JSON.parse(lines[i]);
          } catch (e) {
            issues.push(`${file} line ${i + 1} corrupted`);
          }
        }
      }
    }
    
    return issues;
  }
  
  async recoverFromSnapshot(sessionId) {
    // Find latest valid snapshot
    const snapshots = await this.listSnapshots(sessionId);
    for (const snapshot of snapshots.reverse()) {
      try {
        const data = JSON.parse(await fs.readFile(snapshot));
        
        // Restore state from snapshot
        await fs.writeFile('world.state.json', JSON.stringify(data.worldState, null, 2));
        await fs.writeFile('player.state.json', JSON.stringify(data.playerState, null, 2));
        
        // Update metadata to point to snapshot turn
        await this.updateMetadataToTurn(sessionId, data.turnId);
        
        return { recovered: true, fromTurn: data.turnId };
      } catch (e) {
        continue; // Try older snapshot
      }
    }
    
    return { recovered: false, error: 'No valid snapshots found' };
  }
}
```

---

## Migration from Single File

If you have existing single-file sessions:

```javascript
async function migrateSession(oldSessionFile, newSessionDir) {
  const oldData = JSON.parse(await fs.readFile(oldSessionFile));
  
  // Create directory structure
  await fs.mkdir(newSessionDir, { recursive: true });
  await fs.mkdir(`${newSessionDir}/scenes`);
  await fs.mkdir(`${newSessionDir}/turns`);
  await fs.mkdir(`${newSessionDir}/snapshots`);
  await fs.mkdir(`${newSessionDir}/indexes`);
  
  // Extract and write metadata
  const meta = extractMetadata(oldData);
  await fs.writeFile(`${newSessionDir}/session.meta.json`, JSON.stringify(meta, null, 2));
  
  // Extract and write state
  await fs.writeFile(`${newSessionDir}/world.state.json`, JSON.stringify(oldData.worldState, null, 2));
  await fs.writeFile(`${newSessionDir}/player.state.json`, JSON.stringify(extractPlayerState(oldData), null, 2));
  
  // Split frames into turns
  const turns = convertFramesToTurns(oldData.frames);
  await writeTurnFiles(newSessionDir, turns);
  
  // Create checkpoints as snapshots
  for (const checkpoint of oldData.checkpoints) {
    await writeSnapshot(newSessionDir, checkpoint);
  }
  
  // Generate indexes
  await generateIndexes(newSessionDir);
}
```

---

## Summary

This multi-file architecture provides:

1. **Efficient access** - Load only what you need
2. **Safe writes** - Append-only turn and delta logging
3. **Delta tracking** - All state changes recorded for replay
4. **Quick recovery** - Snapshots enable fast restoration
5. **Scalability** - Sessions can grow without performance degradation
6. **Flexibility** - Different access patterns supported
7. **Integrity** - Corruption isolated to individual files
8. **Replay support** - Deltas enable precise state reconstruction
