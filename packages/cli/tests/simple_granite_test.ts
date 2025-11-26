/**
 * Simple 3-Minute Granite Test
 * Minimal overhead to isolate the crash
 */

import { GameMaster } from '../src/GameMaster';
import { OllamaAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const TEST_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const SESSION_ID = `simple-test-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');

// Add verbose error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received');
  process.exit(0);
});

process.on('exit', (code) => {
  console.log(`📤 Process exiting with code: ${code}`);
});

async function main() {
  console.log('Starting simple granite test...\n');
  
  // Setup
  if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
  }
  
  const fsAdapter = new FileSystemAdapter(STORAGE_PATH);
  const sessionWriter = new SessionWriter(fsAdapter);
  
  await sessionWriter.createSession(SESSION_ID, {
    startTime: Date.now(),
    player: 'Test Player'
  });
  
  const llm = new OllamaAdapter({
    model: 'granite4:3b',
    host: 'http://127.0.0.1:11434'
  });
  
  const gm = new GameMaster(SESSION_ID, llm, sessionWriter);
  
  console.log('Initializing world...');
  await gm.initializeWorld('Dark Fantasy');
  console.log('World ready.\n');
  
  console.log('Creating character...');
  await gm.createCharacter('A wandering mage');
  console.log('Character ready.\n');
  
  await gm.start();
  console.log('Game started!\n');
  
  const startTime = Date.now();
  const actions = [
    'Look around',
    'Search for clues',
    'Examine my surroundings',
    'Listen carefully',
    'Walk forward',
    'Inspect the area',
  ];
  
  let turnCount = 0;
  let actionIndex = 0;
  
  while (Date.now() - startTime < TEST_DURATION_MS) {
    const action = actions[actionIndex % actions.length];
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    
    console.log(`[${elapsed}s] Turn ${turnCount + 1}: "${action}"`);
    
    try {
      const turnStart = Date.now();
      const result = await gm.processPlayerAction(action);
      const duration = Date.now() - turnStart;
      
      console.log(`  ✓ ${result.turn?.events?.length || 0} events, ${(result.narration?.length || 0)} chars, ${duration}ms`);
      turnCount++;
      actionIndex++;
    } catch (error: any) {
      console.error(`  ✗ ERROR: ${error.message}`);
      console.error(error.stack);
      break;
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n✅ Completed ${turnCount} turns in ${Math.floor((Date.now() - startTime) / 1000)} seconds`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
