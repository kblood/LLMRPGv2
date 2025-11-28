#!/bin/bash

# Post-Test Analysis Workflow
# Runs after the real LLM test completes

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║ 📊 POST-TEST ANALYSIS WORKFLOW                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Get session ID from file
SESSION_ID=$(cat test-sessions/LAST_SESSION_ID.txt 2>/dev/null)

if [ -z "$SESSION_ID" ]; then
    echo "❌ Could not find session ID. Make sure real test has completed."
    exit 1
fi

echo "📁 Session ID: $SESSION_ID"
echo ""

# Step 1: Statistics Analysis
echo "STEP 1: Analyzing gameplay statistics..."
echo "=================================================="
timeout 60 npx tsx tests/session_statistics.ts "$SESSION_ID"
STAT_RESULT=$?

echo ""
# Step 2: Session Continuation
echo "STEP 2: Continuing session for 10 more turns..."
echo "=================================================="
timeout 300 npx tsx tests/session_continuation_test.ts "$SESSION_ID"
CONT_RESULT=$?

echo ""
# Step 3: Export to Markdown
echo "STEP 3: Exporting session to markdown..."
echo "=================================================="
timeout 60 npx tsx src/exportSessionToMarkdown.ts "$SESSION_ID"
EXPORT_RESULT=$?

# Get export path
EXPORT_PATH=$(find exports -name "${SESSION_ID}.md" 2>/dev/null | head -1)

echo ""
# Step 4: Story Quality Analysis
if [ -f "$EXPORT_PATH" ]; then
    echo "STEP 4: Analyzing exported story quality..."
    echo "=================================================="

    # Count metrics from markdown
    TURN_COUNT=$(grep -c "^### Turn" "$EXPORT_PATH" 2>/dev/null || echo "0")
    HAS_NARRATION=$(grep -c "📜" "$EXPORT_PATH" 2>/dev/null || echo "0")
    ACTION_COUNT=$(grep -c "Action:" "$EXPORT_PATH" 2>/dev/null || echo "0")

    echo "📊 STORY METRICS:"
    echo "   Total Turns in Export: $TURN_COUNT"
    echo "   Narration Entries: $HAS_NARRATION"
    echo "   Action Entries: $ACTION_COUNT"

    # Check for story variety
    LOCATION_VARIETY=$(grep -c -i "location\|room\|area\|chamber" "$EXPORT_PATH" 2>/dev/null || echo "0")
    CHARACTER_INTERACTION=$(grep -c -i "speak\|talk\|dialogue\|npc\|character" "$EXPORT_PATH" 2>/dev/null || echo "0")
    CONFLICT=$(grep -c -i "combat\|fight\|attack\|danger" "$EXPORT_PATH" 2>/dev/null || echo "0")

    echo ""
    echo "📖 STORY ELEMENTS:"
    echo "   Location References: $LOCATION_VARIETY"
    echo "   Character Interactions: $CHARACTER_INTERACTION"
    echo "   Conflict/Combat: $CONFLICT"

    echo ""
    echo "✅ Export available at: $EXPORT_PATH"
else
    echo "⚠️  Could not find exported markdown file"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║ ✅ ANALYSIS COMPLETE                                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Results Summary:"
echo "   Statistics Analysis: $([ $STAT_RESULT -eq 0 ] && echo '✅' || echo '❌')"
echo "   Continuation Test:   $([ $CONT_RESULT -eq 0 ] && echo '✅' || echo '❌')"
echo "   Export to Markdown:  $([ $EXPORT_RESULT -eq 0 ] && echo '✅' || echo '❌')"
echo ""
echo "📁 Session Files:"
echo "   Location: test-sessions/sessions/active/$SESSION_ID/"
echo "   Markdown: $EXPORT_PATH"
echo ""
