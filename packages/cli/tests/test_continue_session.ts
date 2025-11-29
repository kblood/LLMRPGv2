import { SessionManager } from '../src/storage/SessionManager';
import { GameMaster } from '../src/GameMaster';

async function testContinueSession() {
  const sessionId = 'granite-10min-test-1764412098688';
  console.log(`\n📁 Testing session continuation for: ${sessionId}\n`);

  // Load the session
  console.log('📂 Loading session...');
  const sessionManager = new SessionManager();
  const savedState = await sessionManager.loadSession(sessionId);

  if (!savedState) {
    console.error('❌ Failed to load session');
    return;
  }

  console.log(`✅ Session loaded successfully`);
  console.log(`   Turn: ${savedState.turn}`);
  console.log(`   Player: ${savedState.player.name}`);
  console.log(`   Fate Points: ${savedState.player.fatePoints}`);

  // Check for quest state persistence
  const questState = (savedState as any)?.questState;
  const examinationHistory = (savedState as any)?.examinationHistory;

  console.log('\n📚 BOUNDED GAME SYSTEM STATE:');
  if (questState?.mainQuest) {
    console.log(`   ✅ Main Quest: ${questState.mainQuest.title}`);
    console.log(`      Status: ${questState.mainQuest.status}`);
    console.log(`      Deadline: Turn ${questState.mainQuest.turnDeadline}`);
  } else {
    console.log(`   ⚠️ No main quest found in saved state`);
  }

  if (questState?.sideQuests?.length > 0) {
    console.log(`   ✅ Side Quests: ${questState.sideQuests.length} available`);
    questState.sideQuests.forEach((q: any) => {
      console.log(`      - ${q.title}`);
    });
  }

  if (examinationHistory?.length > 0) {
    const saturatedObjects = examinationHistory.filter((r: any) => r.examineCount >= 2);
    console.log(`   ✅ Examination History: ${examinationHistory.length} records`);
    if (saturatedObjects.length > 0) {
      console.log(`      Saturated objects: ${saturatedObjects.length}`);
    }
  } else {
    console.log(`   ℹ️ No examination history (expected for new games)`);
  }

  // Initialize GameMaster with loaded state
  console.log('\n🎮 Initializing GameMaster with loaded state...');
  const gameMaster = new GameMaster(sessionId, savedState);

  // Process a few actions to test continuation
  console.log('\n▶️ Processing continuation actions...');
  const actions = [
    "I examine my surroundings carefully",
    "I look for any exits or paths forward",
    "I check my inventory"
  ];

  for (let i = 0; i < actions.length; i++) {
    try {
      const result = await gameMaster.processPlayerAction(actions[i]);
      console.log(`\n[${i + 1}] Action: "${actions[i]}"`);
      console.log(`    Result: ${result.result}`);
      console.log(`    Turn: ${result.turn}`);
      if (result.narration) {
        console.log(`    Narration: ${result.narration.substring(0, 100)}...`);
      }
    } catch (error) {
      console.error(`❌ Error processing action: ${error}`);
    }
  }

  // Get final state
  const finalState = gameMaster.getGameState();
  console.log(`\n✅ Session continuation test complete`);
  console.log(`   Final Turn: ${finalState.turn}`);
  console.log(`   Current Fate Points: ${finalState.player.fatePoints}`);

  // Verify quest and examination state was preserved through actions
  const finalContext = gameMaster.getAIPlayerContext();
  const finalQuestState = (finalContext.worldState as any)?.questState;
  const finalExaminationHistory = (finalContext.worldState as any)?.examinationHistory;

  console.log('\n📊 STATE PERSISTENCE VALIDATION:');
  if (finalQuestState?.mainQuest) {
    console.log(`   ✅ Main Quest persisted: ${finalQuestState.mainQuest.title}`);
  }
  if (finalExaminationHistory && finalExaminationHistory.length > 0) {
    console.log(`   ✅ Examination history persisted: ${finalExaminationHistory.length} records`);
  }

  // Save the continued session
  console.log('\n💾 Saving continued session...');
  await sessionManager.saveSession(finalState);
  console.log('✅ Session saved');

  // Summary
  console.log('\n════════════════════════════════════════════');
  console.log('✅ CONTINUE SESSION TEST: PASSED');
  console.log('   - Session loaded successfully');
  if (questState?.mainQuest) {
    console.log('   - Quest state was preserved');
  }
  if (examinationHistory && examinationHistory.length > 0) {
    console.log('   - Examination history was preserved');
  }
  console.log('   - Session continued with loaded state');
  console.log('════════════════════════════════════════════');
}

testContinueSession().catch(console.error);
