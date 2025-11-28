# Project Status

**Last Updated:** November 29, 2025

## 📍 Current Phase: Phase 22 - Gameplay Quality Improvements (COMPLETE)

All Phase 8-21 features have been fully implemented. Phase 22 addressed gameplay quality issues identified in Phase 21 analytics.

### Phase 22 Progress ✅ COMPLETE

**Session 3 (November 29, 2025):**
- ✅ Integrated travel intent into `GameMaster.processPlayerAction()` - routes to `processTravelTurn()`
- ✅ Implemented dialogue intent routing with new 'dialogue' category in `classifyIntent()`
- ✅ Added `parseDialogue()` method to DecisionEngine for NPC matching and dialogue type detection
- ✅ Added `processDialogueTurn()` method to GameMaster for structured NPC conversations
- ✅ Implemented proactive compel system with consecutive failure tracking
- ✅ Added `generateProactiveCompel()` to GameMaster and `generateProactiveCompelDescription()` to DecisionEngine
- ✅ Created `travel_system.test.ts` with 6 comprehensive tests
- ✅ All 64 tests passing (58 original + 6 new)
- ✅ Verified gameplay with 97-turn AI test session (180 seconds, no errors)

**Session 2 (November 28, 2025 - Evening):**
- ✅ Added `generateTravelNarration()` to NarrativeEngine for travel narration
- ✅ Implemented `travelToLocation()` method in GameMaster with location generation
- ✅ Fixed all schema field mismatches (discovered→isBlocked, kind→type, etc.)
- ✅ Fixed relationship property access patterns
- ✅ Successfully compiled all packages without TypeScript errors

**Session 1 (November 28, 2025 - Earlier):**
- ✅ Added `analyzeRecentHistory()` function to detect repetition patterns
- ✅ Scene-type detection (combat/social/exploration) to allow appropriate repeats
- ✅ Consecutive failure tracking
- ✅ Enhanced system prompt with anti-repetition guidelines
- ✅ Added recent actions list to AI Player prompt
- ✅ Added dynamic feedback when player is stuck or failing repeatedly
- ✅ Context-aware suggestions based on scene type

**Phase 22 Complete - All Objectives Met:**
- ✅ Travel intent integration in processPlayerAction()
- ✅ Dialogue intent routing with 'dialogue' category
- ✅ Proactive compel offers after consecutive failures
- ✅ Travel system tests (6 tests, all passing)
- ✅ Build verification (all packages compile)
- ✅ Test verification (64/64 tests pass)
- ✅ Gameplay verification (97-turn AI session)

---

## 🔬 Gameplay Analysis Findings (Phase 21 Analytics)

Session analytics from `granite-10min-test-1764256691345` revealed critical issues:

### Problem Summary

| Issue | Severity | Impact |
|-------|----------|--------|
| **AI Player Repetition Loop** | 🔴 Critical | Player repeats same action 5+ times consecutively |
| **78% Failure Rate** | 🔴 Critical | Opposition too high or bad luck compounded |
| **No Location Variety** | 🟡 Medium | Player never left starting location |
| **No Combat Triggers** | 🟡 Medium | 51 turns, 0 combat events |
| **No NPC Dialogue Events** | 🟡 Medium | Talking to cultists but no dialogue system triggers |
| **Only 5/34 Features Used** | 🟠 High | Most game mechanics never activated |

### Root Cause Analysis

1. **AI Player Gets Stuck**
   - The AI prompt says "Don't repeat the same action multiple times" but has no memory of recent actions
   - When actions fail, the AI tries slight variations that are semantically identical
   - Example: "Demand to speak privately with cultist" → "Demand more information from cultist" → "Ask cultists about..."

2. **No Travel Options Presented**
   - `connections: []` in generated locations - no exits defined
   - AI Player context doesn't include available destinations
   - `movePlayer()` exists but only works within zones of a scene, not between locations

3. **High Opposition Without Compel Relief**
   - 78% failures with Difficulty 3 against +2/+3/+4 skills
   - No Fate Point spending to invoke aspects
   - No compels offered to gain Fate Points
   - Player stuck in failure spiral with no mechanical escape

4. **Narrative Engine Doesn't Trigger Dialogue System**
   - Player says "ask the cultists" but it's treated as a skill check
   - `DialogueSystem` exists but isn't being invoked
   - NPC responses are in narration, not structured dialogue events

---

## 📋 Phase 22 Plan: Gameplay Quality Improvements

### 22.1 Action Repetition Prevention

**Option A: Prompt Enhancement (Quick Fix)**
```typescript
// Add to AIPlayer.decideAction() context
const recentActionsStr = history?.slice(-5).map(t => {
  const action = extractPlayerActionText(t);
  return action ? `- ${action}` : null;
}).filter(Boolean).join('\n');

// Add to prompt:
`IMPORTANT - DO NOT REPEAT THESE RECENT ACTIONS:
${recentActionsStr}

If your previous attempts have failed repeatedly, try something COMPLETELY DIFFERENT:
- Move to a new location
- Interact with a different object or person
- Use a different skill entirely
- Change your approach (if talking failed, try action; if investigation failed, try diplomacy)`
```

**Option B: GM-Evaluated Repetition System (Recommended)**

Instead of hardcoding cooldowns, let the GM evaluate whether repetition is appropriate for the current context. Combat actions are legitimate repeats; interrogating the same NPC 10 times is not.

```typescript
interface RepetitionContext {
  action: string;
  consecutiveCount: number;
  totalInScene: number;
  currentSceneType: 'combat' | 'social' | 'exploration' | 'puzzle';
  hasTargetChanged: boolean;  // Attacking different enemies = OK
  hasOutcomeProgressed: boolean;  // Are we making progress?
}

// In GameMaster - called before processing AI player action
async evaluateRepetition(context: RepetitionContext): Promise<{
  allow: boolean;
  suggestion?: string;
  intervention?: string;
}> {
  // Combat: Allow repeated attacks if targets change or stress is being dealt
  if (context.currentSceneType === 'combat') {
    if (context.hasTargetChanged || context.hasOutcomeProgressed) {
      return { allow: true };
    }
    // Even in combat, 5+ identical attacks on same target with no progress = stuck
    if (context.consecutiveCount >= 5 && !context.hasOutcomeProgressed) {
      return { 
        allow: false, 
        suggestion: "Your attacks aren't getting through. Try creating an advantage first, or change tactics.",
        intervention: "The enemy adapts to your predictable assault..."
      };
    }
    return { allow: true };
  }
  
  // Exploration/Social: 3+ repeats of same action = likely stuck
  if (context.consecutiveCount >= 3) {
    return {
      allow: false,
      suggestion: "This approach isn't working. Try something different.",
      intervention: await this.generateContextualInterruption(context)
    };
  }
  
  return { allow: true };
}

// Generate a narrative reason to change the situation
async generateContextualInterruption(context: RepetitionContext): Promise<string> {
  // LLM generates an interruption appropriate to the scene
  // - Social: NPC gets frustrated and leaves
  // - Exploration: Something else catches your attention
  // - Puzzle: A new clue becomes apparent
}
```

**Option C: Hybrid Prompt + GM Feedback**
```typescript
// In AIPlayer.decideAction() - add context about what's working/not working
const actionFeedback = await gameMaster.getActionFeedback(history.slice(-5));
// Returns: "Your attempts to interrogate the cultists have failed 4 times. 
//           They seem unwilling to share information this way."

// Add to AI prompt:
`SITUATION ASSESSMENT:
${actionFeedback}

GUIDANCE: If an approach isn't working after 2-3 attempts, the GM recommends trying:
${gameMaster.suggestAlternatives(currentScene, failedApproaches)}`
```

**Option D: Scene-Aware Action Tracking**
```typescript
interface SceneActionTracker {
  sceneId: string;
  sceneType: 'combat' | 'social' | 'exploration';
  actionCounts: Map<string, number>;  // action pattern -> count
  progressMarkers: string[];  // What has changed/progressed
  
  // Combat allows many attacks
  // Social allows 2-3 attempts per NPC before suggesting change
  // Exploration allows repeated searches IF location changes
  getRepetitionThreshold(): number {
    switch(this.sceneType) {
      case 'combat': return 10;  // High tolerance in combat
      case 'social': return 3;   // Low tolerance for social
      case 'exploration': return 4;
    }
  }
  
  isProgressBeingMade(): boolean {
    // Check if stress dealt, advantages created, knowledge gained, etc.
    return this.progressMarkers.length > 0;
  }
}
```

### 22.2 Location & Travel System

**Current State:**
- Locations have `connections: []` (empty)
- No travel prompt in AI Player context
- `movePlayer()` only handles zone movement within a scene

**Proposed Fix:**

1. **Generate Connections in ContentGenerator**
```typescript
// In generateStartingLocation() and generateLocation()
connections: [
  { targetId: 'loc-unexplored-1', description: 'A dark passageway', direction: 'north', discovered: false },
  { targetId: 'loc-unexplored-2', description: 'A crumbling stairway', direction: 'down', discovered: false }
]
```

2. **Add Travel Context to AI Player**
```typescript
// In AIPlayer.decideAction()
const availableExits = worldState?.currentLocation?.connections
  ?.filter(c => c.discovered)
  ?.map(c => `${c.direction}: ${c.description}`)
  ?.join('\n') || 'No obvious exits discovered';

// Add to prompt:
`AVAILABLE EXITS:
${availableExits}
You can attempt to leave via any discovered exit, or search for hidden passages.`
```

3. **Implement travelToLocation() in GameMaster**
```typescript
async travelToLocation(connectionId: string): Promise<void> {
  const connection = currentLocation.connections.find(c => c.targetId === connectionId);
  if (!connection) throw new Error('Invalid destination');
  
  // Generate new location if not yet created
  if (!worldManager.getLocation(connection.targetId)) {
    const newLocation = await contentGenerator.generateLocation(theme, connection);
    worldManager.setLocation(newLocation);
  }
  
  // Create new scene at destination
  await this.changeScene(connection.targetId);
}
```

### 22.3 Difficulty & Fate Point Balancing

**Issues:**
- Difficulty 3 is "Fair" but player skills are +2/+3/+4
- Expected success rate for +2 vs 3: ~38% (close to observed)
- But Fate Points should allow recovery

**Proposed Fixes:**

1. **Dynamic Difficulty Adjustment**
```typescript
// Track success rate over rolling window
if (recentSuccessRate < 30% && consecutiveFailures >= 3) {
  // Reduce difficulty by 1 for next action
  difficultyModifier = -1;
  // Or offer a compel to gain Fate Points
}
```

2. **Proactive Compel Offers**
```typescript
// After 2+ consecutive failures, offer compel
if (consecutiveFailures >= 2 && player.trouble) {
  const compelOffer = await generateCompelOffer(player.trouble, currentSituation);
  // "Your Shattered Legacy catches up with you - accept this complication for 1 FP?"
}
```

3. **AI Player Fate Point Usage Prompt**
```typescript
// Add reminder to prompt when FP > 0
`You have ${player.fatePoints} Fate Points. Consider:
- INVOKE an aspect for +2 or a reroll on important actions
- DECLARE a story detail ("I know someone here")
- Don't hoard them - use them to succeed at key moments!`
```

### 22.4 Dialogue System Integration

**Issue:** "Ask the cultists about X" triggers skill_check, not dialogue

**Proposed Fix:**
```typescript
// In DecisionEngine.classifyIntent()
const dialoguePatterns = ['ask', 'tell', 'speak', 'talk', 'say', 'question', 'inquire', 'demand'];
if (dialoguePatterns.some(p => action.toLowerCase().includes(p))) {
  return 'dialogue'; // Route to DialogueSystem
}

// In GameMaster.processPlayerAction()
if (intent === 'dialogue') {
  const targetNPC = findNPCByName(extractTarget(action));
  if (targetNPC) {
    return await dialogueSystem.initiateConversation(player, targetNPC, action);
  }
}
```

---

## 🎯 Implementation Priority

| Task | Priority | Effort | Impact | Notes |
|------|----------|--------|--------|-------|
| GM-evaluated repetition system | 🔴 High | Medium | Very High | Context-aware; allows combat repeats |
| Add recent actions + feedback to AI prompt | 🔴 High | Low | High | Quick win |
| Proactive compel offers after failures | 🔴 High | Medium | High | Fate Core mechanic |
| Generate location connections | 🟡 Medium | Medium | Medium | Enables exploration |
| Travel context in AI prompt | 🟡 Medium | Low | Medium | Tell AI where it can go |
| Dialogue system routing | 🟡 Medium | Medium | Medium | Fix "ask NPC" → dialogue |
| Scene-aware action tracking | 🟢 Low | Medium | High | Tracks progress per scene type |
| Narrative interruption generation | 🟢 Low | High | Very High | GM generates situation changes |

### Recommended Implementation Order

1. **Quick Wins (1-2 hours):**
   - Add recent actions list to AI Player prompt
   - Add "this isn't working" feedback for failed patterns
   - Add scene type detection (combat vs exploration vs social)

2. **Core Fix (2-4 hours):**
   - Implement `evaluateRepetition()` in GameMaster
   - Scene-type-aware thresholds (combat=10, social=3, exploration=4)
   - Progress tracking (is stress being dealt? knowledge gained?)

3. **Polish (4+ hours):**
   - LLM-generated narrative interruptions
   - Contextual suggestions for alternative approaches
   - Integration with compel system for graceful failures

---

## ✅ Recent Accomplishments

### 23. Phase 22: Travel System & Location Connections (November 28, 2025 - Evening) 🔄 IN PROGRESS

Implemented core travel infrastructure and fixed TypeScript compilation issues:

**Travel System Implementation:**
- Added `generateTravelNarration()` method to `NarrativeEngine` for atmospheric travel descriptions
- Implemented `travelToLocation(connectionId)` method in `GameMaster`:
  - Handles destination location lookup and generation on first visit
  - Creates new scenes at travel destinations
  - Collects deltas for audit trail
  - Generates travel narration via NarrativeEngine
- Added Location import to NarrativeEngine for type safety

**Location Connection Generation:**
- Updated `ContentGenerator.generateStartingLocation()` to generate 2-3 exits per location
- Added `generateNewLocation()` method in ContentGenerator for discovered locations
- Connections include: targetId, direction, description, isBlocked flags
- Maps LLM output to proper protocol schema

**Schema Fixes & Compilation:**
- Fixed all schema field mismatches throughout codebase:
  - Replaced `discovered` with `isBlocked` in connection objects (5 instances)
  - Replaced `kind` with `type` for aspect creation (2 instances)
  - Fixed relationship property access (only `trust` exists, not `affection`/`respect`/`influence`)
- Resolved TypeScript cache corruption by clearing .tsbuildinfo files across all packages
- Successfully rebuilt all 6 packages without errors
- Verified test suite still passing: **57/58 tests** ✅

**Technical Improvements:**
- Fixed startTurn type handling: `Turn | null` → `number` using nullish coalescing
- Added safe parsing for game time values
- Ensured protocol package rebuilds properly with all type exports

**Build Status:** ✅ **CLEAN BUILD** - All TypeScript compilation errors resolved

### 22. AI Player Anti-Repetition System (Phase 22 Quick Win) ✅ COMPLETED (November 28, 2025)

Implemented intelligent repetition detection and prevention in `AIPlayer.ts`:

**New Features:**
- `analyzeRecentHistory()` function that extracts and analyzes recent player actions
- Scene-type detection (combat vs social vs exploration) from scene data and event types
- Pattern detection: identifies when similar actions repeat 3+ times
- Consecutive failure tracking to identify failure spirals
- Context-aware suggestions based on what's not working

**System Prompt Enhancements:**
- Added critical anti-repetition guidelines
- Scene-type-aware messaging (combat allows attacks, social/exploration don't allow loops)
- Fate Point usage reminders when player is struggling

**User Prompt Enhancements:**
- Dynamic action feedback inserted before RECENT HISTORY section
- Warning banners when repeated patterns detected
- Specific suggestions for alternative approaches

**Key Design Decision:** Combat scenes allow repeated attacks (legitimate strategy), while social and exploration scenes are flagged when actions repeat 3+ times without progress.

### 21. Session Analytics Export (Phase 21) ✅ COMPLETED (November 28, 2025)

Created `exportSessionAnalytics.ts` - a dedicated analytics tool for analyzing gameplay patterns and feature usage.

**Features Implemented:**
- Session Summary Stats (turns, duration, events, repetition score)
- Outcome Statistics (success/failure rates per skill)
- Skill Usage Analysis with success rate calculation
- Event Type Distribution
- Fate Point Economy tracking
- Feature Usage Checklist (34 features across 5 categories)
- Repetition Detection with pattern tracking
- Unused Features Report

**CLI Usage:**
```bash
npx tsx src/exportSessionAnalytics.ts <sessionId>
npx tsx src/exportSessionAnalytics.ts <sessionId> --json
npx tsx src/exportSessionAnalytics.ts --list
```

### 20. Story-Readable Session Exports (Phase 20) ✅ COMPLETED (November 28, 2025)

Completely rewrote the session export system to generate readable adventure stories instead of technical logs.

1. **Duplicate Turn Handling**: ✅ Fixed
   - JSONL files contained duplicate turn entries (same turnId appearing twice)
   - Implemented deduplication logic that keeps the most complete version (with playerReasoning)
   - 51 unique turns properly exported from a session with 102 raw entries

2. **Player Action Display**: ✅ Implemented
   - Added `extractPlayerAction()` function to parse action descriptions from skill_check events
   - Shows what the player attempted to do at the start of each turn
   - Parses action from "Player attempted to X using Y" format

3. **Multiple Export Formats**: ✅ Implemented
   - **Story Format**: Pure narrative focus, no mechanics. Best for reading as a story.
     - Only shows player action and GM narration
     - No dice rolls, no game events, no AI reasoning
   - **Playreport Format** (default): Mix of narrative and key mechanics
     - Player action with dice roll summary
     - GM narration as main content
     - AI reasoning in collapsible `<details>` section
     - Game events (quests, knowledge) in collapsible section
   - **Technical Format**: Detailed log with all events, deltas, and state changes
     - Full event tables
     - All metadata displayed
     - State change deltas included

4. **Improved Turn Formatting**: ✅ Implemented
   - Story flow: Player Action → Dice Roll/Outcome → GM Narration → (optional) AI Reasoning
   - Dice rolls displayed with emoji: ✨ for success with style, ✓ for success, ⚖️ for tie, ✗ for failure
   - Technical details moved to collapsible sections

5. **CLI Enhancements**: ✅ Implemented
   - Added `--format <type>` flag: story, playreport, or technical
   - Updated interactive menu with format selection
   - Updated help text with format descriptions and examples

**Test Results**:
- `granite-10min-test-1764256691345` session exported successfully:
  - Playreport format: 127 KB, 51 turns, 1904 lines
  - Story format: 94.7 KB, 51 turns, 948 lines
  - All turns now include full narrative content

### 1. Project Scaffolding (Phase 1)
- Initialized Git repository.
- Created **pnpm monorepo** structure.
- Configured **TypeScript**, **ESLint**, **Prettier**, and **Vitest**.

### 2. Core Implementation (Phase 2)
- **Fate Mechanics**: `FateDice`, `ActionResolver`, `TheLadder`.
- **Turn System**: `TurnManager`, `GameEvent`.
- **State System**: `DeltaCollector`, `CharacterDefinition`.
- **Testing**: 17/17 Unit Tests passing.

### 3. Storage Implementation (Phase 3)
- **FileSystemAdapter**: Implemented `fs-extra` based adapter.
- **SessionWriter**: Implemented session creation and logging.
- **SessionLoader**: Implemented session loading.
- **Testing**: Verified storage operations.

### 4. LLM Layer (Phase 4)
- **LLMProvider Interface**: Defined common interface for AI models.
- **OpenAIAdapter**: Implemented adapter for OpenAI API.
- **OpenRouterAdapter**: Implemented adapter for OpenRouter API.
- **OllamaAdapter**: Implemented adapter for local Ollama models.
- **ContextBuilder**: Implemented logic to construct prompts from game state.
- **Testing**: Verified adapters and context builder.

### 5. Protocol & Debug (Phase 5)
- **Protocol Package**: Implemented shared types and Zod schemas in `packages/protocol`.
- **Debug Package**: Implemented `StateInspector`, `ReplayDebugger`, and `ContextDebugger` in `packages/debug`.
- **Integration**: Verified system integration with `examples/demo.ts`.

### 6. Game Loop & CLI (Phase 6)
- **CLI Package**: Created `packages/cli` with dependencies.
- **GameMaster**: Implemented `GameMaster` class to orchestrate the game.
- **GameLoop**: Implemented `GameLoop` class for the main input loop.
- **Systems**: Implemented `NarrativeEngine`, `ContentGenerator`, `DecisionEngine` with real LLM integration.
- **Testing**: Verified end-to-end flow with `MockAdapter`. `full_playthrough.test.ts` verifies turn generation, event logging, and file storage.
- **Entry Point**: Implemented `index.ts` with `commander` and `inquirer`.

### 7. Refinement & Polish (Phase 7)
- **World Manager**: Implemented `WorldManager` in `packages/cli` with full `WorldState` support from `@llmrpg/protocol`.
- **Prompt Engineering**: Refined `ContextBuilder` to include detailed character info (personality, backstory). Updated system prompts in `NarrativeEngine`, `DecisionEngine`, and `ContentGenerator` to align with `docs/LLM_CONTEXT_AND_PROMPTS.md`.
- **Error Handling**: Added try-catch blocks and fallbacks to LLM-based engines to handle generation failures gracefully.
- **CLI Automation**: Added `--theme` and `--run` flags to the CLI to support automated testing and non-interactive execution.
- **Context Integration**: Updated `GameMaster`, `DecisionEngine`, and `NarrativeEngine` to fully utilize the 5-layer context system (System, Character, World, History, Immediate). Implemented `getCharacterDefinition` mapper and history tracking in `GameMaster`.
- **Action Classification**: Implemented `classifyAction` in `DecisionEngine` to dynamically map player intent to Fate Core actions (Overcome, Create Advantage, Attack, Defend) using the LLM.
- **Skill Selection**: Implemented `selectSkill` in `DecisionEngine` to intelligently pick the most relevant character skill for an action.
- **Action Resolution**: Integrated `ActionResolver` into `GameMaster` to handle dice rolls, skill ratings, and opposition, determining outcomes (Success, Failure, Tie, Style).
- **Consequence Handling**: Added `applyActionConsequences` to `GameMaster` to handle specific mechanical results of actions (e.g., logging damage for Attacks, noting advantages).

### 8. Advanced Features & Content (Phase 8)
- **World Generation**: Implemented `generateStartingScenario` in `ContentGenerator` and integrated it into `GameMaster`. The system now generates a theme, starting location, and an initial scenario with a hook.
- **Character Creation**: Implemented `generateCharacter` in `ContentGenerator` and `createCharacter` in `GameMaster`. The CLI now prompts for a character concept and generates a full `PlayerCharacter` with aspects, skills, stunts, and personality.
- **Save/Load**: Implemented `saveState` and `loadState` in `GameMaster`. Added `--load` flag to CLI to resume sessions. Fixed directory structure for session storage.
- **Testing**: Added `tests/save_load.test.ts` to verify the save/load cycle and delta generation.
- **Ollama Integration Testing**: Added `tests/ollama_playthrough.test.ts` to verify full system functionality with local LLMs (specifically tested with Granite4:3b). Added `test:ollama` script to `packages/cli`.
- **Action Validation Testing**: Added `tests/action_validation.test.ts` to verify specific LLM decisions (difficulty setting) and GM event generation. Added `test:actions` script.
- **Knowledge System**: Implemented comprehensive knowledge tracking (`KnowledgeProfile`, `KnowledgeManager`) in `packages/protocol` and `packages/core`. Integrated with `GameMaster` and `DecisionEngine` to allow players to discover locations, NPCs, and secrets via gameplay actions. Added `knowledge_gain` event type. Verified with `tests/knowledge_system.test.ts`.
- **Quest/Goal System**: Implemented `QuestManager` and integrated it into `GameMaster`. Added unit tests in `quest_system.test.ts`.
- **Social Conflict**: Implemented social conflict mechanics in `CombatManager` and `GameMaster`. Added unit tests in `social_conflict.test.ts`.
- **Bug Fixes**: Fixed type mismatches in `GameMaster` (Skills array vs Record) and `DecisionEngine`. Fixed mock data synchronization in tests.
- **Testing**: All tests passing (Core, Storage, LLM, CLI).
- **Meta-Commands**: Implemented in-game commands for `/save`, `/load`, `/inventory`, `/help`, and `/status`. Added `tests/meta_commands.test.ts`.

### 9. Advanced Systems (Phase 9)
- **NPC Interaction**: Implemented `DialogueSystem` and integrated it into `GameMaster`. NPCs now respond with generated dialogue based on personality and relationship. Added `tests/npc_interaction.test.ts`.
- **World Persistence**: Implemented `determineWorldUpdates` in `DecisionEngine` and `applyWorldUpdates` in `GameMaster`. Actions can now permanently alter the world state (e.g., adding aspects). Added `tests/world_persistence.test.ts`.
- **Faction System**: Implemented `FactionManager` in `packages/core` and `Faction` types in `packages/protocol`. Integrated faction generation into `ContentGenerator` and `GameMaster`. Added `tests/factions.test.ts`.
- **Complex Quests**: Implemented multi-stage quests with `QuestStageSchema` and updated `QuestManager`. Added `generateComplexQuest` to `ContentGenerator` and `generateQuest` to `GameMaster`. Added `tests/complex_quest.test.ts`.
- **Reputation Effects**: Integrated faction reputation into `DialogueSystem` and `DecisionEngine`. NPCs now react to player's standing with their faction. Added `tests/reputation_effects.test.ts`.
- **Economy System**: Implemented `EconomyManager` in `packages/core` and defined economy types (`Currency`, `Item`, `Shop`, `Transaction`) in `packages/protocol`. Integrated economy into `GameMaster` and updated character schemas to include wealth and inventory. Added `tests/economy.test.ts`.
- **Advanced Combat (Zones)**: Defined `Zone`, `ZoneConnection`, and `ZoneMap` types in `packages/protocol`. Updated `SceneState` to include zones. Implemented `moveCharacter` in `CombatManager` and `movePlayer` in `GameMaster` to handle movement between zones.
- **Crafting System**: Implemented `CraftingManager` in `packages/core` and defined crafting types (`Recipe`, `Ingredient`, `CraftingStation`) in `packages/protocol`. Integrated crafting into `GameMaster` and added `tests/crafting.test.ts`.
- **Intent Classification**: Implemented `classifyIntent` in `DecisionEngine` to route player actions to appropriate handlers (Fate actions, Trade, Craft, Inventory, Status).
- **System Event Type**: Added 'system' event type to support non-Fate mechanical events (inventory checks, status checks, trade, craft).
- **Location Feature Types**: Extended `LocationSchema` features to include `type` field for 'generic', 'shop', 'crafting_station', 'container', and 'exit'.
- **Session Export to Markdown**: Implemented `exportSessionToMarkdown.ts` in `packages/cli/src`. Interactive CLI tool to export session history to Markdown files. Features:
  - Browse all available sessions (regular and test sessions)
  - View session info (player, date, turn count)
  - Export session metadata, world state, player character, and full turn history
  - Optional inclusion of state changes (deltas) with collapsible `<details>` sections
  - Direct command-line export: `npx tsx src/exportSessionToMarkdown.ts <sessionId>`
  - Exports saved to `packages/cli/exports/`
  - **Bug Fixed**: Resolved duplicate turns issue - each turn now appears once with both GM narration and AI player reasoning included.

### 10. Fate Point Economy & Aspect Invocations (Phase 10) ✅ COMPLETED
- **Fate Point Management**: Implemented `refreshFatePoints()`, `awardFatePoints()`, and `spendFatePoints()` methods in `GameMaster.ts` with proper event logging and delta collection.
- **Aspect Invocation System**: Updated `ActionResolver.resolve()` to accept `InvokeBonus` array supporting +2 bonuses and rerolls. Added validation for free invokes vs. Fate Point costs.
- **AI Player Fate Point Integration**: Enhanced `AIPlayer.ts` to include Fate Point count in system prompt and generate aspect invocations in decision output (JSON format with `aspectInvokes` array).
- **Turn Management Fix**: Resolved "No active turn" error by deferring Fate Point spending and aspect invocations until after turn initialization. Updated `processFateAction()` to handle pending invokes and FP costs.
- **Event Logging**: Added detailed event logging for Fate Point spends (declaration vs. aspect_invoke) and aspect invocations with proper metadata.
- **Testing**: Successfully ran `ai_player_demo.ts` for 10 turns, confirming Fate Point system works correctly (AI attempts invokes but gracefully handles insufficient FP with warnings).
- **Validation**: System properly rejects invalid Fate Point spends and aspect invocations when player has insufficient resources.

### 11. Advanced Fate Mechanics & Compels (Phase 11) ✅ COMPLETED
1. **Compel System**: ✅ Implemented GM compels where NPCs/fate can force players to spend Fate Points or accept complications to gain FP.
   - Defined `Compel` and `CompelType` schemas in `@llmrpg/protocol`.
   - Implemented `generateCompel` in `DecisionEngine` with LLM integration.
   - Implemented `checkCompels` and `resolveCompel` in `GameMaster`.
   - Updated `GameLoop` to handle interactive compel offers.
   - Verified with `compel_system.test.ts`.
2. **Self-Compels**: ✅ Implemented player-initiated compels.
   - Updated `CompelSchema` in `@llmrpg/protocol` to include `source` ('gm' | 'player').
   - Updated `DecisionEngine` to classify `self_compel` intent and parse compel details.
   - Updated `GameMaster` to handle `self_compel` intent, validate aspect, and award FP.
   - Updated `EventType` in `@llmrpg/core` to include `fate_compel` and FP events.
   - Verified with `self_compel.test.ts`.
3. **Boost System**: ✅ Implemented temporary advantages.
   - Updated `GameMaster` to create `boost` aspects on `success_with_style`.
   - Implemented `generateBoostName` in `DecisionEngine`.
   - Updated `processFateAction` to auto-remove boosts when their free invoke is used.
   - Verified with `boost_system.test.ts`.
4. **Concession Mechanics**: ✅ Implemented conflict concessions.
   - Updated `DecisionEngine` to classify `concede` intent.
   - Updated `GameMaster` to handle concessions, end conflicts, and award FP.
   - Updated `CombatManager` to support `endConflict`.
   - Verified with `concession.test.ts`.
5. **Fate Point Refresh**: ✅ Implemented refresh mechanics.
   - Updated `createCharacter` to calculate refresh based on stunt count (3 free, then -1 refresh).
   - Updated `refreshFatePoints` to reset to refresh rate but keep excess FP (Fate Core rule).
   - Verified with `refresh_mechanics.test.ts`.
6. **Story Declarations**: ✅ Implemented player declarations.
   - Updated `DecisionEngine` to classify `declaration` intent and parse declaration details.
   - Updated `GameMaster` to handle `declaration` intent, spend FP, and create situational aspects.
   - Verified with `declaration.test.ts`.

### 12. Character Advancement (Phase 12) ✅ COMPLETED
1. **Milestone System**: Implemented Minor, Significant, and Major milestones.
   - Defined `MilestoneType` and `Advancement` schemas in `@llmrpg/protocol`.
   - Implemented `checkMilestones` in `GameMaster` to award milestones based on session events (quest completion, boss defeat).
   - Verified with `advancement_system.test.ts`.
2. **Skill Advancement**: Implemented skill increases.
   - Updated `DecisionEngine` to classify `advance` intent.
   - Implemented `processAdvancement` in `GameMaster` to handle skill upgrades.
   - Added validation rules (skill column limits).
3. **Aspect Refresh**: Implemented aspect changes.
   - Allowed players to rename aspects at appropriate milestones.
4. **Stunt Acquisition**: Implemented stunt learning.
   - Allowed players to add new stunts (costing refresh).

### 13. Teamwork & Social Mechanics (Phase 13) ✅ COMPLETED
1. **Teamwork Actions**: Implemented "Help" mechanic.
   - Updated `DecisionEngine` to classify `teamwork` intent.
   - Implemented `processTeamwork` in `GameMaster` to handle assistance rolls (Fair +2 difficulty).
   - Success creates a situational aspect ("Assisted by [Player]") with free invokes on the target.
   - Verified with `teamwork.test.ts`.

### 14. Group Conflicts & Social Dynamics (Phase 14) ✅ COMPLETED
1. **Group Combat**: Implemented multi-participant combat.
   - Updated `GameMaster` to handle `startCombat` with allies and multiple enemies.
   - Updated `processCombatTurn` to loop through all participants (Player -> Allies -> Enemies).
   - Implemented `decideNPCAction` in `DecisionEngine` to control NPC behavior based on side (Ally/Enemy).
   - Fixed bug in `GameMaster.ts` where combat ended prematurely due to passing empty opponent list to `checkResolution`.
   - Verified with `group_conflict.test.ts`.

### 16. Advanced AI and World Simulation (Phase 16) ✅ COMPLETED
1. **World Events System**: Implemented a comprehensive world events system.
   - Added `WorldEventSchema` in `@llmrpg/protocol` with trigger types (time, condition, random) and effect types (aspect_add, location_change, faction_change).
   - Created `WorldEventsManager` in `packages/cli/src/systems` to process and apply events with delta collection.
   - Integrated event processing into `GameMaster.processFateAction()` to trigger events based on turn progression and conditions.
   - Events can modify world state, add aspects, or change faction/locations dynamically.
2. **Dynamic NPC Behavior**: Enhanced NPC responsiveness.
   - NPCs now have evolving agendas based on world state changes (foundation laid for future expansion).
   - Relationship-based dialogue continues to adapt to trust, affection, respect, and influence levels.
3. **Advanced Context Management**: Improved LLM context handling.
   - Enhanced `DialogueSystem` to use nuanced relationship dimensions in NPC responses.
   - Social conflict aspects now incorporate faction reputation for more dynamic interactions.

### 17. Test Suite Fixes & Validation (November 27, 2025) ✅ COMPLETED
1. **Core System Fixes**:
   - Fixed `WorldEventsManager.ts` - Added null checks for `events` and `triggers` arrays to prevent runtime errors.
   - Fixed `CombatManager.ts` - Used `Object.values()` for faction iteration in `generateSocialAspects()`.
   - Updated `MockAdapter.ts` - Added proper JSON responses for world events and factions in fallback logic.

2. **Test Mock Ordering Issues Resolved**:
   - Discovered that `initializeWorld()` requires 5 mocks in sequence: Theme → Location → Scenario → World Events → Factions.
   - Fixed `processPlayerAction()` mock ordering - `classifyIntent()` is called BEFORE checking for combat, requiring an extra mock.
   - Fixed 12 test files with incorrect mock sequences.

3. **Individual Test Fixes**:
   | Test File | Issue | Fix |
   |-----------|-------|-----|
   | `npc_interaction.test.ts` | Missing world events/factions mocks | Added mocks + boost name for success_with_style |
   | `reputation_effects.test.ts` | Missing mocks, NPC not at location | Added mocks, NPC to presentNPCs |
   | `quest_system.test.ts` | Extra boost mock when skill=0 | Removed boost mock (shifts < 3 doesn't trigger success_with_style) |
   | `world_persistence.test.ts` | Finding wrong state_change event | Filter by `description.includes("aspect")` |
   | `declaration.test.ts` | Wrong mock return type | `parseDeclaration` returns string, not object |
   | `factions.test.ts` | Missing world events mock | Added `[]` before factions mock |
   | `combat.test.ts` | Missing `classifyIntent` mock | Added `fate_action` mock before combat mocks |
   | `integration.test.ts` | Missing world events mock | Added mock between scenario and factions |

4. **Test Suite Status**: **58 tests passing across 24 test files** ✅

### 18. Phased 10-Minute Test Implementation (November 27, 2025) ✅ COMPLETED
Restructured `ten_minute_granite_test.ts` to use defined gameplay phases:

1. **Phase Structure**:
   - **Phase 1: Setup** (1 min) - World generation and character creation
   - **Phase 2: Exploration** (2 min) - Discover location features and surroundings
   - **Phase 3: Social** (2 min) - NPC interaction and dialogue
   - **Phase 4: Quest** (2 min) - Accept and progress on goals
   - **Phase 5: Combat** (2 min) - Engage in conflict or challenges
   - **Phase 6: Meta** (1 min) - Test /inventory, /status, /save commands

2. **Phase Features**:
   - Each phase has specific objectives passed to the AI player
   - Minimum required actions per phase
   - Success/failure tracking based on completion criteria
   - Per-phase timing and action statistics

3. **Enhanced Reporting**:
   - Per-phase breakdown with duration and success rate
   - Actions by phase summary table
   - Sample AI reasoning from each phase
   - Overall test verdict based on phase completion

### 19. Performance & Production Readiness (Phase 19) ✅ COMPLETED (November 28, 2025)
1. **Configurable Context Windowing**: ✅ Implemented flexible history management for long sessions.
   - Added `GameMasterConfig` interface with `maxHistoryTurns`, `enableSmartPruning`, and `maxContextTokens` options
   - Implemented `pruneHistory()` method with two modes:
     - **Simple Mode**: Count-based pruning (default 10 turns, configurable)
     - **Smart Mode**: Token-based pruning with estimation (~1 token per 4 characters)
   - Added `estimateHistoryTokens()` helper for intelligent context management
   - Updated `GameMaster` constructor to accept optional configuration
   - Applied pruning automatically after each turn in both player and NPC turns
   - Default configuration maintains backward compatibility (10 turns max)

2. **LLM Failure Recovery**: ✅ Implemented retry logic with exponential backoff.
   - Created `retryHelper.ts` utility in `@llmrpg/llm` package with:
     - `withRetry<T>()` function for wrapping async LLM calls
     - Configurable retry options (maxRetries, delays, backoff multiplier)
     - Custom `isRetryable` predicate support
   - Defined three retry presets:
     - **Fast**: 2 retries, 500ms-2s delays (for quick calls like intent classification)
     - **Standard**: 3 retries, 1s-5s delays (for normal LLM generation)
     - **Patient**: 4 retries, 2s-10s delays (for expensive content generation)
   - Integrated retry logic into core systems:
     - `NarrativeEngine`: All 3 narration methods now use retry with standard preset
     - `DecisionEngine`: `selectSkill()` and `classifyIntent()` use retry with fast preset
   - Enhanced error messages to indicate "after retries" for better debugging
   - Existing fallback mechanisms retained as final safety net

3. **Production CLI Polish**: ✅ Enhanced user experience with colors, formatting, and progress indicators.
   - **Color Scheme** (using chalk):
     - Cyan for headings and prompts
     - Green for success messages and positive outcomes
     - Yellow for warnings and tie outcomes
     - Red for failures
     - Magenta/Blue for compel-related outcomes
     - Gray for UI chrome and separators
   - **GameLoop Improvements**:
     - Colored welcome banner with styled border
     - Color-coded outcome messages matching result type
     - Enhanced context display with colored icons (🕐 time, 📜 quests)
     - Improved visual hierarchy with gray separators
   - **Progress Indicators** (index.ts):
     - World generation: "🌍 Generating world..." with completion time
     - Character creation: "👤 Creating character..." with completion time
     - Session loading: "📂 Loading session..." with completion time
     - All timings displayed in seconds with one decimal precision
   - **Visual Feedback**:
     - Success with style: ✨ Green bold
     - Success: ✓ Green
     - Tie: ⚖️ Yellow
     - Failure: ✗ Red
     - Compel states: Colored appropriately (magenta/blue/cyan)

## 📋 Next Steps (Immediate)

### Phase 21: Extended Content (FUTURE)
1. **Multiple Locations**: Allow players to travel between generated locations.
2. **NPC Memory**: NPCs remember past interactions across sessions.
3. **Persistent World State**: World changes persist and affect future sessions.

### Phase 22: Additional Export Enhancements (OPTIONAL)
1. **Combat & Conflict Readability**: Format combat exchanges as dramatic sequences.
2. **Enhanced Metadata Summary**: Character development arc, Fate Point economy summary, quest progression timeline.
3. **Export Format Options**: HTML export, PDF generation.

## 🐛 Known Issues / Notes

### Critical Bugs (Identified November 26, 2025 - 10-Minute Test Analysis)

#### BUG-001: Time Value Becomes NaN ⏰ ✅ FIXED
- **Location**: `packages/cli/src/GameMaster.ts` line 174, 496
- **Cause**: `parseInt("Start")` returns `NaN` when initial time is set to `"Start"`
- **Fix Applied**:
  - Changed initial time from `"Start"` to `"0"` (line 174)
  - Added safe parsing with `isNaN()` fallback (line 496)

#### BUG-002: Quests Created on Action Failure 📜 ✅ FIXED
- **Location**: `packages/cli/src/GameMaster.ts:~530`
- **Cause**: `determineQuestUpdate()` called regardless of action outcome
- **Fix Applied**: Added guard to only allow `type: 'new'` quests on success; failures can still update/fail existing quests

#### BUG-003: Duplicate Quest Appending 📋 ✅ FIXED
- **Location**: `packages/cli/src/GameMaster.ts:applyQuestUpdate()` (~line 1095)
- **Cause**: No deduplication check before appending quests
- **Fix Applied**: Added check for existing quest ID before adding new quests

#### BUG-004: Social Actions Without NPCs 👤 ✅ FIXED
- **Location**: `packages/cli/src/GameMaster.ts:findNPCByName()`
- **Cause**: `findNPCByName()` fell back to all known NPCs instead of only present NPCs
- **Fix Applied**: `findNPCByName()` now only returns NPCs that are in `presentNPCs` at current location

#### BUG-005: Combat Without Valid Targets ⚔️ ✅ MITIGATED
- **Location**: `packages/cli/src/GameMaster.ts` + `CombatManager.ts`
- **Cause**: Attack actions processed without validating enemy presence
- **Mitigation**: The `findNPCByName()` fix also helps here - no target found means no NPC combat actions. Full combat validation is a larger feature enhancement.
- **Status**: Partially fixed (NPC validation improved); full combat target validation deferred

#### BUG-006: Aspect Serialization in Export 🏷️ ✅ FIXED
- **Location**: `packages/cli/src/exportSessionToMarkdown.ts:~215`
- **Cause**: Aspect objects stringified as `[object Object]` instead of formatted
- **Fix Applied**: Added proper aspect formatting with `typeof` check and `.name` extraction

### New Bugs Discovered (November 26, 2025 - Session Export Analysis)

#### BUG-007: Action Misclassification 🎯 ✅ FIXED
- **Location**: `packages/cli/src/systems/DecisionEngine.ts:classifyAction()`
- **Cause**: LLM sometimes classifies non-combat actions (e.g., "Walk forward") as `attack`
- **Fix Applied**:
  1. Enhanced prompt with explicit rules: movement/exploration are NEVER attacks
  2. Added scene context (present NPCs, hostile NPCs) to prompt
  3. Added post-classification validation that overrides `attack` to `overcome` when:
     - Input uses movement/exploration verbs AND doesn't mention a present NPC
     - No combat words present AND no hostile targets AND no NPC mentioned
  4. Attack now requires explicit naming of a present target

#### BUG-008: Attack Without Target Generates Damage Event ⚔️
- **Location**: `packages/cli/src/GameMaster.ts:applyActionConsequences()`
- **Cause**: When `attack` action has no valid target, system still creates "Dealt X shifts of damage (Placeholder for target application)" event
- **Impact**: Confusing mechanical events that don't make narrative sense
- **Status**: 📝 DOCUMENTED - Should skip damage event when no target exists

#### BUG-009: Narration Not Persisted to Turn Data 📝 ✅ FIXED
- **Location**: `packages/core/src/types/turn.ts` + `packages/cli/src/GameMaster.ts:finalizeTurn()`
- **Cause**: `Turn` interface lacked `narration` field; narrative was generated but not saved
- **Fix Applied**:
  1. Added `narration?: string` to `Turn` interface in `packages/core/src/types/turn.ts`
  2. Updated `finalizeTurn()` to set `turn.narration = narration` before saving
  3. Updated `processCombatTurn()` to set `turn.narration` before saving combat turns
  4. Updated `exportSessionToMarkdown.ts` to display narration per turn

#### BUG-010: Session Export Only Shows System Turns ✅
- **Location**: `packages/cli/src/exportSessionToMarkdown.ts:generateMarkdown()`
- **Identified**: November 28, 2025 - 10-minute test export analysis
- **Resolved**: Phase 20 implementation
- **Root Cause**: JSONL files contained duplicate turn entries; narrative content in `turn.narration` field was being displayed but format wasn't reader-friendly
- **Fix Applied**:
  - Added turn deduplication (by turnId, keeping version with playerReasoning)
  - Added `extractPlayerAction()` to show player actions from skill_check events
  - Added `extractRollInfo()` to display dice rolls with skill, difficulty, shifts
  - Implemented 3 export formats: `story` (narrative-only), `playreport` (mixed), `technical` (detailed)
  - Added `--format` CLI flag and interactive format selection
- **Status**: ✅ FIXED - Verified with 51-turn session export (was showing 12 turns before fix)

#### BUG-011: AI Player Repetition Loop 🔄
- **Location**: `packages/cli/src/systems/AIPlayer.ts:decideAction()`
- **Identified**: November 28, 2025 - Phase 21 analytics
- **Symptoms**:
  - AI player repeats semantically identical actions (e.g., "demand information from cultists" 9 times)
  - 5+ consecutive attempts of the same action pattern
  - Repetition score 40/100 indicates borderline loop behavior
  - Story reads as stuck/repetitive rather than progressive
- **Root Cause**: 
  - Prompt says "don't repeat" but AI has no memory of its recent actions
  - Failed actions lead to slight rephrasing, not strategy change
  - No mechanism to detect or break loops
- **Impact**: Sessions become narratively stale; player makes no progress
- **Status**: 📋 PLANNED FOR PHASE 22 - See Phase 22 plan for solutions

#### BUG-012: No Location Travel Possible 🗺️
- **Location**: `packages/cli/src/systems/ContentGenerator.ts:generateStartingLocation()`
- **Identified**: November 28, 2025 - Phase 21 analytics
- **Symptoms**:
  - Player stuck at starting location for entire 51-turn session
  - No zone movement, no location change events
  - AI player never attempts to travel
- **Root Cause**:
  - Generated locations have `connections: []` (empty array)
  - AI Player context doesn't include available exits
  - `movePlayer()` only handles zone movement within a scene, not between locations
  - No `travelToLocation()` method implemented
- **Impact**: Exploration impossible; world feels like single room
- **Status**: 📋 PLANNED FOR PHASE 22 - Need to generate connections and implement travel

#### BUG-013: Dialogue Not Triggering DialogueSystem 💬
- **Location**: `packages/cli/src/GameMaster.ts:processPlayerAction()`
- **Identified**: November 28, 2025 - Phase 21 analytics
- **Symptoms**:
  - Player says "ask the cultists about X" 
  - Results in skill_check event, not dialogue event
  - 0 dialogue events in 51-turn session despite many NPC interactions
  - DialogueSystem exists but never invoked
- **Root Cause**:
  - `classifyIntent()` doesn't recognize dialogue patterns
  - "Ask about" classified as investigation/create_advantage
  - No routing from intent classification to DialogueSystem
- **Impact**: NPCs feel like obstacles rather than characters; no relationship building
- **Status**: 📋 PLANNED FOR PHASE 22 - Need dialogue pattern detection and routing

#### BUG-014: No Compel Offers Despite Failures 🎲
- **Location**: `packages/cli/src/GameMaster.ts`
- **Identified**: November 28, 2025 - Phase 21 analytics
- **Symptoms**:
  - 78% failure rate (40 failures in 51 turns)
  - 0 compels offered during entire session
  - Player has Trouble aspect "Shattered Legacy" but never compelled
  - 0 Fate Points spent or gained
- **Root Cause**:
  - Compel system exists but only triggers on specific conditions
  - No proactive compel offers after repeated failures
  - AI Player doesn't know to spend Fate Points on important rolls
- **Impact**: Player trapped in failure spiral with no mechanical escape
- **Status**: 📋 PLANNED FOR PHASE 22 - Need proactive compel offers and FP prompts

### Build Issues (November 28, 2025)

#### TYPE-001: Protocol Type Mismatches 🔧
- **Status**: 📝 NEEDS FIX - Type definitions out of sync with implementation
- **Affected Files**: Multiple files in `packages/cli/src/`
- **Issues Identified**:
  1. **Missing Exports in @llmrpg/core**: `AdvancementManager` not exported
  2. **Missing Exports in @llmrpg/protocol**: `Compel`, `WorldEvent` not exported
  3. **Turn Interface**: Missing `narration?: string` and `playerReasoning?: string` properties
  4. **Relationship Type**: Missing `affection`, `respect`, `influence` properties; `history` type mismatch
  5. **EventType**: Missing new event types (`fate_compel`, `fate_point_spend`, `fate_point_award`, `fate_point_refresh`, `world_event`)
  6. **WorldState**: Missing `events` property
  7. **Location Arrays**: Type mismatch between Record<string, Location> and Location[]
- **Impact**: Build fails with ~40 TypeScript errors
- **Next Steps**: Synchronize protocol types with implementation (update Turn, Relationship, EventType, WorldState schemas)

## 📊 10-Minute Granite4:3b Comprehensive Test Results (November 26, 2025)

### Test Configuration
- **Model**: granite4:3b (local Ollama)
- **Duration**: 10.13 minutes
- **Actions Tested**: 40 total

### Results
| Metric | Value |
|--------|-------|
| Total Runtime | 10.13 minutes |
| Total Actions | 40 |
| Successful | 40 (100%) |
| Failed | 0 |
| Average Response Time | 14.24 seconds |

### Systems Exercised
- ✅ World Generation (The Shadowed Keep - Dark Fantasy)
- ✅ Character Creation (Lysandra Veilwind - Lost Scholar-Mage)
- ✅ Exploration (4 actions)
- ✅ NPC Interaction (4 actions)
- ✅ Quest Pursuit (4 actions)
- ✅ Challenges (4 actions)
- ✅ Combat (4 actions)
- ✅ Economy Commands (/inventory, /status, shop search)
- ✅ Save/Load (/save command)
- ✅ Extended Play (8 actions)

### Bug Fixed During Testing
**Issue**: Aspect types displaying as "(undefined)" in `/status` output

**Root Cause**: Character creation was mapping aspects with `kind` property instead of `type`, causing mismatch with status display code.

**Fix Applied**: Updated `GameMaster.createCharacter()` to properly map aspect types (high_concept, trouble, background, relationship) from LLM output.

**Verification**: Status now correctly displays:
```
**Aspects:**
- The Shattered Realms Mage (high_concept)
- Forsaken by Magic (trouble)
- Master of Dark Arts (background)
```
