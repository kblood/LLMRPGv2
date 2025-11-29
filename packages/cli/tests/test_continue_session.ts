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

  // Save the continued session
  console.log('\n💾 Saving continued session...');
  await sessionManager.saveSession(finalState);
  console.log('✅ Session saved');
}

testContinueSession().catch(console.error);
