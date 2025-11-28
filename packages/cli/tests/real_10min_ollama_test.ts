/**
 * Real 10-Minute Session Test with Ollama
 * Runs a 10-minute gameplay session using actual Granite4:3b LLM inference
 * This test demonstrates real LLM interaction, not mocked responses
 */

import { GameMaster } from '../src/GameMaster';
import { OllamaAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import { AIPlayer } from '../src/systems/AIPlayer';
import path from 'path';
import fs from 'fs';

const SESSION_ID = `real-ollama-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');
const TEST_DURATION = 2 * 60 * 1000; // 2 minutes (for testing, can extend to 10)
const SNAPSHOT_INTERVAL = 10; // Snapshot every 10 turns (shorter for real LLM)

async function runRealSession() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         🎮 REAL 10-MINUTE SESSION TEST WITH GRANITE4:3B        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    // Initialize storage
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }

    const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
    const sessionWriter = new SessionWriter(fsAdapter);
    const sessionLoader = new SessionLoader(fsAdapter);

    // Create session
    await sessionWriter.createSession(SESSION_ID, {
      startTime: Date.now(),
      player: 'AI Player'
    });

    console.log('📋 Session Info:');
    console.log(`   Session ID: ${SESSION_ID}`);
    console.log(`   Duration: ${(TEST_DURATION / 1000 / 60).toFixed(0)} minutes`);
    console.log(`   LLM: Granite4:3b (via Ollama)\n`);

    // Initialize with REAL Ollama LLM
    console.log('🔗 Connecting to Ollama...');
    const llmProvider = new OllamaAdapter({
      model: 'granite4:3b',
      host: 'http://127.0.0.1:11434'
    });

    const gameMaster = new GameMaster(SESSION_ID, llmProvider, sessionWriter, sessionLoader);
    const aiPlayer = new AIPlayer(llmProvider);

    // Generate world
    console.log('🌍 Generating world with Granite4:3b...');
    const worldStartTime = Date.now();
    await gameMaster.initializeWorld('High Fantasy with magical kingdoms and dangerous dungeons');
    const worldTime = Date.now() - worldStartTime;
    console.log(`✅ World generated in ${(worldTime / 1000).toFixed(1)}s\n`);

    // Create character
    console.log('👤 Creating character with Granite4:3b...');
    const charStartTime = Date.now();
    await gameMaster.createCharacter('A brave warrior seeking legendary artifacts');
    const charTime = Date.now() - charStartTime;
    console.log(`✅ Character created in ${(charTime / 1000).toFixed(1)}s\n`);

    // Start game
    await gameMaster.start();
    console.log('🎮 Game started\n');
    console.log('═'.repeat(68));
    console.log('GAMEPLAY STARTING - Real LLM inference per turn\n');

    // Simulate gameplay with real LLM
    let turnCount = 0;
    let totalActionTime = 0;
    const turnTimes: number[] = [];

    while (Date.now() - startTime < TEST_DURATION) {
      const turnStart = Date.now();
      turnCount++;

      try {
        // Get AI context from GameMaster
        const fullContext = gameMaster.getAIPlayerContext();

        if (!fullContext.player) {
          throw new Error('No player found in session');
        }

        const context = {
          ...fullContext,
          objectives: [
            'Continue your adventure and seek new challenges',
            'Discover hidden secrets and ancient artifacts',
            'Build relationships with NPCs and factions'
          ]
        };

        // AI decides action using REAL LLM
        console.log(`\nTurn ${turnCount}:`);
        console.log('  🤖 AI thinking with Granite4:3b...');

        const decisionStart = Date.now();
        const actionDecision = await aiPlayer.decideAction(context);
        const decisionTime = Date.now() - decisionStart;

        console.log(`     ✓ Decision made in ${(decisionTime / 1000).toFixed(1)}s`);
        console.log(`     Action: ${actionDecision.action.substring(0, 60)}...`);

        // Execute the action with real LLM narration
        const execStart = Date.now();
        const result = await gameMaster.processAIPlayerAction(
          actionDecision.action,
          actionDecision.reasoning,
          actionDecision.fatePointsSpent,
          actionDecision.aspectInvokes
        );
        const execTime = Date.now() - execStart;

        console.log(`     ✓ Action executed in ${(execTime / 1000).toFixed(1)}s`);
        console.log(`     Result: ${result.result}`);

        if (result.narration) {
          const narrationPreview = result.narration.substring(0, 80);
          console.log(`     📜 "${narrationPreview}..."`);
        }

        const turnDuration = Date.now() - turnStart;
        turnTimes.push(turnDuration);
        totalActionTime += turnDuration;

        // Create snapshot periodically
        if (turnCount % SNAPSHOT_INTERVAL === 0) {
          console.log(`\n   📸 Creating snapshot at turn ${turnCount}...`);
          await gameMaster.saveState();
        }

      } catch (error: any) {
        console.error(`\n   💥 Turn ${turnCount} failed: ${error.message}`);
      }

      // Check time remaining
      const elapsed = Date.now() - startTime;
      const remaining = TEST_DURATION - elapsed;

      if (remaining < 5000) {
        console.log(`\n⏰ Test duration complete (${(elapsed / 1000).toFixed(1)}s)`);
        break;
      }

      // Brief pause between turns to prevent API flooding
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Save the session
    console.log('\n💾 Saving final session state...');
    await gameMaster.saveState();
    console.log('✅ Session saved\n');

    // Print statistics
    console.log('═'.repeat(68));
    console.log('📊 TEST STATISTICS\n');
    console.log(`Total Turns: ${turnCount}`);
    console.log(`Total Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`Average Turn Time: ${(totalActionTime / turnCount / 1000).toFixed(2)}s`);
    console.log(`Min Turn Time: ${(Math.min(...turnTimes) / 1000).toFixed(2)}s`);
    console.log(`Max Turn Time: ${(Math.max(...turnTimes) / 1000).toFixed(2)}s`);
    console.log(`Median Turn Time: ${(turnTimes.sort((a, b) => a - b)[Math.floor(turnTimes.length / 2)] / 1000).toFixed(2)}s`);

    console.log('\n═'.repeat(68));
    console.log('✅ REAL LLM TEST COMPLETED SUCCESSFULLY');
    console.log('═'.repeat(68));
    console.log(`\n📁 Session ID: ${SESSION_ID}`);
    console.log(`📊 Total Turns: ${turnCount}`);
    console.log(`⏱️  Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`\nExport with: npx tsx src/exportSessionToMarkdown.ts ${SESSION_ID}`);

    return { sessionId: SESSION_ID, turnCount, success: true };

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return { sessionId: SESSION_ID, turnCount: 0, success: false };
  }
}

// Run the test
runRealSession().then(result => {
  process.exit(result.success ? 0 : 1);
});
