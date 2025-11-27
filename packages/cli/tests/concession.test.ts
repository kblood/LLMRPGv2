import { GameMaster } from '../src/GameMaster';
import { MockAdapter } from '@llmrpg/llm';
import { SessionWriter, FileSystemAdapter } from '@llmrpg/storage';
import path from 'path';
import fs from 'fs';

const SESSION_ID = `concession-test-${Date.now()}`;
const STORAGE_PATH = path.join(__dirname, '../test-sessions');

async function main() {
  console.log('Starting Concession System Test...\n');
  
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
  
  console.log('Creating character...');
  await gm.createCharacter('A weary warrior');
  
  await gm.start();
  
  // Start a conflict
  console.log('Starting conflict...');
  const opponent = {
      id: 'npc-goblin',
      name: 'Goblin',
      highConcept: 'Nasty Goblin',
      trouble: 'Cowardly',
      aspects: [],
      skills: { Fight: 2 },
      stunts: [],
      stress: { physical: [false, false], mental: [false, false] },
      consequences: [],
      fatePoints: 1,
      personality: {},
      backstory: {},
      relationships: [],
      knowledge: {}
  };
  
  await gm.startCombat([opponent as any]);
  
  // Mock DecisionEngine.classifyIntent to return 'concede'
  (gm as any).decisionEngine.classifyIntent = async () => 'concede';
  
  // Mock generateCompel to avoid interference
  (gm as any).decisionEngine.generateCompel = async () => null;
  
  console.log('\n--- Test 1: Concede Conflict ---');
  const action = "I realize I can't win. I surrender and run away.";
  console.log(`Player Action: "${action}"`);
  
  const initialFP = gm['player']?.fatePoints.current || 0;
  console.log(`Initial FP: ${initialFP}`);
  
  const result = await gm.processPlayerAction(action) as any;
  
  console.log(`Result: ${result.result}`);
  console.log(`Narration: ${result.narration}`);
  
  const newFP = gm['player']?.fatePoints.current || 0;
  console.log(`New FP: ${newFP}`);
  
  if (newFP === initialFP + 1) {
      console.log('✅ FP Awarded correctly (1 base).');
  } else {
      console.error(`❌ FP NOT Awarded correctly. Expected ${initialFP + 1}, got ${newFP}`);
  }
  
  // Verify conflict ended
  if (gm['currentScene']?.conflict?.isResolved) {
      console.log('✅ Conflict resolved.');
      if (gm['currentScene']?.conflict?.winner === 'opposition') {
          console.log('✅ Winner is opposition.');
      } else {
          console.error(`❌ Winner is incorrect: ${gm['currentScene']?.conflict?.winner}`);
      }
  } else {
      console.error('❌ Conflict NOT resolved.');
  }
}

main().catch(console.error);
