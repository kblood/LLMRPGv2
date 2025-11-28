# Mock vs Real LLM Test Comparison

## Test Results Summary

### 🔴 Mock Adapter Test (simple_10min_test.ts)
**What it tests:** Uses `MockAdapter` with instant fake responses

| Metric | Value |
|--------|-------|
| **Test Duration** | <1 second |
| **Turns Generated** | 500 |
| **Average Turn Time** | ~2ms |
| **LLM Inference** | ❌ NONE - Instant mock responses |
| **Real World Relevance** | ⚠️ Very limited - only tests game mechanics, not LLM integration |

**Turns Breakdown:**
- Turns 1-500: All simulated instantly with `MockAdapter`
- No real language model calls
- No API latency
- Testing only gameplay loops and state management

---

### 🟢 Real Ollama Test (real_10min_ollama_test.ts)
**What it tests:** Uses `OllamaAdapter` with actual Granite4:3b LLM inference

| Metric | Value |
|--------|-------|
| **Test Duration** | 119.3 seconds (2 minutes) |
| **Turns Generated** | 27 |
| **Average Turn Time** | 3.51 seconds |
| **Min Turn Time** | 1.98 seconds |
| **Max Turn Time** | 5.06 seconds |
| **Median Turn Time** | 3.33 seconds |
| **LLM Model** | Granite4:3b (3.4B parameters) |
| **LLM Inference** | ✅ REAL - Actual model inference per turn |
| **Real World Relevance** | ✅ Excellent - true gameplay experience |

**Turn Breakdown:**
- Turn 1-5: World/Character generation + gameplay
  - World Theme: 6.5s (Granite4 inference)
  - Character Creation: 4.8s (Granite4 inference)
- Turn 6-27: Gameplay with real LLM decisions
  - AI Decision Making: ~1.5-2.2s per turn
  - Action Execution: ~0.5-3.4s per turn
  - World Interactions: Travel, exploration, NPC interactions

---

## Performance Comparison

### Speed Difference
```
Mock Adapter:      0.00 seconds per turn
Real LLM:          3.51 seconds per turn (average)

Ratio: Real LLM is 3510x SLOWER than mock
```

### What This Means
1. **Mock tests are good for:**
   - Testing game mechanics quickly
   - Validating state management
   - Unit testing individual systems
   - CI/CD pipelines (fast feedback)

2. **Real LLM tests show:**
   - Actual gameplay experience (119s per 27 turns ≈ 4.4 seconds/turn)
   - In 10 minutes of real time: ~150 turns possible
   - World generation overhead (first turn is slowest)
   - LLM inference adds 1.5-2s per decision

---

## Key Observations from Real LLM Test

### ✅ Working Correctly
- World generation with realistic descriptions
- Character creation with actual personality
- AI decision-making using real language model
- Action execution and result narration
- Session saving/loading
- Location generation and travel
- Memory and persistence across turns

### 🔄 Patterns Observed
- AI often repeats investigation patterns
- Compel offers more frequent than success (expected - world is constrained)
- Travel actions have higher execution time (generating new locations)
- NPC interactions fail when NPC not present (correct behavior)
- Session state grows with each turn (snapshots help with memory)

### ⚠️ Areas for Future Optimization
- Average turn time: 3.51s (acceptable, but could be faster)
- World generation: 6.5s (could use caching or simpler models)
- Character generation: 4.8s (could use templates)
- Repeated investigation actions suggest AI needs better anti-repetition

---

## Conclusion

The **mock tests are NOT representative of real gameplay**. They complete in milliseconds because there's no actual language model inference happening.

The **real Ollama test shows true performance**:
- ~27 turns in 2 minutes = ~4.4 seconds per turn
- Extrapolates to ~150 turns in 10 minutes
- Real LLM adds 1.5-2 seconds per AI decision
- Perfect for testing actual game experience

### Recommendation
- Use **mock tests** for rapid iteration and CI/CD
- Use **real LLM tests** for integration testing and gameplay validation
- Run real LLM tests before release to catch actual performance issues

---

## Test Files
- `packages/cli/tests/simple_10min_test.ts` - Mock adapter version
- `packages/cli/tests/real_10min_ollama_test.ts` - Real LLM version
- Session data stored in: `packages/cli/test-sessions/`
