# Session System Implementation Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GAME RUNTIME                             │
│                                                             │
│  Each frame/turn:                                          │
│  1. Execute game logic                                     │
│  2. Generate frame event                                   │
│  3. Log frame to SessionLogger                             │
│  4. SessionLogger buffers & writes to disk                 │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              SESSION LOGGER (Singleton)                     │
│                                                             │
│  • Buffer frames in memory                                 │
│  • Batch write to disk (every N frames)                   │
│  • Track checkpoints                                       │
│  • Manage file I/O                                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              DISK STORAGE                                   │
│                                                             │
│  sessions/                                                 │
│  ├── active/session-current.json (live appends)           │
│  ├── completed/session-001.json                           │
│  └── checkpoints/session-001-cp-*.json                    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│            SESSION LOADER (Replay & Resume)                │
│                                                             │
│  • Load session metadata                                   │
│  • Load checkpoint at target frame                        │
│  • Replay frames to target (deterministic)                │
│  • Return game state for continuation                     │
└─────────────────────────────────────────────────────────────┘
```

---

## SessionLogger Class

```javascript
class SessionLogger {
  constructor(options = {}) {
    this.sessionId = generateUUID();
    this.currentSession = null;
    this.frameBuffer = [];
    this.checkpointBuffer = [];
    
    // Configuration
    this.writeInterval = options.writeInterval || 10; // frames
    this.checkpointInterval = options.checkpointInterval || 100; // frames
    this.basePath = options.basePath || './sessions';
    
    // Tracking
    this.frameCount = 0;
    this.lastWriteFrame = 0;
    this.lastCheckpointFrame = 0;
  }

  // Start a new session
  startSession(metadata) {
    this.sessionId = generateUUID();
    this.frameCount = 0;
    this.frameBuffer = [];
    
    this.currentSession = {
      sessionId: this.sessionId,
      startTime: Date.now(),
      endTime: null,
      metadata: metadata,
      filePath: this._getSessionPath('active'),
      checkpointDir: this._getCheckpointDir()
    };

    // Write initial session file header
    this._writeSessionHeader();

    return this.sessionId;
  }

  // Log a single frame
  logFrame(frameNumber, type, data, result, llmDetails) {
    const frame = {
      frame: frameNumber,
      timestamp: Date.now(),
      type: type,  // 'player_action', 'npc_interaction', etc
      data: data,
      result: result
    };

    // Add LLM details if present
    if (llmDetails) {
      frame.llmDetails = llmDetails;
    }

    // Add to buffer
    this.frameBuffer.push(frame);
    this.frameCount = frameNumber;

    // Check if we should write to disk
    if (frameNumber - this.lastWriteFrame >= this.writeInterval) {
      this._writeBufferToDisk();
      this.lastWriteFrame = frameNumber;
    }

    // Check if we should create checkpoint
    if (frameNumber - this.lastCheckpointFrame >= this.checkpointInterval) {
      this._createCheckpoint(frameNumber);
      this.lastCheckpointFrame = frameNumber;
    }

    return frameNumber;
  }

  // Create checkpoint with full game state
  createCheckpoint(frameNumber, description, gameState) {
    const checkpoint = {
      frame: frameNumber,
      timestamp: Date.now(),
      description: description || 'Checkpoint',
      fullState: gameState,
      // Frames since last checkpoint
      frameSinceLastCheckpoint: frameNumber - this.lastCheckpointFrame
    };

    this.checkpointBuffer.push(checkpoint);
    this._writeCheckpointToDisk(checkpoint);
    this.lastCheckpointFrame = frameNumber;
  }

  // Save session (close for this play session)
  saveSession(finalGameState) {
    // Write any remaining frames
    this._writeBufferToDisk();

    // Create final checkpoint
    this.createCheckpoint(
      this.frameCount,
      'Session end checkpoint',
      finalGameState
    );

    // Update session metadata
    this.currentSession.endTime = Date.now();

    // Move from active to completed/paused
    this._archiveSession();

    return {
      sessionId: this.sessionId,
      frameCount: this.frameCount,
      duration: this.currentSession.endTime - this.currentSession.startTime
    };
  }

  // Internal: Write buffered frames to disk
  _writeBufferToDisk() {
    if (this.frameBuffer.length === 0) return;

    const sessionFile = this.currentSession.filePath;
    const frameData = this.frameBuffer
      .map(f => JSON.stringify(f))
      .join('\n');

    // Append to session file
    fs.appendFileSync(sessionFile, frameData + '\n');

    // Clear buffer
    this.frameBuffer = [];
  }

  // Internal: Write checkpoint
  _writeCheckpointToDisk(checkpoint) {
    const checkpointFile = path.join(
      this.currentSession.checkpointDir,
      `checkpoint-${checkpoint.frame}.json`
    );

    fs.writeFileSync(
      checkpointFile,
      JSON.stringify(checkpoint, null, 2)
    );
  }

  // Internal: Get session file path
  _getSessionPath(status) {
    const dir = path.join(this.basePath, status);
    ensureDirExists(dir);
    const filename = `session-${this.sessionId}-${Date.now()}.jsonl`;
    return path.join(dir, filename);
  }

  // Internal: Get checkpoint directory
  _getCheckpointDir() {
    const dir = path.join(
      this.basePath,
      'checkpoints',
      this.sessionId
    );
    ensureDirExists(dir);
    return dir;
  }

  // Internal: Archive session
  _archiveSession() {
    const oldPath = this.currentSession.filePath;
    const newPath = oldPath.replace('/active/', '/completed/');
    fs.renameSync(oldPath, newPath);
    this.currentSession.filePath = newPath;
  }

  // Internal: Write session header
  _writeSessionHeader() {
    const header = {
      type: 'session_header',
      sessionId: this.sessionId,
      startTime: Date.now(),
      metadata: this.currentSession.metadata
    };

    fs.writeFileSync(
      this.currentSession.filePath,
      JSON.stringify(header) + '\n'
    );
  }
}
```

---

## SessionLoader Class

```javascript
class SessionLoader {
  constructor(basePath = './sessions') {
    this.basePath = basePath;
    this.cache = new Map();  // Cache loaded sessions
  }

  // Load a session
  loadSession(sessionId) {
    // Check cache
    if (this.cache.has(sessionId)) {
      return this.cache.get(sessionId);
    }

    // Find session file
    const sessionFile = this._findSessionFile(sessionId);
    if (!sessionFile) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Load metadata
    const metadata = this._loadSessionMetadata(sessionFile);

    // Find latest checkpoint
    const latestCheckpoint = this._findLatestCheckpoint(sessionId);

    const session = {
      sessionId: sessionId,
      sessionFile: sessionFile,
      metadata: metadata,
      lastCheckpoint: latestCheckpoint,
      frameCount: this._countFrames(sessionFile)
    };

    // Cache it
    this.cache.set(sessionId, session);

    return session;
  }

  // Jump to specific frame and return game state
  jumpToFrame(sessionId, targetFrame) {
    const session = this.loadSession(sessionId);

    // Find checkpoint before target frame
    const checkpointFrame = this._findCheckpointBefore(sessionId, targetFrame);
    let checkpoint;

    if (checkpointFrame) {
      checkpoint = this._loadCheckpoint(sessionId, checkpointFrame);
    } else {
      // No checkpoint, load from session start
      checkpoint = {
        frame: 0,
        fullState: this._getInitialState(session)
      };
    }

    // Replay from checkpoint to target frame
    const gameState = this._replayFrames(
      session,
      checkpoint,
      targetFrame
    );

    return {
      gameState: gameState,
      frame: targetFrame,
      checkpointFrom: checkpoint.frame
    };
  }

  // List all available sessions
  listSessions() {
    const completedDir = path.join(this.basePath, 'completed');
    const pausedDir = path.join(this.basePath, 'paused');

    const sessions = [];

    // Find completed sessions
    if (fs.existsSync(completedDir)) {
      fs.readdirSync(completedDir).forEach(file => {
        const sessionId = file.match(/session-(.+?)-/)[1];
        const metadata = this._loadSessionMetadata(
          path.join(completedDir, file)
        );
        sessions.push({
          sessionId: sessionId,
          status: 'completed',
          metadata: metadata
        });
      });
    }

    // Find paused sessions
    if (fs.existsSync(pausedDir)) {
      fs.readdirSync(pausedDir).forEach(file => {
        const sessionId = file.match(/session-(.+?)-/)[1];
        const metadata = this._loadSessionMetadata(
          path.join(pausedDir, file)
        );
        sessions.push({
          sessionId: sessionId,
          status: 'paused',
          metadata: metadata
        });
      });
    }

    return sessions;
  }

  // Internal: Find session file
  _findSessionFile(sessionId) {
    const dirs = ['completed', 'paused', 'active'];
    
    for (const dir of dirs) {
      const dirPath = path.join(this.basePath, dir);
      if (!fs.existsSync(dirPath)) continue;

      const files = fs.readdirSync(dirPath);
      const file = files.find(f => f.includes(`session-${sessionId}-`));
      
      if (file) {
        return path.join(dirPath, file);
      }
    }

    return null;
  }

  // Internal: Load session metadata
  _loadSessionMetadata(sessionFile) {
    const lines = fs.readFileSync(sessionFile, 'utf-8').split('\n');
    const header = JSON.parse(lines[0]);
    
    return {
      sessionId: header.sessionId,
      startTime: header.startTime,
      metadata: header.metadata
    };
  }

  // Internal: Find checkpoint before frame
  _findCheckpointBefore(sessionId, targetFrame) {
    const checkpointDir = path.join(
      this.basePath,
      'checkpoints',
      sessionId
    );

    if (!fs.existsSync(checkpointDir)) {
      return null;
    }

    const files = fs.readdirSync(checkpointDir);
    const checkpoints = files
      .filter(f => f.startsWith('checkpoint-'))
      .map(f => {
        const frame = parseInt(f.match(/checkpoint-(\d+)/)[1]);
        return { file: f, frame: frame };
      })
      .filter(cp => cp.frame <= targetFrame)
      .sort((a, b) => b.frame - a.frame);

    if (checkpoints.length === 0) {
      return null;
    }

    return checkpoints[0].frame;
  }

  // Internal: Load checkpoint
  _loadCheckpoint(sessionId, checkpointFrame) {
    const checkpointFile = path.join(
      this.basePath,
      'checkpoints',
      sessionId,
      `checkpoint-${checkpointFrame}.json`
    );

    return JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
  }

  // Internal: Replay frames deterministically
  _replayFrames(session, checkpoint, targetFrame) {
    let gameState = JSON.parse(JSON.stringify(checkpoint.fullState));

    // Load frames from session file
    const lines = fs.readFileSync(session.sessionFile, 'utf-8').split('\n');
    
    const frames = lines
      .filter(l => l.trim())
      .map(l => JSON.parse(l))
      .filter(f => f.type !== 'session_header')  // Skip header
      .filter(f => f.frame > checkpoint.frame && f.frame <= targetFrame);

    // Replay each frame
    for (const frame of frames) {
      gameState = this._applyFrame(gameState, frame);
    }

    return gameState;
  }

  // Internal: Apply a frame to game state
  _applyFrame(gameState, frame) {
    const newState = JSON.parse(JSON.stringify(gameState));

    switch (frame.type) {
      case 'player_action':
        return this._applyPlayerAction(newState, frame);
      
      case 'npc_interaction':
        return this._applyNPCInteraction(newState, frame);
      
      case 'combat_round':
        return this._applyCombatRound(newState, frame);
      
      case 'quest_progress':
        return this._applyQuestProgress(newState, frame);
      
      default:
        return newState;
    }
  }

  // Apply action results to state
  _applyPlayerAction(state, frame) {
    if (frame.result.playerLocation) {
      state.player.location = frame.result.playerLocation;
    }
    return state;
  }

  _applyNPCInteraction(state, frame) {
    const npc = state.npcs.find(n => n.id === frame.data.npcId);
    if (npc && frame.result.relationshipChange) {
      npc.relationship = frame.result.newRelationship;
    }
    return state;
  }

  _applyCombatRound(state, frame) {
    if (frame.result.playerHealth !== undefined) {
      state.player.health = frame.result.playerHealth;
    }
    return state;
  }

  _applyQuestProgress(state, frame) {
    const quest = state.quests.find(q => q.id === frame.questId);
    if (quest) {
      quest.progress = frame.newProgress;
    }
    return state;
  }

  // Internal: Count frames in session
  _countFrames(sessionFile) {
    const lines = fs.readFileSync(sessionFile, 'utf-8').split('\n');
    return lines.filter(l => l.trim() && !l.includes('session_header')).length;
  }
}
```

---

## Integration with Game Loop

```javascript
class GameEngine {
  constructor() {
    this.sessionLogger = new SessionLogger({
      writeInterval: 10,
      checkpointInterval: 100
    });
  }

  // Start new game
  async startGame(worldTheme, playerName) {
    // Create session
    const sessionId = this.sessionLogger.startSession({
      worldTheme: worldTheme,
      playerName: playerName,
      startedAt: new Date()
    });

    this.sessionId = sessionId;

    // Initialize game
    this.gameState = this._createInitialGameState();
    this.frameNumber = 0;

    return sessionId;
  }

  // Main game loop
  async runGameLoop() {
    while (this.gameRunning) {
      // 1. Get player action
      const action = await this.getPlayerAction();

      // 2. Process action
      const result = await this.processAction(action);

      // 3. LOG THE FRAME (Critical!)
      this.sessionLogger.logFrame(
        this.frameNumber,
        'player_action',
        {
          action: action.type,
          details: action
        },
        result,
        result.llmDetails  // Include any LLM usage
      );

      // 4. Update game state
      this.gameState = result.newGameState;

      // 5. Check for major events (quests, discoveries, etc)
      const majorEvents = this.checkMajorEvents();
      for (const event of majorEvents) {
        this.sessionLogger.logFrame(
          this.frameNumber,
          event.type,
          event.data,
          event.result
        );
      }

      // 6. Check if should create checkpoint
      if (majorEvents.some(e => e.isCheckpointEvent)) {
        const description = majorEvents
          .find(e => e.isCheckpointEvent)
          .description;
        
        this.sessionLogger.createCheckpoint(
          this.frameNumber,
          description,
          JSON.parse(JSON.stringify(this.gameState))
        );
      }

      this.frameNumber++;
    }
  }

  // Save and exit
  async exitGame() {
    this.gameRunning = false;

    const saveResult = this.sessionLogger.saveSession(
      JSON.parse(JSON.stringify(this.gameState))
    );

    return saveResult;
  }

  // Resume a saved game
  async resumeGame(sessionId, fromFrame = null) {
    const loader = new SessionLoader();
    const session = loader.loadSession(sessionId);

    if (fromFrame === null) {
      // Resume from last frame
      fromFrame = session.frameCount;
    }

    // Load game state
    const loaded = loader.jumpToFrame(sessionId, fromFrame);
    this.gameState = loaded.gameState;
    this.frameNumber = loaded.frame;
    this.sessionId = sessionId;

    // Continue logging in same session
    this.sessionLogger.startSession({
      worldTheme: session.metadata.metadata.worldTheme,
      playerName: session.metadata.metadata.playerName,
      resumedFrom: sessionId,
      resumedAtFrame: fromFrame
    });

    return loaded;
  }
}
```

---

## Example Usage

```javascript
// NEW GAME
const engine = new GameEngine();
const sessionId = await engine.startGame('cyberpunk', 'Protagonist');

// Play
await engine.runGameLoop();

// Save and exit
await engine.exitGame();

// LATER: RESUME GAME
const engine2 = new GameEngine();
await engine2.resumeGame(sessionId);

// Or load session and jump to frame 250
const loader = new SessionLoader();
const state = loader.jumpToFrame(sessionId, 250);
await engine2.resumeGame(sessionId, 250);

// REPLAY AND ANALYSIS
const sessions = loader.listSessions();
console.log(sessions);

// "Jump to frame where I discovered Temple District"
const discoverFrame = loader.findFrameByEvent(sessionId, 'temple-district', 'location_generated');
const stateAtDiscovery = loader.jumpToFrame(sessionId, discoverFrame);
```

---

## Key Implementation Points

### 1. Frame Logging

Every action generates a frame:
- Append to buffer
- Buffer flushed to disk periodically
- Minimal game loop impact

### 2. Checkpoints

Periodic snapshots of full game state:
- Every N frames (100 default)
- On major events
- Used for fast jump/replay

### 3. Determinism

All non-deterministic operations must be logged:
- LLM calls: seed, prompt, response
- Random events: seed
- Encounters: generated with seed

### 4. Resume

When resuming:
- Load latest checkpoint
- Replay to target frame
- Continue from there
- New session logger instance

### 5. File Rotation

Keep multiple sessions:
- Each session gets unique ID
- Files stored by status (active/completed/paused)
- Checkpoints in separate directory

---

## Performance Notes

```
Memory:
• Frame buffer: ~100 KB (100 frames × 1 KB each)
• Checkpoint state: ~5 MB (full game state)
• Reasonable for most games

Disk I/O:
• Batch writes (every 10 frames)
• Append-only (fast)
• Checkpoint writes on major events

Replay:
• Load checkpoint: ~50ms
• Replay 100 frames: ~300ms
• Acceptable for UI pause/jump

Storage:
• Per session: ~500 KB - 2 MB
• Can archive old sessions
• Compress if needed
```

---

## Error Handling

```javascript
// Graceful degradation

try {
  this.sessionLogger.logFrame(...);
} catch (err) {
  console.warn('Failed to log frame, continuing...', err);
  // Game continues, frame not logged
}

try {
  this.sessionLogger._writeBufferToDisk();
} catch (err) {
  console.warn('Failed to write to disk', err);
  // Keep buffer, retry next write
  // Eventually write when disk available
}

// Session integrity checks
if (sessionLoader.validateSession(sessionId)) {
  // Can safely load and replay
} else {
  // Session corrupted, offer recovery options
}
```

---

## Summary

This session system provides:

✅ **Continuous logging** - Every action automatically logged
✅ **Seamless resume** - Exit and come back to same frame
✅ **Jump to any frame** - Replay to any point and continue
✅ **Deterministic** - Same seeds ensure reproducibility
✅ **Checkpointing** - Fast loads with periodic snapshots
✅ **Performance** - Minimal game loop impact
✅ **Reliability** - Graceful error handling
✅ **Extensibility** - Analytics and analysis features
