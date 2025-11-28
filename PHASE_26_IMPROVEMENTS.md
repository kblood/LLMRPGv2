# Phase 26: Gameplay Quality Improvements

**Date:** November 29, 2025
**Status:** 🔴 In Planning
**Priority:** HIGH - Critical system improvements identified from real LLM testing

---

## Executive Summary

Real 10-minute test with Granite4:3b revealed that while **LLM narration quality is excellent**, three critical system issues prevent engaging gameplay:

1. **AI Decision Repetition** - AI gets stuck repeating same action 60+ turns in a row
2. **Challenge Difficulty Imbalance** - 75% compel rate forces player into losing situations
3. **Export Data Loss** - Markdown export missing 80+ turns of game data

All issues are system-level, not LLM-related. Granite4:3b produces excellent prose consistently.

---

## Test Results Summary

### ✅ What Works (LLM Performance)

| Metric | Result | Status |
|--------|--------|--------|
| **Narration Quality** | Rich, thematic descriptions | ✅ Excellent |
| **Prose Consistency** | Maintains "High Fantasy, Dark" tone throughout | ✅ Excellent |
| **Context Awareness** | References locations, aspects, recent events | ✅ Good |
| **Decision Speed** | 1.5-2.0s per decision, 3.5-4.5s per turn | ✅ Reliable |
| **Theme Integration** | All descriptions thematically consistent | ✅ Strong |

**Example Excellence:**
```
"As you step forth from the shattered sanctum, a hushed reverence hangs
in the air, tinged with an ancient sorrow that whispers of forgotten rites
and lost souls. The sun dips low on the horizon, casting long shadows
across the land as you set your course toward the elemental nexus to the
south, where the wind carries tales of untamed magic and primal forces
waiting to be harnessed by those brave enough to seek them out."
```

### ❌ What Fails (System Issues)

| Issue | Severity | Impact | Root Cause |
|-------|----------|--------|-----------|
| AI Repetition (Turns 20-100) | 🔴 CRITICAL | Game stagnates while narration continues | AIPlayer lacks anti-repetition, goal planning |
| Export Data Loss | 🔴 CRITICAL | 80+ turns missing from markdown | Bug in turn sampling/filtering logic |
| Difficulty Imbalance | 🟡 HIGH | 75% compel rate overwhelms player | Difficulty calc favors compels over successes |

---

## Issue #1: AI Decision Repetition

### Problem
AI gets trapped exploring "Rune-etched Hallway" for 60+ consecutive turns with nearly identical actions:
- Turn 20: "explore Rune-etched Hallway" → compel
- Turn 25: "examine Rune-etched Hallway" → compel
- Turn 40: "examine Rune-etched Hallway" → compel
- ...continues through Turn 100

### Impact
- Game becomes boring despite excellent narration
- Story stagnates (same location, same action, same outcome)
- No progress toward character objectives
- Player gets caught in failure loop with no escape

### Root Cause
1. **No Anti-Repetition Detection** - AIPlayer doesn't track recent actions
2. **No Goal-Based Planning** - AI reacts to immediate state, doesn't plan ahead
3. **No Escape Heuristics** - When stuck, AI doesn't try different approach
4. **Aspect Compels as Trap** - "Haunted Past" compels keep pulling AI back to same location

### Solution

**26.1: Enhanced Anti-Repetition System** (Priority: CRITICAL)

File: `packages/cli/src/systems/AIPlayer.ts`

```typescript
// Add action history tracking
private recentActions: Array<{
  action: string;
  location: string;
  outcome: string;
  turn: number;
}> = [];

private const MAX_ACTION_HISTORY = 20;
private const MIN_TURNS_BETWEEN_REPEATS = 5;

// Before making decision, check if similar action was recently tried
canRepeatAction(proposedAction: string, currentLocation: string): boolean {
  const recentSimilar = this.recentActions
    .filter(a =>
      a.location === currentLocation &&
      this.actionsAreSimilar(a.action, proposedAction) &&
      (currentTurn - a.turn) < MIN_TURNS_BETWEEN_REPEATS
    );

  return recentSimilar.length === 0; // Can only repeat if not recent
}

// Track action after execution
recordAction(action: string, location: string, outcome: string) {
  this.recentActions.push({
    action,
    location,
    outcome,
    turn: this.currentTurn
  });

  // Keep history bounded
  if (this.recentActions.length > MAX_ACTION_HISTORY) {
    this.recentActions.shift();
  }
}
```

**26.2: Goal-Based Decision Making** (Priority: HIGH)

File: `packages/cli/src/systems/AIPlayer.ts`

```typescript
// Add goal tracking
private goals: Array<{
  description: string;
  targetLocation?: string;
  targetNPC?: string;
  priority: 'high' | 'medium' | 'low';
  turnsActive: number;
}> = [];

// Periodically reassess goals if stuck
reassessGoalsIfStuck() {
  const successRate = this.getRecentSuccessRate(lastN=10);

  if (successRate < 0.2) { // <20% success in last 10 turns
    // We're stuck - change strategy
    this.goals = this.generateNewGoals();
  }
}

// When failing repeatedly, change location
changeLocationIfStuck(context: AIPlayerContext) {
  const recentOutcomes = this.recentActions.slice(-5);
  const allFailed = recentOutcomes.every(a => a.outcome === 'failure');
  const toomanCompels = recentOutcomes.filter(a => a.outcome === 'compel_offered').length >= 3;

  if (allFailed || tooManyCompels) {
    return this.decideTravel(context); // Force travel to different location
  }
}
```

**26.3: Escape Condition Detection** (Priority: HIGH)

File: `packages/cli/src/systems/AIPlayer.ts`

```typescript
// Detect when player is truly stuck (same action, same location, same outcome)
isStuckInLoop(): boolean {
  if (this.recentActions.length < 5) return false;

  const lastFive = this.recentActions.slice(-5);
  const locations = new Set(lastFive.map(a => a.location));
  const outcomes = new Set(lastFive.map(a => a.outcome));

  // Stuck if: same location for 5+ turns, same outcome type
  return locations.size === 1 && outcomes.size === 1;
}

// Force diversification when stuck
decideActionWithDiversification(context: AIPlayerContext): {
  action: string;
  reasoning: string;
} {
  if (this.isStuckInLoop()) {
    // Try: 1) Travel, 2) Inventory check, 3) Talk to NPC, 4) Different location
    return this.getEscapeActions(context)[0]; // Take first escape action
  }

  // Normal decision
  return this.decideAction(context);
}
```

---

## Issue #2: Export Data Loss

### Problem
Markdown export contains only ~20 turns instead of 106 recorded turns.

**Missing turns:**
- Turns 16-35 (20 turns)
- Turns 37-75 (39 turns)
- Turns 78-79 (2 turns)
- Turns 81-83 (3 turns)
- Turns 85-100 (16 turns)
- Turn 103 (1 turn)

**Total missing:** 81 of 106 turns (76% data loss)

### Impact
- Exported story incompletely represents actual gameplay
- Loses narrative progression
- Users see incomplete session history

### Root Cause
Bug in `exportSessionToMarkdown.ts` turn sampling/filtering logic. Likely:
1. Skipping turns with empty narration
2. Sampling instead of including all turns
3. Turn index/lookup issue

### Solution

**26.4: Fix Export Turn Completeness** (Priority: CRITICAL)

File: `packages/cli/src/exportSessionToMarkdown.ts`

```typescript
// Current problematic code (likely looks like):
const turns = sessionState.turns.filter(t => t.narration && t.narration.length > 0);
// This filters out tie/navigation turns with minimal narration!

// Fixed version - INCLUDE ALL TURNS:
const allTurns = sessionState.turns; // Include every turn, even minimal ones

// Generate markdown for every turn, even short ones:
for (const turn of allTurns) {
  const turnNumber = turn.turnNumber;
  const timeOfDay = this.calculateTimeOfDay(turn); // Use turn progression
  const action = turn.action || "No action recorded";
  const narration = turn.narration || turn.result || "Turn executed.";

  markdown += `\n### Turn ${turnNumber}\n\n`;
  markdown += `*${timeOfDay}*\n\n`;
  markdown += `**Player Action:** ${action}\n\n`;
  markdown += `${narration}\n\n---\n`;
}

// Verify all turns are included:
console.log(`Exported ${exportedTurns} of ${sessionState.turns.length} turns`);
if (exportedTurns < sessionState.turns.length) {
  console.warn(`⚠️ WARNING: Lost ${sessionState.turns.length - exportedTurns} turns in export!`);
}
```

**26.5: Add Export Validation** (Priority: MEDIUM)

File: `packages/cli/src/exportSessionToMarkdown.ts`

```typescript
// After export completes, validate completeness:
async exportAndValidate(sessionId: string): Promise<{
  success: boolean;
  fileSize: number;
  turnCount: number;
  missingTurns: number[];
  warnings: string[];
}> {
  const result = await this.exportSessionToMarkdown(sessionId);

  // Load original session to verify
  const sessionState = await loader.loadSessionState(sessionId);
  const expectedTurns = sessionState.turns.length;

  // Count turns in markdown
  const turnMatches = result.content.match(/### Turn \d+/g) || [];
  const exportedTurns = turnMatches.length;

  const warnings: string[] = [];
  const missingTurns: number[] = [];

  if (exportedTurns < expectedTurns) {
    warnings.push(`Missing ${expectedTurns - exportedTurns} turns in export`);

    // Find which turns are missing
    for (let i = 1; i <= expectedTurns; i++) {
      if (!result.content.includes(`### Turn ${i}`)) {
        missingTurns.push(i);
      }
    }
  }

  return {
    success: warnings.length === 0,
    fileSize: result.content.length,
    turnCount: exportedTurns,
    missingTurns,
    warnings
  };
}
```

---

## Issue #3: Difficulty Imbalance

### Problem
Challenge system heavily favors compels (75%) over successes (5-10%).

**Outcome Distribution:**
- Compel Offered: 75%
- Tie (Navigation): 10-15%
- Failure: 5-10%
- Success: 5-10%

### Impact
- Player experiences constant narrative pressure (Haunted Past compels)
- Few opportunities for clean victories
- Can feel unfair or overwhelming
- Drives AI toward escape/repetition patterns

### Root Cause
Difficulty calculation in ActionResolver likely:
1. Sets base difficulty too high
2. Applies heavy modifiers for certain action types
3. Biases toward compel outcomes in resolution

### Solution

**26.6: Rebalance Difficulty System** (Priority: HIGH)

File: `packages/core/src/ActionResolver.ts`

```typescript
// Current distribution suggests overweighting of compels
// Healthy distribution should be:
// - Success: 40-50%
// - Failure: 20-30%
// - Compel: 20-30% (narrative tension, not domination)

// Adjust base difficulty
const calculateBaseDifficulty = (context: ActionContext): number => {
  // Current: probably setting to +4 or higher
  // Target: +2 to +3 for standard tasks

  const action = context.action;
  switch (action) {
    case 'overcome': return 2; // Average obstacle: +2 (Fair)
    case 'createAdvantage': return 1; // Creative action: +1 (Mediocre)
    case 'attack': return 2; // Combat: +2 (Fair)
    case 'defend': return 2; // Defense: +2 (Fair)
    default: return 2;
  }
};

// Adjust compel frequency
const shouldOfferCompel = (roll: number, difficulty: number): boolean => {
  // Current: probably checks roll < difficulty
  // Change: Only offer compel if roll is significantly under

  const deficit = difficulty - roll;

  // Only offer compel if failed by 2+
  if (deficit >= 2) {
    // 50% chance to offer compel on significant failure
    return Math.random() < 0.5;
  }

  return false; // No compel on small misses
};
```

**26.7: Add Difficulty Tuning Parameters** (Priority: MEDIUM)

File: `packages/cli/src/GameMaster.ts`

```typescript
// Make difficulty configurable per session
interface DifficultySettings {
  baseDifficulty: number; // 1-5, default 2
  compelFrequency: number; // 0-1, default 0.25 (25%)
  successThreshold: number; // 0-1, expected success rate
  tieFrequency: number; // 0-1, expected tie rate
}

// For future testing:
const difficultySettings: DifficultySettings = {
  baseDifficulty: 2, // Fair difficulty
  compelFrequency: 0.25, // 25% compel rate
  successThreshold: 0.45, // 45% success rate
  tieFrequency: 0.15, // 15% ties
};
```

---

## Implementation Priority & Timeline

### Phase 26.1-26.3: AI Repetition Fix (CRITICAL)
- **Files:** `packages/cli/src/systems/AIPlayer.ts`
- **Effort:** 4-6 hours
- **Testing:** Requires 10+ minute test run
- **Success Criteria:**
  - AI changes location when stuck >5 turns
  - No >10 turn sequences of same action
  - Story maintains narrative progression

### Phase 26.4-26.5: Export Fix (CRITICAL)
- **Files:** `packages/cli/src/exportSessionToMarkdown.ts`
- **Effort:** 2-3 hours
- **Testing:** Export existing session, verify 100% turn coverage
- **Success Criteria:**
  - All 106+ turns appear in markdown
  - No turn gaps in export
  - Validation reports 100% coverage

### Phase 26.6-26.7: Difficulty Rebalancing (HIGH)
- **Files:** `packages/core/src/ActionResolver.ts`, `packages/cli/src/GameMaster.ts`
- **Effort:** 2-3 hours
- **Testing:** 10-minute test with new difficulty settings
- **Success Criteria:**
  - Success rate 40-50%
  - Compel rate 20-30%
  - Tie rate 10-20%
  - Failure rate 10-20%

---

## Testing Strategy

### Test 1: AI Repetition Fix Validation
```bash
cd packages/cli
npx tsx tests/real_10min_ollama_test.ts
# Check for: No location repetition >10 turns, goal reassessment
```

### Test 2: Export Completeness
```bash
npx tsx src/exportSessionToMarkdown.ts <SESSION_ID>
# Verify: All turns present, no gaps, validation shows 100%
```

### Test 3: Difficulty Rebalancing
```bash
npx tsx tests/real_10min_ollama_test.ts
# Measure: Success/failure/compel/tie distribution
# Target: 40-50% / 20-30% / 20-30% / 10-20%
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| **AI Repetition** | 60+ turns same action | <10 turns max |
| **Export Completeness** | 20/106 turns (19%) | 106/106 turns (100%) |
| **Success Rate** | ~5% | 40-50% |
| **Compel Rate** | ~75% | 20-30% |
| **Story Engagement** | Stagnant after turn 20 | Engaging throughout |
| **Narration Quality** | Excellent | Maintain excellence |

---

## Known Unknowns

1. **Exact export filtering logic** - Need to read exportSessionToMarkdown.ts to confirm bug
2. **Difficulty math details** - Need to check ActionResolver implementation
3. **Goal system existence** - AIPlayer may not have built-in goals yet
4. **Action similarity logic** - How to determine if two actions are "too similar"

---

## Next Steps

1. ✅ Create this plan document
2. Implement Phase 26.1-26.3 (AI anti-repetition)
3. Implement Phase 26.4-26.5 (Export fix)
4. Implement Phase 26.6-26.7 (Difficulty tuning)
5. Run comprehensive 10-minute test with fixes
6. Validate improvements
7. Update PROJECT_STATUS.md with completion

---

**Document Status:** Ready for implementation
**Last Updated:** November 29, 2025
**Next Review:** After Phase 26.3 completion
