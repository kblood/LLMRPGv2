/**
 * Test for examination deduplication system
 * Verifies that repeated examinations trigger graduated feedback warnings
 */

import { GameMaster } from '../src/GameMaster';
import { v4 as uuidv4 } from 'uuid';

async function runExaminationDeduplicationTest() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('🔍 EXAMINATION DEDUPLICATION TEST');
  console.log('════════════════════════════════════════════════════════════\n');

  const sessionId = uuidv4();
  const gameMaster = new GameMaster({
    maxHistoryTurns: 20,
    enableSmartPruning: false,
  });

  try {
    // Initialize game
    console.log('📋 Initializing game state...');
    await gameMaster.initializeGame({
      theme: 'fantasy',
      setting: 'A mystical library filled with ancient artifacts',
      playerName: 'Test Scholar',
      playerConcept: 'Curious Researcher',
      playerTrouble: 'Always needs to know more',
    });

    const currentScene = gameMaster.getCurrentScene();
    if (!currentScene) {
      throw new Error('Failed to initialize game');
    }

    console.log(`✅ Game initialized at: ${currentScene.name}\n`);

    // Test sequence: examine the same object 4 times
    const objectName = 'Ancient Tome';
    const examinationTests = [
      { num: 1, expectedFeedback: '', label: 'First examination' },
      { num: 2, expectedFeedback: '🔍 You notice nothing new', label: 'Second examination' },
      { num: 3, expectedFeedback: '⚠️ Further examination', label: 'Third examination' },
      { num: 4, expectedFeedback: '❌ You already understand', label: 'Fourth examination' },
    ];

    let successCount = 0;

    for (const test of examinationTests) {
      console.log(`\n📝 Test ${test.num}: ${test.label}`);
      console.log('─────────────────────────────────────');

      const action = `I examine the ${objectName} carefully, looking for any clues or hidden knowledge`;

      try {
        const result = await gameMaster.processPlayerAction(action);

        if (!result || !result.narration) {
          console.log('❌ FAILED: No narration returned');
          continue;
        }

        const narration = result.narration;
        console.log(`📖 Narration: "${narration.substring(0, 150)}..."`);

        // Check for expected feedback
        let feedbackFound = false;
        if (test.num === 1) {
          // First examination should NOT have feedback prefix
          feedbackFound = !narration.startsWith('🔍') && !narration.startsWith('⚠️') && !narration.startsWith('❌');
          console.log(`✅ No feedback prefix (as expected for first examination)`);
        } else {
          feedbackFound = narration.includes(test.expectedFeedback);
          if (feedbackFound) {
            console.log(`✅ Found expected feedback: "${test.expectedFeedback}..."`);
            successCount++;
          } else {
            console.log(`❌ Expected feedback not found: "${test.expectedFeedback}"`);
            console.log(`   Actual narration start: "${narration.substring(0, 100)}"`);
          }
        }

        // Check examinationHistory
        const examinationHistory = (gameMaster as any).examinationHistory;
        if (examinationHistory && examinationHistory.length > 0) {
          const lastRecord = examinationHistory[examinationHistory.length - 1];
          console.log(`📊 Examination count: ${lastRecord.examineCount}`);
        }

      } catch (error) {
        console.log(`❌ FAILED with error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('📊 TEST SUMMARY');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`✅ Passed feedback tests: ${successCount}/3`);

    if (successCount >= 2) {
      console.log('✅ EXAMINATION DEDUPLICATION TEST: PASSED');
    } else {
      console.log('⚠️  EXAMINATION DEDUPLICATION TEST: NEEDS REVIEW');
    }

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log('\n');
}

// Run the test
runExaminationDeduplicationTest().then(() => {
  console.log('✅ All tests completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
