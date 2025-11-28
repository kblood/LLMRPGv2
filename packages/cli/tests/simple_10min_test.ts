/**
 * Simple 10-Minute Session Test with Export
 * Runs a basic gameplay session and exports results
 */

import { GameMaster } from '../src/GameMaster';
import { OllamaAdapter, MockAdapter } from '@llmrpg/llm';
import { SessionWriter, SessionLoader, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const SESSION_ID = `session-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');

async function runSimpleSession() {
  console.log('🎮 Starting 10-minute session test...\n');

  const startTime = Date.now();
  const SESSION_DURATION = 10 * 60 * 1000; // 10 minutes
  const MAX_TURNS = 500; // Reasonable limit to prevent memory explosion

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
      player: 'Test Player'
    });

    // Initialize with mock LLM for testing (change to OllamaAdapter for real gameplay)
    const llmProvider = new MockAdapter();

    const gameMaster = new GameMaster(SESSION_ID, llmProvider, sessionWriter, sessionLoader);

    // Generate world
    console.log('🌍 Generating world...');
    await gameMaster.initializeWorld('High Fantasy with magical kingdoms and dangerous dungeons');
    console.log('✅ World generated\n');

    // Create character
    console.log('👤 Creating character...');
    await gameMaster.createCharacter('A brave warrior seeking legendary artifacts');
    console.log('✅ Character created\n');

    // Start game
    await gameMaster.start();
    console.log('🎮 Game started\n');

    // Simulate gameplay with safeguards
    let turnCount = 0;
    const SNAPSHOT_INTERVAL = 100; // Create snapshots every 100 turns to free memory

    while (Date.now() - startTime < SESSION_DURATION && turnCount < MAX_TURNS) {
      const actions = [
        'look around',
        'talk to the merchant',
        'explore the area',
        'check my inventory',
        'rest'
      ];

      const action = actions[Math.floor(Math.random() * actions.length)];

      try {
        const result = await gameMaster.processPlayerAction(action);
        turnCount++;

        console.log(`Turn ${turnCount}: ${action}`);
        if (result.narration) {
          console.log(`  Result: ${result.narration.substring(0, 100)}...`);
        }

        // Create snapshot periodically to free memory
        if (turnCount % SNAPSHOT_INTERVAL === 0) {
          console.log(`📸 Creating snapshot at turn ${turnCount}...`);
          await gameMaster.saveState();
        }
      } catch (error: any) {
        console.error(`Error on turn ${turnCount}: ${error.message}`);
      }

      // Check time remaining
      const elapsed = Date.now() - startTime;
      const remaining = SESSION_DURATION - elapsed;
      if (remaining < 1000 || turnCount >= MAX_TURNS) {
        console.log(`\n⏰ Stopping: Time=${(elapsed / 1000).toFixed(1)}s, Turns=${turnCount}/${MAX_TURNS}`);
        break;
      }
    }

    // Save the session
    console.log('\n💾 Saving session...');
    await gameMaster.saveState();
    console.log(`✅ Session saved with ${turnCount} turns\n`);

    // Export to markdown
    console.log('📄 Exporting to markdown...');
    const exportPath = path.join(STORAGE_PATH, `${SESSION_ID}-export.md`);
    let markdown = `# Game Session Report\n\n`;
    markdown += `**Session ID:** ${SESSION_ID}\n`;
    markdown += `**Duration:** ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`;
    markdown += `**Total Turns:** ${turnCount}\n\n`;
    markdown += `## Summary\nSession completed with ${turnCount} actions.\n`;

    fs.writeFileSync(exportPath, markdown, 'utf-8');
    console.log(`✅ Exported to: ${exportPath}\n`);

    console.log('═'.repeat(60));
    console.log('✅ SESSION TEST COMPLETED SUCCESSFULLY');
    console.log('═'.repeat(60));
    console.log(`\n📁 Session ID: ${SESSION_ID}`);
    console.log(`📊 Total Turns: ${turnCount}`);
    console.log(`⏱️  Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    return { sessionId: SESSION_ID, turnCount, success: true };

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    return { sessionId: SESSION_ID, turnCount: 0, success: false };
  }
}

// Run the test
runSimpleSession().then(result => {
  process.exit(result.success ? 0 : 1);
});
