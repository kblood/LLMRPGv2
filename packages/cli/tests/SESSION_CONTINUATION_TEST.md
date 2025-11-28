# Session Continuation Test Guide

## Overview

The `session_continuation_test.ts` is a comprehensive test that validates the save/load functionality of LLMRPGv2 sessions. It ensures that:

1. **Sessions can be loaded** from disk with all state restored
2. **Gameplay can be continued** seamlessly after loading
3. **Game state is valid** (player, world, character all present)
4. **Turn continuity** is maintained across save/load cycles

## What the Test Does

### Phase 1: Load Existing Session
- Locates a saved session by ID
- Loads the complete game state from disk
- Validates load time performance
- Measures how long the load operation takes

### Phase 2: Validate Loaded State
Checks four critical validation points:

| Check | Purpose |
|-------|---------|
| **Player Name** | Confirms player character was restored |
| **World State** | Verifies location and environment loaded |
| **Character State** | Ensures aspects, skills, and personality restored |
| **Turn Continuity** | Validates that turn count was preserved |

### Phase 3: Continue Gameplay
- Runs 5 additional turns of gameplay
- AI player makes decisions based on loaded state
- Executes actions and generates new turns
- Measures continuation performance

### Phase 4: Final Save
- Persists the continued session
- Ensures new turns are properly saved
- Validates that the session can be loaded again

## Usage

```bash
# Basic usage - load and continue a session
npx tsx tests/session_continuation_test.ts <sessionId>

# Example with actual session ID from 10-minute test
npx tsx tests/session_continuation_test.ts granite-10min-test-1764256691345

# List available sessions first
ls packages/cli/test-sessions/sessions/active/
```

## Output

The test generates a comprehensive report including:

```
╔══════════════════════════════════════════════════════════════════╗
║                CONTINUATION TEST REPORT                         ║
╚══════════════════════════════════════════════════════════════════╝

📂 SESSION INFO
─────────────────────────────────────────────────────────────────
   Session ID:     granite-10min-test-1764256691345
   Original Turns: 97
   Loaded Turns:   97
   Added Turns:    5
   Total Turns:    102

⏱️  PERFORMANCE
─────────────────────────────────────────────────────────────────
   Load Time:        2.3s
   Continuation:     18.5s
   Total Test Time:  25.1s

🔍 STATE VALIDATION
─────────────────────────────────────────────────────────────────
   Player Name:      ✅
   World State:      ✅
   Character State:  ✅
   Turn Continuity:  ✅
   Overall:          4/4 checks passed

🎉 CONTINUATION TEST PASSED
   Session loaded and continued successfully!
```

## Interpretation

### Success Criteria
- ✅ All 4 state validation checks pass
- ✅ No errors during continuation
- ✅ New turns are successfully created
- ✅ Final save completes without error

### Performance Baselines
- **Load Time**: Should be <5 seconds (depends on session size)
- **Continuation**: ~3-4 seconds per turn with Granite4:3b
- **Total Duration**: Typically 20-30 seconds for 5-turn continuation

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Session not found" | Invalid session ID | Check session ID exists in test-sessions folder |
| "Player not found" | Corrupted session state | Regenerate the session by running 10-min test |
| "Load failed" | Storage adapter issue | Verify STORAGE_PATH points to correct directory |
| Continuation hangs | LLM timeout | Increase timeout or check Ollama is running |

## Integration with 10-Minute Test

Typical workflow:

```bash
# 1. Run 10-minute comprehensive test
npx tsx tests/ten_minute_granite_test.ts
# Output shows: Session saved at test-sessions/sessions/active/granite-10min-test-XXX

# 2. Get the session ID from the output
# Example: granite-10min-test-1764256691345

# 3. Test session continuation
npx tsx tests/session_continuation_test.ts granite-10min-test-1764256691345

# 4. Verify results - should show 4/4 validation checks passed
```

## What Gets Tested

### Save/Load Mechanics
- ✅ FileSystemAdapter reads/writes correctly
- ✅ SessionLoader restores WorldManager state
- ✅ Player character is fully reconstructed
- ✅ NPCs and their state are preserved
- ✅ Turn history is accessible

### Gameplay Continuity
- ✅ AI player can make decisions with loaded context
- ✅ New turns are created and saved
- ✅ Events are properly logged
- ✅ Deltas are collected for new actions
- ✅ Final save captures all new state

### State Integrity
- ✅ Location information is accurate
- ✅ Aspects and skills are unchanged
- ✅ Fate Point counts are correct
- ✅ Turn numbers continue sequentially
- ✅ No data corruption on load

## Extending the Test

To add more validation checks, modify `validateLoadedState()`:

```typescript
// Add a new validation check
if (context.worldState?.quests && context.worldState.quests.length > 0) {
  this.results.stateValidation.questsLoaded = true;
  console.log(`   ✅ Quests: ${context.worldState.quests.length} loaded`);
} else {
  console.log('   ℹ️ No quests in session');
}
```

To increase continuation turns, modify `ADDITIONAL_TURNS`:

```typescript
const ADDITIONAL_TURNS = 10; // Run 10 turns instead of 5
```

## Related Tests

- **`ten_minute_granite_test.ts`**: Creates the initial session
- **`save_load.test.ts`**: Unit tests for save/load functionality
- **`integration.test.ts`**: Full game loop integration tests

## See Also

- [SESSION_LOGGING_AND_REPLAY.md](../../docs/SESSION_LOGGING_AND_REPLAY.md) - Technical details on session architecture
- [SESSION_FILE_ARCHITECTURE.md](../../docs/SESSION_FILE_ARCHITECTURE.md) - File structure documentation
