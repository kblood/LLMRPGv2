# Full Test Workflow for LLMRPGv2

## Overview

This document describes the complete end-to-end testing workflow for LLMRPGv2 with real Granite4:3b LLM integration.

## Workflow Stages

### Stage 1: Real 10-Minute Session Test
**File:** `packages/cli/tests/real_10min_ollama_test.ts`

Runs a 10-minute gameplay session with real Granite4:3b LLM inference.

**What it does:**
- Generates a world theme and starting location using Granite4:3b
- Creates a character with full personality and aspects
- Runs AI-controlled gameplay for 10 minutes
- AI makes decisions using real LLM inference (~1.5-2s per decision)
- Executes actions and receives narration from LLM
- Creates periodic snapshots every 20 turns to manage memory
- Saves session state to `test-sessions/sessions/active/{sessionId}/`

**Output:**
- Session ID saved to `test-sessions/LAST_SESSION_ID.txt`
- Game state with full history
- Turn-by-turn event logs
- Performance metrics

**Expected Duration:** ~10 minutes
**Expected Turns:** 100-160 turns (based on 3.7s average per turn)

---

### Stage 2: Session Continuation Test
**File:** `packages/cli/tests/session_continuation_test.ts`

Loads the saved session and continues gameplay for additional turns.

**What it does:**
- Loads the saved session from Stage 1
- Validates state persistence (player, world, character)
- Continues gameplay with AI decisions
- Adds 5-10 continuation turns
- Verifies save/load reliability

**Command:**
```bash
npx tsx tests/session_continuation_test.ts <SESSION_ID>
```

**Output:**
- Continuation turn count
- State validation results
- Performance metrics

**Expected Duration:** ~30-60 seconds
**Expected Additional Turns:** 5-10

---

### Stage 3: Statistical Analysis
**File:** `packages/cli/tests/session_statistics.ts`

Analyzes the completed session for gameplay metrics and quality scores.

**What it does:**
- Loads the session and analyzes all turns
- Counts outcomes (success, failure, compel, tie)
- Tracks action types (combat, social, exploration)
- Measures narration quality and length
- Counts locations visited and NPC interactions
- Generates quality score (0-100) with grade (F-A+)

**Command:**
```bash
npx tsx tests/session_statistics.ts <SESSION_ID>
```

**Output:**
- Session metrics (turns, locations, NPCs)
- Turn outcome distribution
- Quality score and grade
- Improvement suggestions

**Expected Duration:** ~5-10 seconds

---

### Stage 4: Export to Markdown
**File:** `packages/cli/src/exportSessionToMarkdown.ts`

Exports the full session narrative to a readable markdown file.

**What it does:**
- Loads session state
- Generates markdown with:
  - Session metadata (ID, player, world)
  - World description and theme
  - Character details
  - Turn-by-turn history with narration
  - Player actions and results

**Command:**
```bash
npx tsx src/exportSessionToMarkdown.ts <SESSION_ID>
```

**Output:**
- Markdown file at `exports/{SESSION_ID}.md`
- Full narrative suitable for reading/publishing

**Expected Duration:** ~5 seconds

---

### Stage 5: Story Quality Review
**Manual Analysis** - Review exported markdown

**What to look for:**
1. **Narrative Coherence** - Does the story flow logically?
2. **Character Development** - Does the protagonist evolve?
3. **World Consistency** - Are location descriptions consistent?
4. **Challenge Variety** - Mix of different action types?
5. **Aspect Integration** - Are character aspects used narratively?
6. **Engagement** - Is the story interesting to read?

**Metrics to assess:**
- Total turns and duration
- Location variety (5+ unique locations)
- NPC interactions (10%+ of turns)
- Success rate (30-50% typical)
- Narration length (100+ characters average)

---

## Running the Complete Workflow

### Automated Workflow
```bash
cd packages/cli
bash ../../run_full_test_workflow.sh
```

### Step-by-Step Manual

**Step 1: Start the real test**
```bash
cd packages/cli
npx tsx tests/real_10min_ollama_test.ts
# Wait for ~10 minutes...
```

**Step 2: Get the session ID** (when test completes)
```bash
SESSION_ID=$(cat test-sessions/LAST_SESSION_ID.txt)
echo "Session ID: $SESSION_ID"
```

**Step 3: Continue the session**
```bash
npx tsx tests/session_continuation_test.ts $SESSION_ID
```

**Step 4: Analyze statistics**
```bash
npx tsx tests/session_statistics.ts $SESSION_ID
```

**Step 5: Export to markdown**
```bash
npx tsx src/exportSessionToMarkdown.ts $SESSION_ID
```

**Step 6: Review the story**
```bash
open "exports/$SESSION_ID.md"  # macOS
# or
cat "exports/$SESSION_ID.md"   # Linux/WSL
```

---

## Example Output

### Session Statistics
```
╔════════════════════════════════════════╗
│     SESSION STATISTICS REPORT          │
╚════════════════════════════════════════╝

Session Overview:
   Player: Roran Ironshield
   World: The Shattered Realms
   Total Turns: 123

Gameplay Metrics:
   Locations Visited: 8
   NPC Interactions: 15
   Success Rate: 35%
   Failure Rate: 15%
   Compel Offered: 50%

Quality Score: 72/100 (B grade)
   ✓ Good location variety
   ✓ Decent action variety
   ✗ Limited NPC interactions
   ✗ Repetitive investigation patterns
```

### Exported Markdown
```markdown
# Session: real-ollama-1764371967143

> Exported on 29.11.2025

## Session Information
| Property | Value |
|----------|-------|
| **Session ID** | `real-ollama-1764371967143` |
| **Player** | Roran Ironshield |
| **World** | The Shattered Realms |
| **Total Turns** | 123 |

## Turn History

### Turn 1
*Day 1, morning*

**Player Action:** Explore the marketplace...

You venture into the bustling Grand Bazaar, your warrior senses alert...

---

### Turn 2
...
```

---

## Interpreting Results

### Success Rate Interpretation
- **50-100%:** World too easy, increase difficulty
- **30-50%:** Good challenge level
- **10-30%:** World too harsh, reduce difficulty
- **<10%:** Broken mechanics

### Compel Frequency
- **>60%:** High narrative tension (good for drama)
- **30-60%:** Balanced
- **<30%:** Few character conflicts

### Location Variety
- **<5 locations:** World feels small
- **5-10 locations:** Good exploration feel
- **10+ locations:** Rich world with discovery

### NPC Interactions
- **0-5%:** World feels empty
- **5-15%:** Decent social interaction
- **15%+ :** Good NPC focus

---

## Known Observations

### What Works Well ✅
1. **World Generation** - Rich, detailed descriptions
2. **Aspect Integration** - GM uses player aspects for narrative
3. **Location Generation** - Dynamic world building
4. **LLM Narration** - Granite4:3b produces engaging text
5. **State Persistence** - Save/load works reliably

### Areas for Improvement ⚠️
1. **AI Repetition** - AI gets stuck exploring same areas
2. **NPC Sparsity** - Few NPCs in generated world
3. **Challenge Variety** - Compel offers more than successes
4. **Outcome Distribution** - Ties are common (navigation uncertainty)
5. **Social Gameplay** - Limited dialogue-based interaction

---

## Troubleshooting

### Test doesn't complete
- Check Ollama is running: `curl http://127.0.0.1:11434/api/tags`
- Check session directory exists: `ls packages/cli/test-sessions/`
- Increase timeout or reduce TEST_DURATION

### Session ID not found
- Check test output for "Session ID saved"
- Verify LAST_SESSION_ID.txt was created
- Test may have crashed - check logs

### Markdown export fails
- Verify session directory exists
- Check SESSION_ID format is correct
- Run with explicit path if needed

### Statistics show low quality
- This is normal for first tests
- Review "Areas for Improvement" above
- May need tuning of difficulty/NPC generation

---

## Next Steps for Improvement

1. **Improve AI Decision Making**
   - Add anti-repetition detection
   - Better goal-setting for long-term planning
   - Travel more dynamically

2. **Enhance NPC Generation**
   - Generate more NPCs in locations
   - Add NPC dialogue hooks
   - Create faction NPCs

3. **Tune Challenge Difficulty**
   - Adjust base difficulty formulas
   - Tune compel frequency
   - Add more success conditions

4. **Add Content Variety**
   - Quest system integration
   - Loot/reward mechanics
   - Skill-based challenges

---

## Files Reference

| File | Purpose |
|------|---------|
| `real_10min_ollama_test.ts` | 10-minute session with real LLM |
| `session_continuation_test.ts` | Continue saved session |
| `session_statistics.ts` | Analyze session metrics |
| `exportSessionToMarkdown.ts` | Export to readable format |
| `run_full_test_workflow.sh` | Automated end-to-end runner |

---

Generated: 2025-11-29
LLMRPGv2 v1.0
