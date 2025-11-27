import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const SESSION_ID = `refresh-test-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');

async function main() {
  console.log('Starting Refresh Mechanics Test...\n');
  
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
  
  const llm = new MockAdapter();
  const gm = new GameMaster(SESSION_ID, llm, sessionWriter);
  
  console.log('Initializing world...');
  await gm.initializeWorld('Dark Fantasy');
  
  console.log('Creating character with 4 stunts...');
  // Mock ContentGenerator.generateCharacter to return 4 stunts
  const mockChar = {
      name: "Stunt Master",
      appearance: "Flashy",
      aspects: [{ name: "High Concept", type: "highConcept" }, { name: "Trouble", type: "trouble" }],
      skills: [{ name: "Athletics", level: 4 }],
      stunts: [
          { name: "Stunt 1", description: "Desc" },
          { name: "Stunt 2", description: "Desc" },
          { name: "Stunt 3", description: "Desc" },
          { name: "Stunt 4", description: "Desc" }
      ],
      personality: {},
      backstory: {},
      voice: {}
  };
  
  (gm as any).contentGenerator.generateCharacter = async () => mockChar;
  
  await gm.createCharacter('Stunt Master');
  
  const player = gm['player'];
  if (player) {
      console.log(`Refresh: ${player.fatePoints.refresh}`);
      if (player.fatePoints.refresh === 2) {
          console.log('✅ Refresh calculated correctly (3 base - 1 cost = 2).');
      } else {
          console.error(`❌ Refresh incorrect: ${player.fatePoints.refresh}`);
      }
      
      console.log(`Current FP: ${player.fatePoints.current}`);
      if (player.fatePoints.current === 2) {
          console.log('✅ Initial FP matches refresh.');
      } else {
          console.error(`❌ Initial FP incorrect: ${player.fatePoints.current}`);
      }
  }
  
  // Test Refresh Logic
  console.log('\n--- Test Refresh Logic ---');
  if (player) {
      // Start a dummy turn for logging
      gm['turnManager'].startTurn('system', 'scene-test', { day: 1, timeOfDay: 'morning', timestamp: Date.now() });

      // Case 1: FP < Refresh
      player.fatePoints.current = 0;
      console.log('Set FP to 0.');
      gm.refreshFatePoints();
      console.log(`New FP: ${player.fatePoints.current}`);
      if (player.fatePoints.current === 2) {
          console.log('✅ Refreshed to 2.');
      } else {
          console.error('❌ Failed to refresh.');
      }
      
      // Case 2: FP > Refresh
      player.fatePoints.current = 5;
      console.log('Set FP to 5.');
      gm.refreshFatePoints();
      console.log(`New FP: ${player.fatePoints.current}`);
      if (player.fatePoints.current === 5) {
          console.log('✅ Kept excess FP.');
      } else {
          console.error('❌ Incorrectly reset FP.');
      }
  }
}

main().catch(console.error);
