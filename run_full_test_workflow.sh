#!/bin/bash

# Full Test Workflow Orchestration
# Runs: Real 10min test -> Continuation -> Statistics -> Export -> Quality Analysis

cd "packages/cli"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        🎮 FULL SESSION TEST WORKFLOW                         ║"
echo "║   Real LLM Test → Continuation → Stats → Export → Analysis   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Run the real LLM test
echo "STEP 1: Running 10-minute real LLM test with Granite4:3b..."
echo "⏱️  This will take approximately 10 minutes..."
echo ""

timeout 660 npx tsx tests/real_10min_ollama_test.ts

if [ $? -ne 0 ]; then
    echo "❌ Real LLM test failed"
    exit 1
fi

# Extract session ID
SESSION_ID=$(cat test-sessions/LAST_SESSION_ID.txt 2>/dev/null)

if [ -z "$SESSION_ID" ]; then
    echo "❌ Could not find session ID"
    exit 1
fi

echo ""
echo "✅ Real test complete. Session ID: $SESSION_ID"
echo ""

# Step 2: Run continuation test
echo "STEP 2: Running session continuation test..."
timeout 300 npx tsx tests/session_continuation_test.ts "$SESSION_ID"

# Step 3: Run statistics analysis
echo ""
echo "STEP 3: Running statistical analysis..."
timeout 60 npx tsx tests/session_statistics.ts "$SESSION_ID"

# Step 4: Export to markdown
echo ""
echo "STEP 4: Exporting session to markdown..."
timeout 60 npx tsx src/exportSessionToMarkdown.ts "$SESSION_ID"

# Step 5: Run full pipeline analysis
echo ""
echo "STEP 5: Generating comprehensive quality report..."
timeout 300 npx tsx tests/full_session_pipeline.ts

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║ ✅ WORKFLOW COMPLETE                                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
